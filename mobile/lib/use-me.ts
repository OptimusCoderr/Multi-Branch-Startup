import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: api.me });
}

export function useHasPermission(permission: string): boolean {
  const { data: me } = useMe();
  return me?.permissions.includes(permission) ?? false;
}

export function formatMoney(amount: string | number, currency: string): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  return new Intl.NumberFormat("en-NG", { style: "currency", currency }).format(value);
}
