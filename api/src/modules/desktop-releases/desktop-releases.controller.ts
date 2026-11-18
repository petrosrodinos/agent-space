import { Controller, Get, HttpStatus, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { DesktopReleasesService } from './desktop-releases.service';
import { DesktopReleaseResourceKind } from './interfaces/desktop-releases.interface';

/**
 * Public update feed and downloads for the desktop app (§14.2). No sign-in: electron-updater and download links
 * fetch these anonymously. Feed URL baked into the app: `<API_URL>/desktop/releases`.
 */
@ApiTags('desktop-releases')
@Controller('desktop/releases')
export class DesktopReleasesController {
  constructor(
    private readonly desktopReleasesService: DesktopReleasesService,
  ) {}

  @Get('*path')
  @ApiOperation({
    summary:
      'Desktop update feed (latest.yml, latest-mac.yml, releases.json) or a release download',
  })
  @ApiResponse({ status: 200, description: 'Feed or index file' })
  @ApiResponse({
    status: 302,
    description: 'Redirect to a short-lived download URL',
  })
  @ApiResponse({ status: 404, description: 'No such release file' })
  async get(@Req() req: Request, @Res() res: Response) {
    const param = (req.params as Record<string, string | string[]>).path;
    const relativePath = Array.isArray(param)
      ? param.join('/')
      : String(param ?? '');
    const resource = await this.desktopReleasesService.resolve(relativePath);

    if (resource.kind === DesktopReleaseResourceKind.REDIRECT) {
      res.setHeader('Cache-Control', 'no-store');
      return res.redirect(HttpStatus.FOUND, resource.url);
    }
    res.setHeader('Cache-Control', 'no-cache, max-age=0');
    res.setHeader('Content-Type', resource.contentType);
    return res.status(HttpStatus.OK).send(resource.body);
  }
}
