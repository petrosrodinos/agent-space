import { createHash, randomBytes, randomUUID } from 'crypto';

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');

export const newId = () => randomUUID();

export function slugify(value: string, max = 48): string {
    const base = value
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, max)
        .replace(/-+$/g, '');
    return base || 'item';
}

export const shortSuffix = () => randomBytes(3).toString('hex');
