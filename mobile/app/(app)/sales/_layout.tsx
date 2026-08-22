import { Stack } from "expo-router";

export default function SalesLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Sales" }} />
      <Stack.Screen name="new" options={{ title: "Record sale", presentation: "modal" }} />
      <Stack.Screen name="report" options={{ title: "Daily report", presentation: "modal" }} />
      <Stack.Screen name="[id]" options={{ title: "Sale" }} />
    </Stack>
  );
}
