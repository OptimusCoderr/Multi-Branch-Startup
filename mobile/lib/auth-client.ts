import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";

const apiBaseUrl = (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ?? "http://localhost:3000";

/**
 * React Native has no browser cookie jar, so the Expo client plugin
 * emulates one on top of expo-secure-store: it captures the server's
 * Set-Cookie on sign-in/sign-up and replays it as a Cookie header on
 * every request the client itself makes (to /api/auth/*). For the app's
 * own /api/mobile/v1/* calls (lib/api.ts), we read that same cookie back
 * out via authClient.getCookie() and attach it by hand — that's the one
 * documented escape hatch for calling anything outside the auth client's
 * own request plumbing.
 */
export const authClient = createAuthClient({
  baseURL: apiBaseUrl,
  plugins: [
    expoClient({
      scheme: "multibranchinventory",
      storage: SecureStore,
    }),
  ],
});

export const { signIn, signOut, useSession } = authClient;
export { apiBaseUrl };
