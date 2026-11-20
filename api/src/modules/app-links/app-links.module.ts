import { Injectable, Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost } from '@nestjs/core';
import type { Request, Response } from 'express';

/** Served at the site root (outside the `/api` prefix), where Android looks for it. */
export const ASSET_LINKS_PATH = '/.well-known/assetlinks.json';
/** Android application id (app/capacitor.config.ts `appId`). */
export const ANDROID_PACKAGE_NAME = 'com.agentspace.app';
/**
 * Placeholder until the release signing key exists. Set ANDROID_CERT_SHA256 to the SHA-256 fingerprint(s) of the
 * signing certificate, comma separated (Play Console → Setup → App signing → "App signing key certificate", plus the
 * upload key if debug/internal builds should verify too). Format: `AB:CD:…` (32 colon-separated hex bytes).
 */
export const ANDROID_CERT_SHA256_PLACEHOLDER =
  '00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00';
const ASSET_LINKS_CACHE_SECONDS = 3600;

/**
 * Android App Links (§14.2 Deep links): the Digital Asset Links file that lets `https://<web domain>/…` links open
 * the Android app. Android fetches it from the host named in the app's `autoVerify` intent filter, so it must be
 * reachable at that host's root — if the web app is served from a different host than the API, serve the same JSON
 * there too (e.g. the web host's `/.well-known/assetlinks.json`).
 *
 * Registered on the raw HTTP adapter so the global `/api` prefix doesn't apply.
 */
@Injectable()
export class AppLinksRoute implements OnModuleInit {
  constructor(
    private readonly http: HttpAdapterHost,
    private readonly config: ConfigService,
  ) {}

  assetLinks() {
    const fingerprints = String(
      this.config.get<string>('ANDROID_CERT_SHA256') ?? '',
    )
      .split(',')
      .map((f) => f.trim().toUpperCase())
      .filter(Boolean);
    return [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: ANDROID_PACKAGE_NAME,
          sha256_cert_fingerprints: fingerprints.length
            ? fingerprints
            : [ANDROID_CERT_SHA256_PLACEHOLDER],
        },
      },
    ];
  }

  onModuleInit() {
    const adapter = this.http.httpAdapter;
    if (!adapter) return;
    adapter.get(ASSET_LINKS_PATH, (_req: Request, res: Response) => {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Cache-Control',
        `public, max-age=${ASSET_LINKS_CACHE_SECONDS}`,
      );
      res.send(JSON.stringify(this.assetLinks()));
    });
  }
}

@Module({ providers: [AppLinksRoute] })
export class AppLinksModule {}
