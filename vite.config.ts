import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss()],
  build: {
    lib: {
      entry: "./src/styles/entry.js",
      formats: ["es"],
      fileName: () => "entry.js",
    },
    outDir: "./www",
    copyPublicDir: false,
    emptyOutDir: false,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        assetFileNames: "styles.css",
      },
    },
  },
});
