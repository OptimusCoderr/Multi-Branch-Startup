import { Stack } from "expo-router";

export default function CustomersLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Customers" }} />
      <Stack.Screen name="new" options={{ title: "New customer", presentation: "modal" }} />
      <Stack.Screen name="[id]" options={{ title: "Customer" }} />
    </Stack>
  );
}
