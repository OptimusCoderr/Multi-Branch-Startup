/**
 * Fixed, code-defined permission catalog. This is the single source of
 * truth for permission keys — kept in sync with the seeded `Permission`
 * rows in prisma/seed.ts (the seed script asserts they match). Companies
 * cannot invent new permissions; they can only grant/deny these to staff.
 */
export const PERMISSIONS = {
  // Inventory: catalog + locations
  PRODUCTS_VIEW: "products.view",
  PRODUCTS_CREATE: "products.create",
  PRODUCTS_EDIT: "products.edit",
  PRODUCTS_DEACTIVATE: "products.deactivate",
  WAREHOUSES_MANAGE: "warehouses.manage",
  BRANCHES_MANAGE: "branches.manage",
  STOCK_LEVELS_VIEW: "stock_levels.view",

  // Stock transfers
  TRANSFERS_REQUEST: "transfers.request",
  TRANSFERS_APPROVE: "transfers.approve",
  TRANSFERS_DISPATCH: "transfers.dispatch",
  TRANSFERS_RECEIVE: "transfers.receive",
  TRANSFERS_RECEIVE_EXTERNAL: "transfers.receive_external",

  // Sales & payments
  SALES_RECORD: "sales.record",
  SALES_VOID: "sales.void",
  SALES_OVERRIDE_PRICE: "sales.override_price",
  // Search the sales list by an arbitrary date range, beyond whatever the
  // role's default view window is (today/this week/unrestricted — see
  // sales/page.tsx). Cashier never gets this.
  SALES_DATE_SEARCH: "sales.date_search",
  // Export the sales list to CSV — narrower than REPORTS_VIEW (which also
  // covers the general /reports page): a Branch Manager can see reports
  // but shouldn't be able to export the raw sales ledger.
  SALES_EXPORT: "sales.export",
  PAYMENTS_RECORD: "payments.record",
  CREDIT_NOTES_ISSUE: "credit_notes.issue",
  CREDIT_NOTES_VOID: "credit_notes.void",

  // Customers & debt
  CUSTOMERS_VIEW: "customers.view",
  CUSTOMERS_MANAGE: "customers.manage",

  // Purchase orders & suppliers
  PURCHASE_ORDERS_VIEW: "purchase_orders.view",
  PURCHASE_ORDERS_MANAGE: "purchase_orders.manage",
  PURCHASE_ORDERS_RECEIVE: "purchase_orders.receive",

  // End-of-day sales reports
  SALES_REPORTS_SUBMIT: "sales_reports.submit",
  SALES_REPORTS_VIEW: "sales_reports.view",
  SALES_REPORTS_APPROVE: "sales_reports.approve",

  // Expenses
  EXPENSES_VIEW: "expenses.view",
  EXPENSES_MANAGE: "expenses.manage",

  // Staff & access control
  STAFF_INVITE: "staff.invite",
  STAFF_REMOVE: "staff.remove",
  STAFF_MANAGE_ROLES: "staff.manage_roles",
  STAFF_MANAGE_PERMISSIONS: "staff.manage_permissions",

  // Settings & platform
  SETTINGS_BRANDING: "settings.branding",
  SETTINGS_COMPANY: "settings.company",
  BILLING_MANAGE: "billing.manage",
  REPORTS_VIEW: "reports.view",
  AUDIT_LOG_VIEW: "audit_log.view",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_CATALOG: {
  key: PermissionKey;
  category: string;
  description: string;
}[] = [
  { key: PERMISSIONS.PRODUCTS_VIEW, category: "inventory", description: "View products and prices" },
  { key: PERMISSIONS.PRODUCTS_CREATE, category: "inventory", description: "Create new products" },
  { key: PERMISSIONS.PRODUCTS_EDIT, category: "inventory", description: "Edit existing products" },
  { key: PERMISSIONS.PRODUCTS_DEACTIVATE, category: "inventory", description: "Deactivate/archive products" },
  { key: PERMISSIONS.WAREHOUSES_MANAGE, category: "inventory", description: "Create and manage warehouses" },
  { key: PERMISSIONS.BRANCHES_MANAGE, category: "inventory", description: "Create and manage branches" },
  { key: PERMISSIONS.STOCK_LEVELS_VIEW, category: "inventory", description: "View stock levels across locations" },

  { key: PERMISSIONS.TRANSFERS_REQUEST, category: "transfers", description: "Request a stock transfer" },
  { key: PERMISSIONS.TRANSFERS_APPROVE, category: "transfers", description: "Approve or reject a stock transfer" },
  { key: PERMISSIONS.TRANSFERS_DISPATCH, category: "transfers", description: "Mark a transfer as dispatched" },
  { key: PERMISSIONS.TRANSFERS_RECEIVE, category: "transfers", description: "Receive a warehouse-sourced transfer" },
  {
    key: PERMISSIONS.TRANSFERS_RECEIVE_EXTERNAL,
    category: "transfers",
    description: "Receive stock directly from an external/supplier source",
  },

  { key: PERMISSIONS.SALES_RECORD, category: "sales", description: "Record a sale" },
  { key: PERMISSIONS.SALES_VOID, category: "sales", description: "Void a sale" },
  { key: PERMISSIONS.SALES_OVERRIDE_PRICE, category: "sales", description: "Override a product's price on a sale" },
  { key: PERMISSIONS.SALES_DATE_SEARCH, category: "sales", description: "Search the sales list by a custom date range" },
  { key: PERMISSIONS.SALES_EXPORT, category: "sales", description: "Export the sales list to CSV" },
  { key: PERMISSIONS.PAYMENTS_RECORD, category: "sales", description: "Record a payment against a sale" },
  { key: PERMISSIONS.CREDIT_NOTES_ISSUE, category: "sales", description: "Issue a credit note against a sale" },
  { key: PERMISSIONS.CREDIT_NOTES_VOID, category: "sales", description: "Void a previously issued credit note" },

  { key: PERMISSIONS.CUSTOMERS_VIEW, category: "customers", description: "View customers and their outstanding balances" },
  { key: PERMISSIONS.CUSTOMERS_MANAGE, category: "customers", description: "Create and edit customer records" },

  { key: PERMISSIONS.PURCHASE_ORDERS_VIEW, category: "purchase_orders", description: "View purchase orders and suppliers" },
  {
    key: PERMISSIONS.PURCHASE_ORDERS_MANAGE,
    category: "purchase_orders",
    description: "Create and cancel purchase orders, manage suppliers",
  },
  { key: PERMISSIONS.PURCHASE_ORDERS_RECEIVE, category: "purchase_orders", description: "Receive purchase order line items" },

  { key: PERMISSIONS.SALES_REPORTS_SUBMIT, category: "sales_reports", description: "Submit your own end-of-day sales report" },
  {
    key: PERMISSIONS.SALES_REPORTS_VIEW,
    category: "sales_reports",
    description: "View other staff's submitted sales reports (everyone can always see their own)",
  },
  {
    key: PERMISSIONS.SALES_REPORTS_APPROVE,
    category: "sales_reports",
    description: "Approve, send back, or reject a submitted sales report",
  },

  { key: PERMISSIONS.EXPENSES_VIEW, category: "expenses", description: "View recorded business expenses" },
  { key: PERMISSIONS.EXPENSES_MANAGE, category: "expenses", description: "Record, categorize, and void expenses" },

  { key: PERMISSIONS.STAFF_INVITE, category: "staff", description: "Invite new staff members" },
  { key: PERMISSIONS.STAFF_REMOVE, category: "staff", description: "Remove or suspend staff members" },
  { key: PERMISSIONS.STAFF_MANAGE_ROLES, category: "staff", description: "Assign roles to staff members" },
  {
    key: PERMISSIONS.STAFF_MANAGE_PERMISSIONS,
    category: "staff",
    description: "Grant or revoke individual permissions for a staff member",
  },

  { key: PERMISSIONS.SETTINGS_BRANDING, category: "settings", description: "Change company branding/theme" },
  { key: PERMISSIONS.SETTINGS_COMPANY, category: "settings", description: "Change company profile settings" },
  { key: PERMISSIONS.BILLING_MANAGE, category: "billing", description: "Manage the company's subscription" },
  { key: PERMISSIONS.REPORTS_VIEW, category: "reports", description: "View sales and inventory reports" },
  { key: PERMISSIONS.AUDIT_LOG_VIEW, category: "reports", description: "View the company audit log" },
];

/** Default permission sets for the seeded system roles. */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, PermissionKey[]> = {
  Owner: PERMISSION_CATALOG.map((p) => p.key),
  // TRANSFERS_RECEIVE_EXTERNAL (adding stock with no request, no review) is
  // deliberately withheld from Admin by default — only the Owner gets it
  // out of the box. Admin/Branch Manager/Cashier all go through the
  // request → review flow instead (see the roles below and
  // transfer-service.ts's requestTransfer/approveTransfer). A company can
  // still grant it to a specific Admin later via the per-staff override.
  Admin: PERMISSION_CATALOG.filter(
    (p) => p.key !== PERMISSIONS.BILLING_MANAGE && p.key !== PERMISSIONS.TRANSFERS_RECEIVE_EXTERNAL,
  ).map((p) => p.key),
  "Branch Manager": [
    PERMISSIONS.PRODUCTS_VIEW,
    PERMISSIONS.STOCK_LEVELS_VIEW,
    PERMISSIONS.TRANSFERS_REQUEST,
    PERMISSIONS.TRANSFERS_APPROVE,
    PERMISSIONS.TRANSFERS_RECEIVE,
    PERMISSIONS.SALES_RECORD,
    PERMISSIONS.SALES_DATE_SEARCH,
    PERMISSIONS.PAYMENTS_RECORD,
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.CUSTOMERS_MANAGE,
    PERMISSIONS.EXPENSES_VIEW,
    PERMISSIONS.EXPENSES_MANAGE,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.PURCHASE_ORDERS_VIEW,
    PERMISSIONS.PURCHASE_ORDERS_MANAGE,
    PERMISSIONS.PURCHASE_ORDERS_RECEIVE,
    PERMISSIONS.SALES_REPORTS_SUBMIT,
  ],
  // Not a reviewer (approval is Owner/Admin/Branch Manager only) — the
  // Warehouse Manager's role in the transfer flow is dispatching stock
  // physically once a reviewer has approved a warehouse-sourced transfer.
  "Warehouse Manager": [
    PERMISSIONS.PRODUCTS_VIEW,
    PERMISSIONS.STOCK_LEVELS_VIEW,
    PERMISSIONS.TRANSFERS_DISPATCH,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.PURCHASE_ORDERS_VIEW,
    PERMISSIONS.PURCHASE_ORDERS_RECEIVE,
  ],
  Cashier: [
    PERMISSIONS.PRODUCTS_VIEW,
    PERMISSIONS.STOCK_LEVELS_VIEW,
    PERMISSIONS.TRANSFERS_REQUEST,
    PERMISSIONS.SALES_RECORD,
    PERMISSIONS.PAYMENTS_RECORD,
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.CUSTOMERS_MANAGE,
    PERMISSIONS.SALES_REPORTS_SUBMIT,
  ],
};

export const SYSTEM_ROLE_NAMES = Object.keys(DEFAULT_ROLE_PERMISSIONS);
