import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Alert } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Users, Lock, Check } from "lucide-react-native";
import { api } from "@/lib/api";
import { useMe } from "@/lib/use-me";
import { theme } from "@/lib/theme";
import {
  listDeviceProfiles,
  getActiveProfileId,
  activateDeviceProfile,
  removeDeviceProfile,
  type DeviceProfile,
} from "@/lib/device-profiles";
import { Button, Card, Field, Input, ListItem } from "@/components/ui";

/**
 * Fast shift-switching for a shared shop phone: every staff member who has
 * ever fully signed in on this device shows up here. Switching to someone
 * else only requires their quick-switch PIN, not a full email/password
 * re-login — see lib/device-profiles.ts for why that's safe (it's gating
 * an already-established session, not creating a new one).
 */
export default function SwitchUserScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: me } = useMe();

  const [profiles, setProfiles] = useState<DeviceProfile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinSaveError, setPinSaveError] = useState<string | null>(null);
  const [isSavingPin, setIsSavingPin] = useState(false);
  const [pinSaved, setPinSaved] = useState(false);

  async function loadProfiles() {
    const [list, active] = await Promise.all([listDeviceProfiles(), getActiveProfileId()]);
    setProfiles(list);
    setActiveId(active);
  }

  useEffect(() => {
    loadProfiles();
  }, []);

  function startSwitch(membershipId: string) {
    setSwitchingId(membershipId);
    setPin("");
    setSwitchError(null);
  }

  async function confirmSwitch() {
    if (!switchingId) return;
    setIsVerifying(true);
    setSwitchError(null);
    try {
      const { verified } = await api.verifyDevicePin(switchingId, pin);
      if (!verified) {
        setSwitchError("Incorrect PIN.");
        return;
      }
      const ok = await activateDeviceProfile(switchingId);
      if (!ok) {
        setSwitchError("Could not switch — try signing in again on this device.");
        return;
      }
      await queryClient.invalidateQueries();
      setSwitchingId(null);
      router.back();
    } catch {
      setSwitchError("Could not verify that PIN. Check your connection and try again.");
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleRemove(membershipId: string) {
    Alert.alert("Remove from this device?", "You'll need to sign in with a password again to use this profile on this device.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await removeDeviceProfile(membershipId);
          await loadProfiles();
        },
      },
    ]);
  }

  async function handleSavePin() {
    setPinSaveError(null);
    setPinSaved(false);
    if (!/^\d{4,6}$/.test(newPin)) {
      setPinSaveError("PIN must be 4-6 digits.");
      return;
    }
    if (newPin !== confirmPin) {
      setPinSaveError("PINs don't match.");
      return;
    }
    setIsSavingPin(true);
    try {
      await api.setDevicePin(newPin);
      setPinSaved(true);
      setNewPin("");
      setConfirmPin("");
    } catch (err) {
      setPinSaveError(err instanceof Error ? err.message : "Could not save your PIN.");
    } finally {
      setIsSavingPin(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
      <View>
        <Text style={styles.title}>Switch user</Text>
        <Text style={styles.muted}>Fast-switch between staff already signed in on this phone.</Text>
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        {profiles.map((p) => {
          const isActive = p.membershipId === activeId;
          const isSwitching = switchingId === p.membershipId;
          return (
            <View key={p.membershipId}>
              <ListItem
                title={p.displayName}
                subtitle={p.companyName}
                onPress={() => (isActive ? undefined : startSwitch(p.membershipId))}
                trailing={
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    {isActive ? <Check size={18} color={theme.success} /> : <Lock size={16} color={theme.textFaint} />}
                    <Text style={styles.removeLink} onPress={() => handleRemove(p.membershipId)}>
                      Remove
                    </Text>
                  </View>
                }
              />
              {isSwitching && (
                <Card style={{ marginTop: theme.spacing.sm, gap: theme.spacing.sm }}>
                  <Field label={`Enter ${p.displayName}'s PIN`}>
                    <Input keyboardType="number-pad" secureTextEntry maxLength={6} value={pin} onChangeText={setPin} autoFocus />
                  </Field>
                  {switchError && <Text style={styles.error}>{switchError}</Text>}
                  <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
                    <Button label="Switch" onPress={confirmSwitch} isLoading={isVerifying} style={{ flex: 1 }} />
                    <Button label="Cancel" variant="secondary" onPress={() => setSwitchingId(null)} style={{ flex: 1 }} />
                  </View>
                </Card>
              )}
            </View>
          );
        })}
        {profiles.length === 0 && <Text style={styles.muted}>No other profiles on this device yet.</Text>}
      </View>

      <Card style={{ gap: theme.spacing.sm }}>
        <View style={styles.cardHeader}>
          <Users size={16} color={theme.textMuted} />
          <Text style={styles.cardTitle}>{me ? `Set ${me.displayName}'s quick-switch PIN` : "Set your quick-switch PIN"}</Text>
        </View>
        <Text style={styles.muted}>Lets you switch back to your profile on this phone with just a PIN, no password.</Text>
        <Field label="New PIN (4-6 digits)">
          <Input keyboardType="number-pad" secureTextEntry maxLength={6} value={newPin} onChangeText={setNewPin} />
        </Field>
        <Field label="Confirm PIN">
          <Input keyboardType="number-pad" secureTextEntry maxLength={6} value={confirmPin} onChangeText={setConfirmPin} />
        </Field>
        {pinSaveError && <Text style={styles.error}>{pinSaveError}</Text>}
        {pinSaved && <Text style={styles.success}>PIN saved.</Text>}
        <Button label="Save PIN" variant="secondary" onPress={handleSavePin} isLoading={isSavingPin} />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.surface },
  title: { fontSize: theme.font.h1, fontWeight: "700", color: theme.textPrimary },
  muted: { color: theme.textFaint, fontSize: theme.font.caption, marginTop: 2 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardTitle: { fontWeight: "600", color: theme.textPrimary },
  error: { color: theme.danger, fontSize: theme.font.caption },
  success: { color: theme.success, fontSize: theme.font.caption },
  removeLink: { color: theme.danger, fontSize: theme.font.micro },
});
