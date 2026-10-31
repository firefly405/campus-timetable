import { ExpoConfig } from "expo/config";
// The school's supplied URL is HTTP. Keep access opt-in per build, never disable
// ATS for the whole app. Production remains closed until an HTTPS entry is verified.
const allowSchoolHttp = process.env.ALLOW_SCHOOL_HTTP === "true";
const config: ExpoConfig = {
  name: "课序",
  slug: "campus-timetable",
  version: "0.1.0",
  scheme: "campustimetable",
  orientation: "default",
  userInterfaceStyle: "automatic",
  icon: "./assets/icon.png",
  platforms: ["ios", "web"],
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.example.campustimetable",
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: false,
        NSAllowsArbitraryLoadsInWebContent: allowSchoolHttp,
      },
    },
  },
  web: { bundler: "metro", output: "server", favicon: "./assets/favicon.png" },
  plugins: ["expo-router", "expo-notifications"],
  extra: {
    allowSchoolHttp,
    eas: { projectId: "dddc23e1-ec9a-4975-93c7-a2e18328cff0" },
  },
};
export default config;
