/**
 * Verifies that WarehouseStock/BranchStock (the cached current-quantity
 * projection) still agrees with StockMovement (the append-only ledger
 * that's the actual source of truth) — sum(quantityDelta) per
 * product/location should always equal the cached quantity. A mismatch
 * means either a real bug in the stock-adjustment code paths or, given
 * the DB-level protections in prisma/grants.sql, most likely just a sign
 * something needs investigating.
 *
 * Run manually: npx tsx scripts/reconcile-stock.ts
 * Intended to also run on a schedule once this project has one (Vercel
 * Cron, a GitHub Actions schedule, etc.) — no such infra exists yet, so
 * for now this is an on-demand health check rather than an alerting job.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  let mismatches = 0;

  const warehouseStocks = await prisma.warehouseStock.findMany();
  for (const stock of warehouseStocks) {
    const agg = await prisma.stockMovement.aggregate({
      where: { productId: stock.productId, warehouseId: stock.warehouseId, locationType: "WAREHOUSE" },
      _sum: { quantityDelta: true },
    });
    const ledgerTotal = agg._sum.quantityDelta ?? 0;
    if (ledgerTotal !== stock.quantity) {
      mismatches++;
      console.error(
        `MISMATCH warehouse stock=${stock.id} product=${stock.productId} warehouse=${stock.warehouseId}: ` +
          `cached=${stock.quantity} ledger=${ledgerTotal}`,
      );
    }
  }

  const branchStocks = await prisma.branchStock.findMany();
  for (const stock of branchStocks) {
    const agg = await prisma.stockMovement.aggregate({
      where: { productId: stock.productId, branchId: stock.branchId, locationType: "BRANCH" },
      _sum: { quantityDelta: true },
    });
    const ledgerTotal = agg._sum.quantityDelta ?? 0;
    if (ledgerTotal !== stock.quantity) {
      mismatches++;
      console.error(
        `MISMATCH branch stock=${stock.id} product=${stock.productId} branch=${stock.branchId}: ` +
          `cached=${stock.quantity} ledger=${ledgerTotal}`,
      );
    }
  }

  console.log(
    `Reconciliation complete: ${warehouseStocks.length + branchStocks.length} stock rows checked, ${mismatches} mismatch(es).`,
  );

  await prisma.$disconnect();
  process.exit(mismatches > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
