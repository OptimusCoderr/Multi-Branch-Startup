import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

/**
 * Every Prisma model that carries a `companyId` column directly. This is the
 * single source of truth for which models `getScopedPrisma` auto-scopes —
 * add a model here the same migration that adds its `companyId` field.
 */
export const TENANT_SCOPED_MODELS = [
  "Membership",
  "Role",
  "Invitation",
  "Subscription",
  "AuditLog",
  "Product",
  "Warehouse",
  "Branch",
  "WarehouseStock",
  "BranchStock",
  "StockTransfer",
  "StockMovement",
  "Sale",
  "Payment",
  "BrandingSettings",
  "Customer",
  "ExpenseCategory",
  "Expense",
  "DebtReminder",
  "CreditNote",
  "ProductBatch",
  "Supplier",
  "PurchaseOrder",
  "DailySalesReport",
  "ReminderCreditPurchase",
  "DebtReminderTemplate",
  "SaleFlag",
  "Notification",
] as const;

type TenantScopedModel = (typeof TENANT_SCOPED_MODELS)[number];

function isTenantScoped(model: string | undefined): model is TenantScopedModel {
  return !!model && (TENANT_SCOPED_MODELS as readonly string[]).includes(model);
}

class CrossTenantAccessError extends Error {
  constructor(model: string) {
    super(`Blocked an attempt to access a "${model}" record outside its owning company.`);
    this.name = "CrossTenantAccessError";
  }
}

/**
 * Returns a Prisma Client bound to a single company. Every query against a
 * tenant-scoped model (see TENANT_SCOPED_MODELS) automatically gets
 * `companyId` merged into its `where`/`data`, so forgetting a tenant filter
 * in application code is structurally prevented rather than a per-query
 * discipline. This is the primary defense against cross-tenant data leaks —
 * all application code that reads/writes tenant data MUST go through this,
 * never the raw `prisma` singleton (which is reserved for platform-level
 * code: webhooks resolving a company by external ID, admin tooling, and the
 * onboarding flow that creates the first Company/Membership before a
 * companyId scope exists).
 */
export function getScopedPrisma(companyId: string) {
  if (!companyId) {
    throw new Error("getScopedPrisma() called without a companyId");
  }

  return prisma.$extends({
    name: "tenant-scope",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!isTenantScoped(model)) {
            return query(args);
          }

          const a = args as Record<string, unknown>;

          switch (operation) {
            case "findMany":
            case "findFirst":
            case "findFirstOrThrow":
            case "count":
            case "aggregate":
            case "groupBy":
            case "updateMany":
            case "deleteMany": {
              a.where = { ...(a.where as object | undefined), companyId };
              return query(a as never);
            }

            case "update":
            case "delete": {
              a.where = { ...(a.where as object | undefined), companyId };
              return query(a as never);
            }

            case "create": {
              a.data = { ...(a.data as object), companyId };
              return query(a as never);
            }

            case "createMany":
            case "createManyAndReturn": {
              const data = a.data;
              a.data = Array.isArray(data)
                ? data.map((row) => ({ ...row, companyId }))
                : { ...(data as object), companyId };
              return query(a as never);
            }

            case "upsert": {
              a.where = { ...(a.where as object | undefined), companyId };
              a.create = { ...(a.create as object), companyId };
              a.update = { ...(a.update as object | undefined) };
              return query(a as never);
            }

            case "findUnique":
            case "findUniqueOrThrow": {
              // findUnique's `where` shape only accepts unique selectors, so
              // companyId can't always be merged in directly. Run the query
              // as-is, then verify the result actually belongs to this
              // tenant before returning it — a mismatch is treated as
              // "not found" (never leak that a record exists in another
              // company).
              const result = await query(a as never);
              if (
                result &&
                typeof result === "object" &&
                "companyId" in result &&
                (result as { companyId: unknown }).companyId !== companyId
              ) {
                if (operation === "findUniqueOrThrow") {
                  throw new CrossTenantAccessError(model);
                }
                return null;
              }
              return result;
            }

            default:
              // Any operation not explicitly handled above (e.g. raw
              // aggregations added by future Prisma versions) fails closed:
              // better to break a query than silently skip tenant scoping.
              throw new Error(
                `getScopedPrisma: operation "${operation}" on "${model}" is not tenant-scope-aware yet. ` +
                  `Add explicit handling in scoped-prisma.ts before using it.`,
              );
          }
        },
      },
    },
  });
}

export type ScopedPrismaClient = ReturnType<typeof getScopedPrisma>;
export { Prisma };
