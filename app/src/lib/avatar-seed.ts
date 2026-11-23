/**
 * `avatar_seed` is either a hash for the generated portrait, or `file:<uuid>` pointing at an uploaded or AI-generated
 * image. Mirrors api/src/shared/utils/avatar.utils.ts.
 */
export const AVATAR_FILE_PREFIX = "file:";

export const avatarFileId = (seed: string | null | undefined): string | null => (seed && seed.startsWith(AVATAR_FILE_PREFIX) ? seed.slice(AVATAR_FILE_PREFIX.length) : null);

export const avatarSeedForFile = (fileId: string) => `${AVATAR_FILE_PREFIX}${fileId}`;

/** Same rule as the API: a 4-32 char hash, or a file reference. */
export const AVATAR_SEED_REGEX = /^([a-zA-Z0-9]{4,32}|file:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;
