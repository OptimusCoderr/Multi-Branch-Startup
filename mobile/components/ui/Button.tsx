import { useCallback } from "react";
import { Pressable, Text, StyleSheet, ActivityIndicator, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import type { LucideIcon } from "lucide-react-native";
import { theme } from "@/lib/theme";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md";

type ButtonProps = Omit<PressableProps, "style"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  label: string;
  icon?: LucideIcon;
  style?: StyleProp<ViewStyle>;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Reanimated press-scale wrapper shared by every button in the app — a tasteful, consistent tap-feedback affordance. */
export function Button({ variant = "primary", size = "md", isLoading = false, label, icon: Icon, disabled, style, onPressIn, onPressOut, ...props }: ButtonProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePressIn = useCallback(
    (e: Parameters<NonNullable<PressableProps["onPressIn"]>>[0]) => {
      scale.value = withSpring(0.97, { damping: 15, stiffness: 300 });
      onPressIn?.(e);
    },
    [onPressIn, scale],
  );
  const handlePressOut = useCallback(
    (e: Parameters<NonNullable<PressableProps["onPressOut"]>>[0]) => {
      scale.value = withSpring(1, { damping: 15, stiffness: 300 });
      onPressOut?.(e);
    },
    [onPressOut, scale],
  );

  const isDisabled = disabled || isLoading;

  return (
    <AnimatedPressable
      {...props}
      disabled={isDisabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.base, VARIANT_STYLES[variant], SIZE_STYLES[size], isDisabled && styles.disabled, animatedStyle, style]}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color={variant === "primary" || variant === "danger" ? "#fff" : theme.primary} />
      ) : (
        <>
          {Icon && <Icon size={size === "sm" ? 14 : 16} color={LABEL_VARIANT_STYLES[variant].color} />}
          <Text style={[styles.label, LABEL_VARIANT_STYLES[variant], size === "sm" && styles.labelSm]}>{label}</Text>
        </>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: { flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: theme.radius.xl, gap: 6 },
  disabled: { opacity: 0.5 },
  label: { fontWeight: "600", fontSize: theme.font.body },
  labelSm: { fontSize: theme.font.caption },
});

const VARIANT_STYLES: Record<ButtonVariant, ViewStyle> = {
  primary: { backgroundColor: theme.primary },
  secondary: { backgroundColor: "transparent", borderWidth: 1, borderColor: theme.borderStrong },
  danger: { backgroundColor: theme.danger },
  ghost: { backgroundColor: "transparent" },
};

const LABEL_VARIANT_STYLES: Record<ButtonVariant, { color: string }> = {
  primary: { color: "#fff" },
  secondary: { color: theme.textPrimary },
  danger: { color: "#fff" },
  ghost: { color: theme.primary },
};

const SIZE_STYLES: Record<ButtonSize, ViewStyle> = {
  sm: { paddingVertical: 8, paddingHorizontal: 12 },
  md: { paddingVertical: 12, paddingHorizontal: 16 },
};
