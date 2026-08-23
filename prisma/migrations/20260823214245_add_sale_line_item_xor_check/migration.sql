-- Same catalog-item-vs-service XOR guarantee SaleLineItem's own comment
-- already documents in application code (see sale-service.ts's createSale)
-- — added at the DB level too, same pattern as the ProductBatch/StockTransfer
-- CHECK constraints in 20260821223000_warehouse_batch_tracking.
ALTER TABLE "SaleLineItem" ADD CONSTRAINT "sale_line_item_product_xor_service" CHECK (
  ("isService" = false AND "productId" IS NOT NULL AND "adHocDescription" IS NULL) OR
  ("isService" = true AND "productId" IS NULL AND "adHocDescription" IS NOT NULL)
);
