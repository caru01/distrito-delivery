import { readFileSync } from 'node:fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const sharedMapsEnv = loadEnv(mode, '../distrito-web', 'VITE_GOOGLE_MAPS_');
  const environments = JSON.parse(readFileSync(new URL('./config/api-environments.json', import.meta.url), 'utf8'));
  const environmentName = mode === 'production'
    ? 'production'
    : mode === 'android-development' ? 'androidDevelopment' : 'development';
  const environment = environments[environmentName];
  if (!environment) throw new Error(`Entorno Delivery desconocido: ${environmentName}`);
  if (environmentName === 'production') {
    const productionUrl = new URL(environment.apiUrl);
    const localHost = productionUrl.hostname === 'localhost'
      || productionUrl.hostname === '127.0.0.1'
      || productionUrl.hostname === '::1'
      || /^10\./.test(productionUrl.hostname)
      || /^192\.168\./.test(productionUrl.hostname)
      || /^172\.(1[6-9]|2\d|3[01])\./.test(productionUrl.hostname);
    if (productionUrl.protocol !== 'https:' || localHost || productionUrl.hostname !== 'api.distritobg.app') {
      throw new Error('El build de producción solo puede utilizar https://api.distritobg.app');
    }
  }
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@distrito/shared-ui': path.resolve(__dirname, 'src/shared/index.js'),
      },
      dedupe: ['react', 'react-dom', 'lucide-react', '@googlemaps/js-api-loader'],
    },
    define: {
      __DELIVERY_ENVIRONMENT__: JSON.stringify(environmentName),
      __DELIVERY_API_URL__: JSON.stringify(environment.apiUrl),
      __DELIVERY_API_PORT__: JSON.stringify(environment.apiPort),
      'import.meta.env.VITE_GOOGLE_MAPS_API_KEY': JSON.stringify(sharedMapsEnv.VITE_GOOGLE_MAPS_API_KEY || ''),
      'import.meta.env.VITE_GOOGLE_MAPS_MAP_ID': JSON.stringify(sharedMapsEnv.VITE_GOOGLE_MAPS_MAP_ID || ''),
    },
    server: { host: '0.0.0.0', port: 5175 },
    preview: { host: '0.0.0.0', port: 5175 },
  };
});

