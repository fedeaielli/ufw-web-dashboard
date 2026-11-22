import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const api = process.env.VITE_API_TARGET || "http://127.0.0.1:3300"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  server: {
    proxy: {
      "/api": api,
      "/login": {
        target: api,
        // Let Vite serve the SPA on GET; only the POST needs the API.
        bypass: (req) => (req.method === "GET" ? "/index.html" : false),
      },
      "/logout": api,
      "/health": api,
    },
  },
})
