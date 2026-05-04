import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Use Terser for production builds — provides aggressive minification,
    // variable name mangling, and comment/console stripping.
    minify: "terser",
    terserOptions: {
      compress: {
        // Remove all console.* calls from production — prevents internal
        // data, state values, and logic hints from appearing in DevTools.
        drop_console: true,
        drop_debugger: true,
        // Additional compression passes for smaller, harder-to-read output.
        passes: 3,
        // Remove unreachable code and dead branches.
        dead_code: true,
        // Inline function calls where safe to do so.
        inline: 3,
      },
      mangle: {
        // Rename top-level function and variable names to short random strings.
        toplevel: true,
        // Also mangle names inside eval() calls where safe.
        eval: true,
      },
      format: {
        // Strip all comments from output.
        comments: false,
      },
    },
    // Never emit source maps in production — source maps reveal your original
    // source code and negate all obfuscation.
    sourcemap: false,
    rollupOptions: {
      output: {
        // Split vendor libraries into a separate chunk so app logic is not
        // bundled alongside readable library code. Vite 8 requires a function.
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("@supabase")) return "supabase";
            if (
              id.includes("react-dom") ||
              id.includes("react-router") ||
              id.includes("/react/")
            ) return "vendor";
            if (id.includes("@radix-ui")) return "ui";
          }
        },
        // Obfuscate chunk file names — output files get hashed names with no
        // meaningful labels (e.g. a3f9b2.js instead of dashboard.js).
        chunkFileNames: "assets/[hash].js",
        entryFileNames: "assets/[hash].js",
        assetFileNames: "assets/[hash].[ext]",
      },
    },
  },
});
