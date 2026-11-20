import { Controller, Get, HttpStatus, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { DesktopReleaseResourceKind } from '../desktop-releases/interfaces/desktop-releases.interface';
import { AndroidReleasesService } from './android-releases.service';

/**
 * Public update manifest and APK downloads for the Android app (§14.2). No sign-in: the app and the download links
 * fetch these anonymously. Manifest: `<API_URL>/android/releases/latest.json`.
 */
@ApiTags('android-releases')
@Controller('android/releases')
export class AndroidReleasesController {
  constructor(
    private readonly androidReleasesService: AndroidReleasesService,
  ) {}

  @Get('*path')
  @ApiOperation({
    summary: 'Android update manifest (latest.json, releases.json) or an APK download',
  })
  @ApiResponse({ status: 200, description: 'Manifest or index file' })
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
    const resource = await this.androidReleasesService.resolve(relativePath);

    if (resource.kind === DesktopReleaseResourceKind.REDIRECT) {
      res.setHeader('Cache-Control', 'no-store');
      return res.redirect(HttpStatus.FOUND, resource.url);
    }
    res.setHeader('Cache-Control', 'no-cache, max-age=0');
    res.setHeader('Content-Type', resource.contentType);
    return res.status(HttpStatus.OK).send(resource.body);
  }
}
