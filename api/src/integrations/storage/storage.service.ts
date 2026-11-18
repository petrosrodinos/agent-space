import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Storage } from '@google-cloud/storage';
import { FileBucket } from 'generated/prisma';
import { promises as fs } from 'fs';
import * as path from 'path';

export interface UploadTarget {
    /** `gcs-resumable`: POST with `x-goog-resumable: start`, then PUT the bytes to the returned Location. `put`: single PUT. */
    protocol: 'gcs-resumable' | 'put';
    url: string;
    headers: Record<string, string>;
    expires_at: string;
}

export interface ObjectMeta {
    size: number;
    content_type: string;
}

interface LocalTokenPayload {
    typ: 'local-upload' | 'local-download';
    b: string;
    p: string;
    ct?: string;
    max?: number;
    fn?: string;
    disp?: 'inline' | 'attachment';
}

const UPLOAD_TTL_MS = 15 * 60_000;
const DOWNLOAD_TTL_MS = 5 * 60_000;

/**
 * §7.7 File storage. Production: Google Cloud Storage with V4 signed URLs (resumable upload 15 min, download 5 min).
 * Development (STORAGE_DRIVER=local): objects on the API's disk, served through short-lived signed API URLs.
 * Signed URLs are never stored; messages store only file IDs.
 */
@Injectable()
export class StorageService {
    private readonly logger = new Logger(StorageService.name);
    private readonly driver: 'gcs' | 'local';
    private gcs?: Storage;
    private readonly localDir: string;

    constructor(
        private readonly config: ConfigService,
        private readonly jwt: JwtService,
    ) {
        this.driver = config.get('STORAGE_DRIVER') ?? 'gcs';
        this.localDir = path.resolve(config.get('LOCAL_STORAGE_DIR') || path.join(process.cwd(), '.storage'));
        if (this.driver === 'local') this.logger.warn(`STORAGE_DRIVER=local: storing files in ${this.localDir}`);
    }

    get driverName() {
        return this.driver;
    }

    private client(): Storage {
        if (!this.gcs) {
            const b64 = this.config.get<string>('GCS_CREDENTIALS_JSON_BASE64');
            const credentials = b64 ? JSON.parse(Buffer.from(b64, 'base64').toString('utf8')) : undefined;
            this.gcs = new Storage({ projectId: this.config.get('GCS_PROJECT_ID'), credentials });
        }
        return this.gcs;
    }

    /** `agentspace-<env>-<kind>` buckets (§7.7); or one configured bucket with a kind prefix. */
    bucketName(bucket: FileBucket): string {
        const prefix = this.config.get<string>('GCS_BUCKET_PREFIX');
        const kind = bucket.toLowerCase();
        if (prefix) return `${prefix}-${kind}`;
        return this.config.get<string>('GCS_BUCKET_NAME') || `agentspace-${this.config.get('NODE_ENV')}-${kind}`;
    }

    private objectKey(bucket: FileBucket, objectPath: string) {
        return this.config.get('GCS_BUCKET_PREFIX') ? objectPath : `${bucket.toLowerCase()}/${objectPath}`;
    }

    private apiUrl(suffix: string) {
        const base = (this.config.get<string>('API_URL') || `http://localhost:${this.config.get('PORT') || 3000}/api`).replace(/\/$/, '');
        return `${base}${suffix}`;
    }

    private localPath(bucket: string, objectPath: string) {
        const full = path.resolve(this.localDir, bucket.toLowerCase(), objectPath);
        if (!full.startsWith(this.localDir)) throw new NotFoundException('Invalid path');
        return full;
    }

    async createUploadTarget(bucket: FileBucket, objectPath: string, contentType: string, maxSize: number): Promise<UploadTarget> {
        const expires = Date.now() + UPLOAD_TTL_MS;
        if (this.driver === 'local') {
            const token = await this.sign({ typ: 'local-upload', b: bucket, p: objectPath, ct: contentType, max: maxSize }, UPLOAD_TTL_MS);
            return { protocol: 'put', url: this.apiUrl(`/files/local/${token}`), headers: { 'Content-Type': contentType }, expires_at: new Date(expires).toISOString() };
        }
        const file = this.client().bucket(this.bucketName(bucket)).file(this.objectKey(bucket, objectPath));
        const [url] = await file.getSignedUrl({ version: 'v4', action: 'resumable', expires, contentType });
        return {
            protocol: 'gcs-resumable',
            url,
            headers: { 'Content-Type': contentType, 'x-goog-resumable': 'start' },
            expires_at: new Date(expires).toISOString(),
        };
    }

    async createDownloadUrl(bucket: FileBucket, objectPath: string, filename: string, disposition: 'inline' | 'attachment' = 'attachment') {
        const expires = Date.now() + DOWNLOAD_TTL_MS;
        const safeName = filename.replace(/["\r\n]/g, '_');
        if (this.driver === 'local') {
            const token = await this.sign({ typ: 'local-download', b: bucket, p: objectPath, fn: safeName, disp: disposition }, DOWNLOAD_TTL_MS);
            return { url: this.apiUrl(`/files/local/${token}`), expires_at: new Date(expires).toISOString() };
        }
        const [url] = await this.client()
            .bucket(this.bucketName(bucket))
            .file(this.objectKey(bucket, objectPath))
            .getSignedUrl({
                version: 'v4',
                action: 'read',
                expires,
                responseDisposition: `${disposition}; filename="${safeName}"`,
            });
        return { url, expires_at: new Date(expires).toISOString() };
    }

    async stat(bucket: FileBucket, objectPath: string): Promise<ObjectMeta | null> {
        if (this.driver === 'local') {
            try {
                const s = await fs.stat(this.localPath(bucket, objectPath));
                const ct = await fs.readFile(this.localPath(bucket, objectPath) + '.ct', 'utf8').catch(() => 'application/octet-stream');
                return { size: s.size, content_type: ct };
            } catch {
                return null;
            }
        }
        const file = this.client().bucket(this.bucketName(bucket)).file(this.objectKey(bucket, objectPath));
        const [exists] = await file.exists();
        if (!exists) return null;
        const [meta] = await file.getMetadata();
        return { size: Number(meta.size), content_type: meta.contentType || 'application/octet-stream' };
    }

    async write(bucket: FileBucket, objectPath: string, data: Buffer, contentType: string) {
        if (this.driver === 'local') {
            const p = this.localPath(bucket, objectPath);
            await fs.mkdir(path.dirname(p), { recursive: true });
            await fs.writeFile(p, data);
            await fs.writeFile(p + '.ct', contentType);
            return;
        }
        await this.client().bucket(this.bucketName(bucket)).file(this.objectKey(bucket, objectPath)).save(data, { contentType, resumable: false });
    }

    async read(bucket: FileBucket, objectPath: string): Promise<Buffer> {
        if (this.driver === 'local') return fs.readFile(this.localPath(bucket, objectPath));
        const [buf] = await this.client().bucket(this.bucketName(bucket)).file(this.objectKey(bucket, objectPath)).download();
        return buf;
    }

    async remove(bucket: FileBucket, objectPath: string) {
        if (this.driver === 'local') {
            await fs.rm(this.localPath(bucket, objectPath), { force: true });
            await fs.rm(this.localPath(bucket, objectPath) + '.ct', { force: true });
            return;
        }
        await this.client().bucket(this.bucketName(bucket)).file(this.objectKey(bucket, objectPath)).delete({ ignoreNotFound: true });
    }

    // ---- local driver endpoints (called by FilesController) ----

    async verifyLocalToken(token: string): Promise<LocalTokenPayload> {
        try {
            return await this.jwt.verifyAsync<LocalTokenPayload>(token, { secret: this.config.get('JWT_SECRET') });
        } catch {
            throw new NotFoundException('Link expired or invalid');
        }
    }

    localFilePath(bucket: string, objectPath: string) {
        return this.localPath(bucket, objectPath);
    }

    private sign(payload: LocalTokenPayload, ttlMs: number) {
        return this.jwt.signAsync(payload, { secret: this.config.get('JWT_SECRET'), expiresIn: Math.floor(ttlMs / 1000) });
    }
}
