export function formatMoney(amount: number | string, currency: string): string {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency }).format(Number(amount));
}
