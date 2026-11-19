import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173,
    host: true
  },
  build: {
    target: "es2020",
    sourcemap: true,
    rollupOptions: {
      // Two pages: the v1 office at / and the v2 lakehouse storybook at /v2/.
      input: {
        main: resolve(__dirname, "index.html"),
        v2: resolve(__dirname, "v2/index.html")
      }
    }
  }
});
