import type { CapacitorConfig } from '@capacitor/cli';

const development = process.env.CAPACITOR_BUILD_ENV === 'development';

const config: CapacitorConfig = {
  appId: 'com.distritobg.delivery',
  appName: 'DistritoBG Delivery',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    hostname: development ? 'localhost' : 'delivery.distritobg.app',
  },
  android: {
    allowMixedContent: development,
    backgroundColor: '#0d0d0f',
  },
};

export default config;
