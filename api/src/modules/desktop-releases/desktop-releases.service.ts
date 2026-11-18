import { Injectable, NotFoundException } from '@nestjs/common';
import * as path from 'path';
import { StorageService } from '@/integrations/storage/storage.service';
import {
  DESKTOP_RELEASE_DOWNLOAD_TTL_MS,
  DESKTOP_RELEASE_METADATA_TYPES,
  DESKTOP_RELEASE_PATH_PATTERN,
  DESKTOP_RELEASES_FOLDER,
} from './constants/desktop-releases.constants';
import {
  DesktopReleaseResourceKind,
  type DesktopReleaseResource,
} from './interfaces/desktop-releases.interface';

@Injectable()
export class DesktopReleasesService {
  constructor(private readonly storage: StorageService) {}

  /** Resolves a path under the releases folder to its content (feeds, index) or a signed download URL (installers). */
  async resolve(relativePath: string): Promise<DesktopReleaseResource> {
    if (!DESKTOP_RELEASE_PATH_PATTERN.test(relativePath))
      throw new NotFoundException('Release file not found');
    const key = `${DESKTOP_RELEASES_FOLDER}/${relativePath}`;
    const contentType =
      DESKTOP_RELEASE_METADATA_TYPES[path.extname(relativePath).toLowerCase()];

    if (contentType) {
      const body = await this.storage.readRaw(key);
      if (!body) throw new NotFoundException('Release file not found');
      return { kind: DesktopReleaseResourceKind.CONTENT, body, contentType };
    }

    const url = await this.storage.createRawDownloadUrl(
      key,
      path.basename(relativePath),
      DESKTOP_RELEASE_DOWNLOAD_TTL_MS,
    );
    if (!url) throw new NotFoundException('Release file not found');
    return { kind: DesktopReleaseResourceKind.REDIRECT, url };
  }
}
