import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// In development, API + edge endpoints are proxied to the live site so the console shows real data.
const live = { target: "https://app.strikemap.space", changeOrigin: true, secure: true };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: { "/api": live, "/headers": live, "/cdn-cgi": live },
  },
  // assetsInlineLimit 0: fonts ship as files so the strict CSP (font-src 'self') holds
  build: { target: "es2022", sourcemap: false, chunkSizeWarningLimit: 900, assetsInlineLimit: 0 },
});
