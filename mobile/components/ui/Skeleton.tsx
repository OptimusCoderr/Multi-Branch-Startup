import { useEffect } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing } from "react-native-reanimated";
import { theme } from "@/lib/theme";

/** Base shimmer block — every skeleton preset below composes this. */
export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={[styles.base, animatedStyle, style]} />;
}

export function SkeletonText({ width = "70%" }: { width?: number | `${number}%` }) {
  return <Skeleton style={{ height: 12, width, borderRadius: 4 }} />;
}

export function SkeletonCard() {
  return (
    <View style={styles.card}>
      <SkeletonText width="50%" />
      <SkeletonText width="80%" />
      <SkeletonText width="35%" />
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: theme.border, borderRadius: theme.radius.sm },
  card: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
});
