import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import tailwindcss from "@tailwindcss/vite";

// Builds to static files that work without a server — the same bundle is packaged for desktop and mobile (§14.1).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 1200,
  },
  server: {
    port: 5180,
    strictPort: true,
    // Native projects (Capacitor) and build output are not part of the web app — don't watch them.
    watch: { ignored: ["**/android/**", "**/dist/**"] },
  },
  preview: { port: 5180, strictPort: true },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
