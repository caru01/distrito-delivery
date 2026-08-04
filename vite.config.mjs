import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const sharedMapsEnv = loadEnv(mode, '../distrito-web', 'VITE_GOOGLE_MAPS_');
  return {
    plugins: [react()],
    resolve: { dedupe: ['react', 'react-dom', 'lucide-react', '@googlemaps/js-api-loader'] },
    define: {
      'import.meta.env.VITE_GOOGLE_MAPS_API_KEY': JSON.stringify(sharedMapsEnv.VITE_GOOGLE_MAPS_API_KEY || ''),
      'import.meta.env.VITE_GOOGLE_MAPS_MAP_ID': JSON.stringify(sharedMapsEnv.VITE_GOOGLE_MAPS_MAP_ID || ''),
    },
    server: { host: '0.0.0.0', port: 5175 },
    preview: { host: '0.0.0.0', port: 5175 },
  };
});
