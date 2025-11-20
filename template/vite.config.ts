import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import checker from "vite-plugin-checker";
import path from "path";
import tailwindcss from '@tailwindcss/vite';
// import reactScan from '@react-scan/vite-plugin-react-scan';

/* https://vitejs.dev/config/ */
export default defineConfig(async () => ({
  build: {
    chunkSizeWarningLimit: 1000
  },
  plugins: [
    react(),
    tailwindcss(),
    // reactScan({
    //   enable: process.env.NODE_ENV === 'development',
    //   scanOptions: {
    //     enabled: process.env.NODE_ENV === 'development',
    //     log: false,
    //     showToolbar: true,
    //     animationSpeed: 'fast', //+ 'slow' | 'fast' | 'off'
    //     trackUnnecessaryRenders: true,
    //     showFPS: true,
    //     showNotificationCount: true,
    //     _debug: false
    //   },
    //   autoDisplayNames: true,
    //   debug: false,
    // }),
    checker({
      typescript: {
        root: '.',
        tsconfigPath: './tsconfig.json',
        buildMode: true,
      },
      overlay: {
        initialIsOpen: false,
        position: 'br',
      },
      terminal: true,
      eslint: {
        lintCommand: 'eslint .',
        useFlatConfig: true
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
