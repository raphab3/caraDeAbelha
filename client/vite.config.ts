import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      injectRegister: false,
      registerType: "autoUpdate",
      pwaAssets: {
        config: false,
        overrideManifestIcons: true,
        injectThemeColor: false,
      },
      manifest: {
        id: "/",
        name: "Cara de Abelha",
        short_name: "Abelha",
        description: "Entre no jardim, jogue em tela cheia e instale o MMORPG no celular ou desktop.",
        lang: "pt-BR",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "any",
        background_color: "#120b05",
        theme_color: "#f3a61e",
        categories: ["games", "entertainment"],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: "index.html",
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
      },
      devOptions: {
        enabled: command === "serve",
        resolveTempFolder: () => fileURLToPath(new URL("./.vite/pwa-dev", import.meta.url)),
      },
    }),
  ],
  server: {
    host: "0.0.0.0",
    port: 3000,
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
  },
}));