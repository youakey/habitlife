import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const basePath = mode === "production" ? "/habitlife/" : "/";

  return {
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

          // важно для GitHub Pages (папка /habitlife/)
          scope: basePath,
          start_url: basePath,

          icons: [
            { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
            { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
            { src: "pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
          ],
        },
      }),
    ],
    base: basePath,
  };
});
