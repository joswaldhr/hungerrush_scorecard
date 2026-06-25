import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'HungerRush Manager Scorecard',
        short_name: 'HR Scorecard',
        theme_color: '#1E2E4A',
        background_color: '#F5F5F4',
        display: 'standalone',
        icons: [],
      },
    }),
  ],
});
