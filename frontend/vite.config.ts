import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    // WHY emptyOutDir: clears stale JS chunks from previous builds.
    // Without this, old hashed filenames accumulate and waste space.
    emptyOutDir: true,
  },
});
