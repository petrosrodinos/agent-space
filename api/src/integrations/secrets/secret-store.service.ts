import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { PrismaService } from '@/core/databases/prisma/prisma.service';

export interface SecretPayload {
    api_key?: string;
    access_token?: string;
    refresh_token?: string;
    expires_at?: string;
    token_type?: string;
    scope?: string;
    /** MCP sign-in (§8.4): JSON of the registered OAuth client and the token set. */
    oauth?: string;
    /** Website logins (§9.4): typed into the matching site on the bot's cloud computer, never shown to the model. */
    username?: string;
    password?: string;
    /** Base32 authenticator secret; codes are computed on the server, so the secret never reaches the computer. */
    totp_secret?: string;
}

export interface SecretLabels {
    org_id: string;
    owner_type: 'user' | 'org';
    kind: 'mcp_oauth' | 'mcp_token' | 'api_key' | 'website_login';
}

export interface StoredSecretRef {
    resource_name: string;
    version: string;
}

/**
 * §8.7 — every secret users give Agent Space. One secret per credential named `cred-<credentialId>`.
 * Production driver: Google Cloud Secret Manager. Dev/staging fallback (SECRET_STORE=local-encrypted):
 * AES-256-GCM ciphertext in `dev_secret_blobs`. There is never a plain-text fallback: when the store
 * is unavailable, saving fails with a clear error.
 */
@Injectable()
export class SecretStoreService {
    private readonly logger = new Logger(SecretStoreService.name);
    private readonly driver: 'gcp' | 'local-encrypted';
    private readonly projectId?: string;
    private client?: SecretManagerServiceClient;
    private readonly localKey?: Buffer;

    constructor(
        private readonly config: ConfigService,
        private readonly prisma: PrismaService,
    ) {
        this.driver = config.get('SECRET_STORE') ?? 'gcp';
        this.projectId = config.get('SECRET_MANAGER_PROJECT_ID') || config.get('GCS_PROJECT_ID');
        if (this.driver === 'local-encrypted') {
            this.localKey = createHash('sha256').update(config.get<string>('SECRETS_ENCRYPTION_KEY')!).digest();
            this.logger.warn('SECRET_STORE=local-encrypted: using the development fallback, not Secret Manager');
        }
    }

    get driverName() {
        return this.driver;
    }

    private gcp(): SecretManagerServiceClient {
        if (!this.client) {
            const b64 = this.config.get<string>('GCS_CREDENTIALS_JSON_BASE64');
            const credentials = b64 ? JSON.parse(Buffer.from(b64, 'base64').toString('utf8')) : undefined;
            this.client = new SecretManagerServiceClient(credentials ? { credentials, projectId: this.projectId } : {});
        }
        return this.client;
    }

    secretName(credentialId: string) {
        return `projects/${this.projectId ?? 'local'}/secrets/cred-${credentialId}`;
    }

    async create(credentialId: string, labels: SecretLabels, payload: SecretPayload): Promise<StoredSecretRef> {
        const name = this.secretName(credentialId);
        try {
            if (this.driver === 'local-encrypted') {
                await this.prisma.devSecretBlob.create({ data: { resource_name: name, version: 1, ciphertext: this.encrypt(payload) } });
                return { resource_name: name, version: '1' };
            }
            const [secret] = await this.gcp().createSecret({
                parent: `projects/${this.projectId}`,
                secretId: `cred-${credentialId}`,
                secret: { replication: { automatic: {} }, labels: { ...labels } },
            });
            const [version] = await this.gcp().addSecretVersion({
                parent: secret.name!,
                payload: { data: Buffer.from(JSON.stringify(payload), 'utf8') },
            });
            return { resource_name: secret.name!, version: version.name!.split('/').pop()! };
        } catch (e) {
            this.logger.error(`Secret store create failed for cred ${credentialId}: ${(e as Error).message}`);
            throw new ServiceUnavailableException({
                message: 'The secure secret store is unavailable. Nothing was saved — please try again.',
                code: 'secret_store_unavailable',
            });
        }
    }

    /** Adds a new version and destroys the previous one (§8.9 Replace). */
    async replace(resourceName: string, previousVersion: string | null, payload: SecretPayload): Promise<string> {
        try {
            if (this.driver === 'local-encrypted') {
                const row = await this.prisma.devSecretBlob.update({
                    where: { resource_name: resourceName },
                    data: { ciphertext: this.encrypt(payload), version: { increment: 1 } },
                });
                return String(row.version);
            }
            const [version] = await this.gcp().addSecretVersion({
                parent: resourceName,
                payload: { data: Buffer.from(JSON.stringify(payload), 'utf8') },
            });
            if (previousVersion) {
                await this.gcp()
                    .destroySecretVersion({ name: `${resourceName}/versions/${previousVersion}` })
                    .catch((e) => this.logger.warn(`Could not destroy old version: ${e.message}`));
            }
            return version.name!.split('/').pop()!;
        } catch (e) {
            this.logger.error(`Secret store replace failed: ${(e as Error).message}`);
            throw new ServiceUnavailableException({ message: 'The secure secret store is unavailable. The old value is still in use.', code: 'secret_store_unavailable' });
        }
    }

    /**
     * Reads a secret value. Only the tool-execution path may call this (§8.7 least privilege);
     * values are never returned to clients, the model, logs or Redis.
     */
    async access(resourceName: string): Promise<SecretPayload> {
        if (this.driver === 'local-encrypted') {
            const row = await this.prisma.devSecretBlob.findUnique({ where: { resource_name: resourceName } });
            if (!row) throw new ServiceUnavailableException('Secret not found');
            return this.decrypt(row.ciphertext);
        }
        const [version] = await this.gcp().accessSecretVersion({ name: `${resourceName}/versions/latest` });
        return JSON.parse(Buffer.from(version.payload!.data as Uint8Array).toString('utf8'));
    }

    async delete(resourceName: string): Promise<void> {
        if (this.driver === 'local-encrypted') {
            await this.prisma.devSecretBlob.deleteMany({ where: { resource_name: resourceName } });
            return;
        }
        await this.gcp().deleteSecret({ name: resourceName });
    }

    private encrypt(payload: SecretPayload): string {
        const iv = randomBytes(12);
        const cipher = createCipheriv('aes-256-gcm', this.localKey!, iv);
        const enc = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
        return [iv, cipher.getAuthTag(), enc].map((b) => b.toString('base64')).join('.');
    }

    private decrypt(blob: string): SecretPayload {
        const [iv, tag, enc] = blob.split('.').map((s) => Buffer.from(s, 'base64'));
        const decipher = createDecipheriv('aes-256-gcm', this.localKey!, iv);
        decipher.setAuthTag(tag);
        return JSON.parse(Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8'));
    }
}
