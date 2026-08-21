import { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, type LayoutChangeEvent } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { theme } from "@/lib/theme";

/**
 * Loose duck-typed props matching react-navigation's BottomTabBarProps
 * (state/descriptors/navigation/insets) — expo-router's Tabs forwards a
 * `tabBar` render prop straight through to the underlying bottom-tabs
 * navigator, but that type isn't part of expo-router's public export
 * surface, so it's typed locally here rather than deep-importing an
 * internal build path.
 */
type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  descriptors: Record<
    string,
    {
      options: {
        title?: string;
        tabBarIcon?: (props: { focused: boolean; color: string; size: number }) => React.ReactNode;
        tabBarButton?: unknown;
      };
    }
  >;
  navigation: {
    emit: (event: { type: "tabPress" | "tabLongPress"; target: string; canPreventDefault?: boolean }) => unknown;
    navigate: (name: string) => void;
  };
  insets: { bottom: number };
};

export function TabBar({ state, descriptors, navigation, insets }: TabBarProps) {
  const [tabWidth, setTabWidth] = useState(0);
  const indicatorX = useSharedValue(0);

  function handleLayout(event: LayoutChangeEvent) {
    const width = event.nativeEvent.layout.width / state.routes.length;
    setTabWidth(width);
  }

  const indicatorStyle = useAnimatedStyle(() => ({ transform: [{ translateX: indicatorX.value }] }));

  useEffect(() => {
    if (tabWidth > 0) indicatorX.value = withSpring(state.index * tabWidth, { damping: 20, stiffness: 260 });
  }, [state.index, tabWidth, indicatorX]);

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom || theme.spacing.sm }]} onLayout={handleLayout}>
      {tabWidth > 0 && (
        <Animated.View
          style={[
            styles.indicator,
            indicatorStyle,
            { width: tabWidth - theme.spacing.md, marginLeft: theme.spacing.sm / 2 },
          ]}
        />
      )}
      {state.routes.map((route, index) => {
        const options = descriptors[route.key].options;
        const isFocused = state.index === index;
        const color = isFocused ? theme.primary : theme.textFaint;

        function onPress() {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true }) as { defaultPrevented?: boolean };
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        }

        return (
          <Pressable key={route.key} onPress={onPress} style={styles.tab}>
            {options.tabBarIcon?.({ focused: isFocused, color, size: 22 })}
            <Text style={[styles.label, { color }]} numberOfLines={1}>
              {options.title ?? route.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: theme.border,
    backgroundColor: theme.surface,
    paddingTop: theme.spacing.sm,
  },
  indicator: {
    position: "absolute",
    top: 2,
    height: 3,
    borderRadius: theme.radius.full,
    backgroundColor: theme.primary,
  },
  tab: { flex: 1, alignItems: "center", gap: 2 },
  label: { fontSize: theme.font.micro, fontWeight: "600" },
});
