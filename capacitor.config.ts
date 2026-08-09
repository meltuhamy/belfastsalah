import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.meltuhamy.londonsalah",
  appName: "Prayer Times",
  webDir: "build",
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_name",
    },
    SplashScreen: {
      launchShowDuration: 3000,
      androidScaleType: "CENTER_CROP",
      backgroundColor: "#002541",
    },
  },
};

export default config;
