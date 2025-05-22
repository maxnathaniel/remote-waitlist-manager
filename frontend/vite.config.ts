import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 3000,
    watch: {
      usePolling: true,
    },
    proxy: {
      "/api": {
        target: "http://backend:4000",
        changeOrigin: true,
        ws: true,
      },
      "/socket.io": {
        target: "ws://backend:4000",
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
