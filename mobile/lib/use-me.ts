import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { registerCurrentDeviceProfile } from "./device-profiles";

export function useMe() {
  const query = useQuery({ queryKey: ["me"], queryFn: api.me });

  // Remembers this profile on this device (name + a copy of its session
  // cookie) every time `me` resolves, so it shows up in "Switch user"
  // later — see device-profiles.ts. Cheap and idempotent; safe to run on
  // every successful fetch, not just the first.
  useEffect(() => {
    if (!query.data) return;
    registerCurrentDeviceProfile({
      membershipId: query.data.membershipId,
      displayName: query.data.displayName,
      companyName: query.data.companyName,
    });
  }, [query.data]);

  return query;
}

export function useHasPermission(permission: string): boolean {
  const { data: me } = useMe();
  return me?.permissions.includes(permission) ?? false;
}

export function formatMoney(amount: string | number, currency: string): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  return new Intl.NumberFormat("en-NG", { style: "currency", currency }).format(value);
}

/** "3 cartons" / "45 units" — see the web counterpart in src/lib/format.ts for why this is a naive +s rather than a pluralization library. */
export function formatQuantity(quantity: number, unitLabel: string): string {
  const label = unitLabel.trim() || "unit";
  const plural = quantity === 1 || label.endsWith("s") ? label : `${label}s`;
  return `${quantity} ${plural}`;
}
