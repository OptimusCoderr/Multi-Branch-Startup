import { authClient, apiBaseUrl } from "./auth-client";
import { getActiveOverrideCookie } from "./device-profiles";

export class ApiRequestError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  // getActiveOverrideCookie() is set only after a quick-switch profile PIN
  // verifies (see device-profiles.ts) — every /api/mobile/v1/* call then
  // acts as that profile until switched again, while sign-in state itself
  // (useSession/authClient) is untouched.
  const cookie = getActiveOverrideCookie() ?? (await authClient.getCookie());

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      cookie,
      ...options.headers,
    },
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiRequestError(body?.error ?? "Something went wrong.", response.status);
  }

  return body as T;
}

export type Me = {
  membershipId: string;
  displayName: string;
  companyId: string;
  companyName: string;
  companyCurrency: string;
  roleName: string | null;
  permissions: string[];
  subscriptionActive: boolean;
  subscriptionStatus: string | null;
};

export type DashboardSummary = {
  companyName: string;
  companyCurrency: string;
  todaysSalesCount: number;
  todaysSalesTotal: string;
  todaysExpensesTotal: string;
  todaysProfit: string;
  totalOutstandingDebt: string;
  debtorCount: number;
};

export type Branch = { id: string; name: string; address: string | null; phone: string | null };
export type Product = { id: string; sku: string; barcode: string | null; name: string; description: string | null; unitPrice: string; unitLabel: string };

export type StockProduct = {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  unitLabel: string;
  warehouseStocks: { warehouseId: string; warehouseName: string; quantity: number }[];
  branchStocks: { branchId: string; branchName: string; quantity: number }[];
};

export type SaleSummary = {
  id: string;
  saleNumber: string;
  branchName: string;
  customerName: string | null;
  status: string;
  grandTotal: string;
  amountPaid: string;
  createdAt: string;
};

export type CreditNote = {
  id: string;
  creditNoteNumber: string;
  amount: string;
  reason: string;
  status: "ISSUED" | "VOIDED";
  issuedByName: string;
  voidedByName: string | null;
  voidReason: string | null;
  createdAt: string;
};

export type SaleDetail = {
  id: string;
  saleNumber: string;
  branchName: string;
  customerName: string | null;
  customerPhone: string | null;
  status: string;
  voidReason: string | null;
  subtotal: string;
  grandTotal: string;
  amountPaid: string;
  dueDate: string | null;
  createdAt: string;
  lineItems: { productName: string | null; isService: boolean; quantity: number; unitPriceAtSale: string; lineTotal: string }[];
  payments: { id: string; amount: string; mode: string; paidAt: string }[];
  creditNotes: CreditNote[];
};

export type CreateSaleInput = {
  branchId: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  lineItems: { productId?: string; quantity: number; description?: string; unitPrice?: number }[];
  // Set by the offline sync queue (lib/offline-queue.ts) so a retried sync
  // request reuses the original Sale instead of creating a duplicate.
  clientRequestId?: string;
};

export type SalesReportBranchPreview = {
  branchId: string;
  branchName: string;
  salesCount: number;
  grossSalesTotal: string;
  paymentsCollected: string;
  cashCollected: string;
  reportId: string | null;
  reportStatus: string | null;
};

export type SalesReportSummary = {
  id: string;
  branchName: string;
  reportDate: string;
  status: string;
  salesCount: number;
  grossSalesTotal: string;
  cashCollected: string;
  declaredCash: string | null;
  cashDiscrepancy: string | null;
  staffNote: string | null;
  ownerNote: string | null;
  submittedAt: string;
  respondedAt: string | null;
};

export type CustomerSummary = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  outstanding: string;
  overdueSaleCount: number;
};

export type CustomerDetail = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  remindersEnabled: boolean;
  outstanding: string;
  openSaleCount: number;
  overdueSaleCount: number;
  sales: { id: string; saleNumber: string; branchName: string; status: string; grandTotal: string; amountPaid: string; dueDate: string | null }[];
};

export const api = {
  me: () => request<Me>("/api/mobile/v1/me"),
  dashboard: () => request<DashboardSummary>("/api/mobile/v1/dashboard"),
  branches: () => request<{ branches: Branch[] }>("/api/mobile/v1/branches"),
  products: () => request<{ products: Product[] }>("/api/mobile/v1/products"),
  stock: () => request<{ products: StockProduct[] }>("/api/mobile/v1/stock"),

  sales: () => request<{ sales: SaleSummary[] }>("/api/mobile/v1/sales"),
  sale: (id: string) => request<SaleDetail>(`/api/mobile/v1/sales/${id}`),
  createSale: (input: CreateSaleInput) =>
    request<{ saleId: string }>("/api/mobile/v1/sales", { method: "POST", body: JSON.stringify(input) }),
  recordPayment: (saleId: string, input: { amount: number; mode: string; reference?: string; notes?: string }) =>
    request<{ paymentId: string }>(`/api/mobile/v1/sales/${saleId}/payments`, { method: "POST", body: JSON.stringify(input) }),
  issueCreditNote: (saleId: string, input: { amount: number; reason: string }) =>
    request<{ creditNoteId: string }>(`/api/mobile/v1/sales/${saleId}/credit-notes`, { method: "POST", body: JSON.stringify(input) }),
  voidCreditNote: (creditNoteId: string, input: { reason: string }) =>
    request<{ ok: true }>(`/api/mobile/v1/credit-notes/${creditNoteId}/void`, { method: "POST", body: JSON.stringify(input) }),

  todaysSalesReportPreview: () =>
    request<{ businessDate: string; branches: SalesReportBranchPreview[] }>("/api/mobile/v1/sales/report"),
  submitSalesReport: (input: { branchId: string; declaredCash?: number; staffNote?: string }) =>
    request<{ reportId: string; status: string }>("/api/mobile/v1/sales/report", { method: "POST", body: JSON.stringify(input) }),
  myReports: () => request<{ reports: SalesReportSummary[] }>("/api/mobile/v1/sales/reports"),

  customers: () => request<{ customers: CustomerSummary[] }>("/api/mobile/v1/customers"),
  customer: (id: string) => request<CustomerDetail>(`/api/mobile/v1/customers/${id}`),
  createCustomer: (input: { name: string; phone?: string; email?: string }) =>
    request<{ customerId: string }>("/api/mobile/v1/customers", { method: "POST", body: JSON.stringify(input) }),

  adjustStock: (input: { productId: string; branchId: string; delta: number; reason?: string }) =>
    request<{ ok: true }>("/api/mobile/v1/stock/adjust", { method: "POST", body: JSON.stringify(input) }),

  setDevicePin: (pin: string) => request<{ ok: true }>("/api/mobile/v1/device-pin", { method: "POST", body: JSON.stringify({ pin }) }),
  verifyDevicePin: (membershipId: string, pin: string) =>
    request<{ verified: boolean }>("/api/mobile/v1/device-pin/verify", { method: "POST", body: JSON.stringify({ membershipId, pin }) }),
};
