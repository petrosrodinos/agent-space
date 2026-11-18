export const DesktopReleaseResourceKind = {
  CONTENT: 'content',
  REDIRECT: 'redirect',
} as const;

export type DesktopReleaseResource =
  | {
      kind: typeof DesktopReleaseResourceKind.CONTENT;
      body: Buffer;
      contentType: string;
    }
  | { kind: typeof DesktopReleaseResourceKind.REDIRECT; url: string };
