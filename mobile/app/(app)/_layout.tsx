import { Tabs } from "expo-router";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { signOut } from "@/lib/auth-client";

export default function AppLayout() {
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: api.me });

  return (
    <View style={{ flex: 1 }}>
      {me && !me.subscriptionActive && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            {me.companyName}&apos;s subscription needs attention. Manage billing on the web app.
          </Text>
          <Pressable onPress={() => signOut()}>
            <Text style={styles.signOut}>Sign out</Text>
          </Pressable>
        </View>
      )}
      <Tabs screenOptions={{ tabBarActiveTintColor: "#171717" }}>
        <Tabs.Screen name="index" options={{ title: "Dashboard" }} />
        <Tabs.Screen name="sales" options={{ title: "Sales" }} />
        <Tabs.Screen name="stock" options={{ title: "Stock" }} />
        <Tabs.Screen name="customers" options={{ title: "Customers" }} />
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
