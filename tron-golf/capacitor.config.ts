import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tronn.golf',
  appName: 'TRON Golf',
  webDir: 'dist',
  android: {
    backgroundColor: '#000820',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
    },
  },
};

export default config;
