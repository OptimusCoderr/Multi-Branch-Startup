import "react-native-gesture-handler";
import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { queryClient } from "@/lib/query-client";
import { useSession } from "@/lib/auth-client";

/**
 * Gate the whole app on session state: signed-out users only ever see
 * /sign-in, signed-in users only ever see the (app) group. Mirrors what
 * proxy.ts + requireMembership() do for the web app, just expressed as a
 * client-side redirect since there's no server-rendered route group to
 * redirect within on a native client.
 */
function AuthGate({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isPending) return;

    const inAuthenticatedGroup = segments[0] === "(app)";

    if (!session && inAuthenticatedGroup) {
      router.replace("/sign-in");
    } else if (session && !inAuthenticatedGroup) {
      router.replace("/(app)");
    }
  }, [session, isPending, segments, router]);

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthGate>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="sign-in" />
              <Stack.Screen name="(app)" />
            </Stack>
          </AuthGate>
          <StatusBar style="auto" />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
