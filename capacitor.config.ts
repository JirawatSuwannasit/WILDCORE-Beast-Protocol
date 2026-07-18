import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.wildcore.beastprotocol',
  appName: 'WILDCORE',
  webDir: 'dist',
  backgroundColor: '#14201c',
  android: {
    backgroundColor: '#14201c',
  },
  plugins: {
    StatusBar: {
      overlaysWebView: true,
      style: 'DARK',
      backgroundColor: '#00000000',
    },
  },
};

export default config;
