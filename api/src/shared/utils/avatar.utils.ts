/**
 * An avatar seed is either a hash for the generated portrait (the original behaviour) or a reference to an
 * uploaded/generated image: `file:<file uuid>`. Keeping both in `avatar_seed` means every place that already
 * carries a bot or group avatar keeps working without a new column.
 */
export const AVATAR_FILE_PREFIX = 'file:';

const HASH_SOURCE = '[a-zA-Z0-9]{4,32}';
const FILE_SOURCE = `${AVATAR_FILE_PREFIX}[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}`;

/** For `@Matches` on DTOs. */
export const AVATAR_SEED_REGEX = new RegExp(`^(${HASH_SOURCE}|${FILE_SOURCE})$`);

export const avatarFileId = (seed: string | null | undefined): string | null =>
    seed && seed.startsWith(AVATAR_FILE_PREFIX) ? seed.slice(AVATAR_FILE_PREFIX.length) : null;

export const avatarSeedForFile = (fileId: string) => `${AVATAR_FILE_PREFIX}${fileId}`;
