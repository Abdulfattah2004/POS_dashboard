import { assertSafeBuildEnvironment } from './src/lib/clientKey.ts';
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import {fileURLToPath} from 'node:url';
const __dirname=path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [{ name: "pos-client-credential-guard", configResolved(config) { assertSafeBuildEnvironment(config.env); } }, react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 1500,
  },
});
