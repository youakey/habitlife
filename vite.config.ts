import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// GitHub Pages serves from /<repo>/
// Our workflow sets VITE_BASE_PATH to "/<repo>/"
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "HabitLife",
        short_name: "HabitLife",
        description: "Habits, goals, nutrition and daily reflection",
        theme_color: "#0b1220",
        background_color: "#0b1220",
        display: "standalone",
        scope: ".",
        start_url: ".",
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
    }),
  ],
  base: process.env.VITE_BASE_PATH || "/",
});
