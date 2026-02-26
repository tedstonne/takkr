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
    assetsInlineLimit: 0, // Never inline fonts as base64
    rollupOptions: {
      output: {
        assetFileNames: (info) => {
          if (info.name?.endsWith(".css")) return "styles.css";
          if (info.name?.match(/\.(woff2?|ttf|eot)$/)) return "fonts/[name][extname]";
          return "[name][extname]";
        },
      },
    },
  },
});
