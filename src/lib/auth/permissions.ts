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
  Admin: PERMISSION_CATALOG.filter((p) => p.key !== PERMISSIONS.BILLING_MANAGE).map((p) => p.key),
  "Branch Manager": [
    PERMISSIONS.PRODUCTS_VIEW,
    PERMISSIONS.STOCK_LEVELS_VIEW,
    PERMISSIONS.TRANSFERS_REQUEST,
    PERMISSIONS.TRANSFERS_RECEIVE,
    PERMISSIONS.TRANSFERS_RECEIVE_EXTERNAL,
    PERMISSIONS.SALES_RECORD,
    PERMISSIONS.PAYMENTS_RECORD,
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.CUSTOMERS_MANAGE,
    PERMISSIONS.EXPENSES_VIEW,
    PERMISSIONS.EXPENSES_MANAGE,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.PURCHASE_ORDERS_VIEW,
    PERMISSIONS.PURCHASE_ORDERS_MANAGE,
    PERMISSIONS.PURCHASE_ORDERS_RECEIVE,
  ],
  "Warehouse Manager": [
    PERMISSIONS.PRODUCTS_VIEW,
    PERMISSIONS.STOCK_LEVELS_VIEW,
    PERMISSIONS.TRANSFERS_APPROVE,
    PERMISSIONS.TRANSFERS_DISPATCH,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.PURCHASE_ORDERS_VIEW,
    PERMISSIONS.PURCHASE_ORDERS_RECEIVE,
  ],
  Cashier: [
    PERMISSIONS.PRODUCTS_VIEW,
    PERMISSIONS.STOCK_LEVELS_VIEW,
    PERMISSIONS.SALES_RECORD,
    PERMISSIONS.PAYMENTS_RECORD,
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.CUSTOMERS_MANAGE,
  ],
};

export const SYSTEM_ROLE_NAMES = Object.keys(DEFAULT_ROLE_PERMISSIONS);
