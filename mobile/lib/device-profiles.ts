import * as SecureStore from "expo-secure-store";
import { authClient, signOut as authSignOut } from "./auth-client";

const PROFILES_KEY = "device-profiles.v1";
const ACTIVE_PROFILE_KEY = "active-device-profile-id.v1";

export type DeviceProfile = {
  membershipId: string;
  displayName: string;
  companyName: string;
  // The raw Cookie header for this profile's own real, already-established
  // session — captured once at sign-in. A quick-switch PIN never issues a
  // session on its own; it only gates re-selecting one of these.
  cookie: string;
};

async function readProfiles(): Promise<DeviceProfile[]> {
  const raw = await SecureStore.getItemAsync(PROFILES_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as DeviceProfile[];
  } catch {
    return [];
  }
}

async function writeProfiles(profiles: DeviceProfile[]): Promise<void> {
  await SecureStore.setItemAsync(PROFILES_KEY, JSON.stringify(profiles));
}

export async function listDeviceProfiles(): Promise<DeviceProfile[]> {
  return readProfiles();
}

/**
 * Call this once a normal sign-in completes and /api/mobile/v1/me has
 * resolved — remembers this profile on THIS device so it shows up in the
 * "Switch user" list later. Safe to call every time `me` loads; it just
 * refreshes the stored cookie if it changed.
 */
export async function registerCurrentDeviceProfile(input: { membershipId: string; displayName: string; companyName: string }): Promise<void> {
  const cookie = await authClient.getCookie();
  if (!cookie) return;
  const profiles = await readProfiles();
  const next = [...profiles.filter((p) => p.membershipId !== input.membershipId), { ...input, cookie }];
  await writeProfiles(next);
  await SecureStore.setItemAsync(ACTIVE_PROFILE_KEY, input.membershipId);
}

export async function removeDeviceProfile(membershipId: string): Promise<void> {
  const profiles = await readProfiles();
  await writeProfiles(profiles.filter((p) => p.membershipId !== membershipId));
  if ((await getActiveProfileId()) === membershipId) {
    clearActiveOverride();
    await SecureStore.deleteItemAsync(ACTIVE_PROFILE_KEY);
  }
}

export async function getActiveProfileId(): Promise<string | null> {
  return SecureStore.getItemAsync(ACTIVE_PROFILE_KEY);
}

// In-memory only — lib/api.ts's request() reads this to override which
// session's cookie is sent on /api/mobile/v1/* calls after a profile
// switch. Deliberately NOT plumbed into authClient/useSession: the
// underlying Better Auth session used for sign-in-state, sign-out, and
// 2FA management stays whoever actually typed a password most recently on
// this device — switching profiles is a fast re-auth convenience for the
// day-to-day app, not a full account swap.
let activeOverrideCookie: string | null = null;

export function getActiveOverrideCookie(): string | null {
  return activeOverrideCookie;
}

export function clearActiveOverride(): void {
  activeOverrideCookie = null;
}

/** Switch which stored profile's session lib/api.ts uses — call only after device-pin/verify has confirmed the PIN. */
export async function activateDeviceProfile(membershipId: string): Promise<boolean> {
  const profiles = await readProfiles();
  const profile = profiles.find((p) => p.membershipId === membershipId);
  if (!profile) return false;
  activeOverrideCookie = profile.cookie;
  await SecureStore.setItemAsync(ACTIVE_PROFILE_KEY, membershipId);
  return true;
}

/** Full sign-out: clears every profile this device remembered, not just the active one — a shared phone shouldn't keep other staff's sessions around after someone signs out for real. */
export async function signOutEverywhere(): Promise<void> {
  clearActiveOverride();
  await SecureStore.deleteItemAsync(PROFILES_KEY);
  await SecureStore.deleteItemAsync(ACTIVE_PROFILE_KEY);
  await authSignOut();
}
