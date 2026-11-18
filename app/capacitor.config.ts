import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Mobile apps (§14.2): the same `app/` build, bundled inside the app (never loaded from the website).
 * For live-reload during development only, set CAP_SERVER_URL (e.g. http://192.168.1.20:5180) before `npx cap run`.
 */
const devServer = process.env.CAP_SERVER_URL;

const config: CapacitorConfig = {
  appId: "com.agentspace.app",
  appName: "Agent Space",
  webDir: "dist",
  server: {
    androidScheme: "https",
    iosScheme: "capacitor",
    ...(devServer ? { url: devServer, cleartext: devServer.startsWith("http://") } : {}),
  },
  android: { allowMixedContent: false },
  ios: { contentInset: "automatic", limitsNavigationsToAppBoundDomains: false },
  plugins: {
    PushNotifications: { presentationOptions: ["badge", "sound", "alert"] },
    LocalNotifications: { iconColor: "#0A0A0A" },
  },
};

export default config;
