import { Tabs } from "expo-router";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, ShoppingCart, Boxes, Users, Settings } from "lucide-react-native";
import { api } from "@/lib/api";
import { signOutEverywhere } from "@/lib/device-profiles";
import { theme } from "@/lib/theme";
import { TabBar } from "@/components/ui/TabBar";
import { useAutoSyncOfflineQueue } from "@/lib/network-status";

export default function AppLayout() {
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: api.me });
  const queryClient = useQueryClient();

  // Whenever the device regains connectivity or the app comes back to the
  // foreground, flush anything recorded offline — wherever the user
  // currently is in the app, not just the Sales tab.
  useAutoSyncOfflineQueue(() => {
    queryClient.invalidateQueries({ queryKey: ["offline-queue"] });
    queryClient.invalidateQueries({ queryKey: ["sales"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  });

  return (
    <View style={{ flex: 1 }}>
      {me && !me.subscriptionActive && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            {me.companyName}&apos;s subscription needs attention. Manage billing on the web app.
          </Text>
          <Pressable onPress={() => signOutEverywhere()}>
            <Text style={styles.signOut}>Sign out</Text>
          </Pressable>
        </View>
      )}
      <Tabs tabBar={(props) => <TabBar {...props} />}>
        <Tabs.Screen name="index" options={{ title: "Dashboard", tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} /> }} />
        <Tabs.Screen name="sales" options={{ title: "Sales", tabBarIcon: ({ color, size }) => <ShoppingCart color={color} size={size} /> }} />
        <Tabs.Screen name="stock" options={{ title: "Stock", tabBarIcon: ({ color, size }) => <Boxes color={color} size={size} /> }} />
        <Tabs.Screen name="customers" options={{ title: "Customers", tabBarIcon: ({ color, size }) => <Users color={color} size={size} /> }} />
        <Tabs.Screen name="printer" options={{ title: "Settings", tabBarIcon: ({ color, size }) => <Settings color={color} size={size} /> }} />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: "#fef2f2",
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bannerText: { color: "#b91c1c", fontSize: 12, flex: 1 },
  signOut: { color: "#b91c1c", fontSize: 12, fontWeight: "600", marginLeft: 8 },
});
