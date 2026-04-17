# Migration rollback strategy

Prisma Migrate has no built-in `down` step. For manually-crafted migrations in
this repo we document an inverse SQL procedure here. Apply it in a psql session
connected to the target database, then delete the corresponding row in
`_prisma_migrations` so Prisma will re-run the migration on the next
`prisma migrate deploy`.

> **Warning.** Rolling back a migration on a database that already contains
> production data can be destructive. Always take a fresh backup
> (`pg_dump`) before running any of the commands below.

Common cleanup after manual rollback:

```sql
DELETE FROM "_prisma_migrations" WHERE migration_name = '<migration_name>';
```

---

## `20260224120000_data_quality_import`

Adds `Category` and `Unit` models, rewrites `Product.category` / `Product.unit`
columns into foreign keys, and creates the `PriceImportBatch` / `PriceImportRow`
tables.

**This rollback is lossy.** Category and unit *names* are preserved on
`Product`, but the `Category`/`Unit` rows themselves are deleted, as are all
import history rows.

```sql
BEGIN;

-- 1. Restore old string columns on Product.
ALTER TABLE "Product"
  ADD COLUMN "category" TEXT,
  ADD COLUMN "unit"     TEXT;

UPDATE "Product" p
SET "category" = c."name",
    "unit"     = u."name"
FROM "Category" c, "Unit" u
WHERE p."categoryId" = c."id"
  AND p."unitId"     = u."id";

ALTER TABLE "Product" ALTER COLUMN "category" SET NOT NULL;
ALTER TABLE "Product" ALTER COLUMN "unit"     SET NOT NULL;

-- 2. Drop FKs and their columns.
ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_categoryId_fkey";
ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_unitId_fkey";
ALTER TABLE "Product" DROP COLUMN "categoryId";
ALTER TABLE "Product" DROP COLUMN "unitId";

-- 3. Drop import history.
DROP TABLE IF EXISTS "PriceImportRow";
DROP TABLE IF EXISTS "PriceImportBatch";
DROP TYPE  IF EXISTS "ImportBatchStatus";
DROP TYPE  IF EXISTS "ImportRowStatus";

-- 4. Drop Category / Unit.
DROP TABLE IF EXISTS "Category";
DROP TABLE IF EXISTS "Unit";

-- 5. Mark the migration as not applied.
DELETE FROM "_prisma_migrations"
 WHERE migration_name = '20260224120000_data_quality_import';

COMMIT;
```

---

## `20260411120000_auto_close_notifications`

Adds `PROCUREMENT_AUTO_CLOSED` to `AuditAction` and any supporting state.
Postgres does not support removing an enum value without rebuilding the type.

```sql
BEGIN;

-- Rename, recreate without the new value, swap it in.
ALTER TYPE "AuditAction" RENAME TO "AuditAction_old";

CREATE TYPE "AuditAction" AS ENUM (
  'CREATE_PROCUREMENT', 'CLOSE_PROCUREMENT', 'SUBMIT_ORDER',
  'CREATE_RECEIVING', 'UPDATE_RECEIVING_LINE', 'FINALIZE_RECEIVING',
  'EXPORT_DOC',
  'CREATE_PICKUP_SESSION', 'CHECKIN_ORDER', 'CLOSE_PICKUP_SESSION',
  'IMPORT_PRICE_LIST', 'IMPORT_PRICE_LIST_DRAFT', 'APPLY_PRICE_LIST',
  'UPDATE_DELIVERY_SETTINGS', 'RECALC_DELIVERY_SHARES', 'UPDATE_PAYMENT_STATUS',
  'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT'
);

-- Any rows that used the removed value must be deleted or updated first.
DELETE FROM "AuditLog" WHERE "action"::text = 'PROCUREMENT_AUTO_CLOSED';

ALTER TABLE "AuditLog"
  ALTER COLUMN "action" TYPE "AuditAction"
  USING "action"::text::"AuditAction";

DROP TYPE "AuditAction_old";

DELETE FROM "_prisma_migrations"
 WHERE migration_name = '20260411120000_auto_close_notifications';

COMMIT;
```

---

## `20260411130000_token_version_and_ratelimit`

Adds `tokenVersion` to `User`, `FORCE_LOGOUT` to `AuditAction`, and creates
the `RateLimitBucket` table.

```sql
BEGIN;

DROP TABLE IF EXISTS "RateLimitBucket";

ALTER TABLE "User" DROP COLUMN "tokenVersion";

-- Same enum-rebuild dance as above; list every value EXCEPT FORCE_LOGOUT.
ALTER TYPE "AuditAction" RENAME TO "AuditAction_old";
CREATE TYPE "AuditAction" AS ENUM (
  'CREATE_PROCUREMENT', 'CLOSE_PROCUREMENT', 'SUBMIT_ORDER',
  'CREATE_RECEIVING', 'UPDATE_RECEIVING_LINE', 'FINALIZE_RECEIVING',
  'EXPORT_DOC',
  'CREATE_PICKUP_SESSION', 'CHECKIN_ORDER', 'CLOSE_PICKUP_SESSION',
  'IMPORT_PRICE_LIST', 'IMPORT_PRICE_LIST_DRAFT', 'APPLY_PRICE_LIST',
  'UPDATE_DELIVERY_SETTINGS', 'RECALC_DELIVERY_SHARES', 'UPDATE_PAYMENT_STATUS',
  'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT',
  'PROCUREMENT_AUTO_CLOSED'
);
DELETE FROM "AuditLog" WHERE "action"::text = 'FORCE_LOGOUT';
ALTER TABLE "AuditLog"
  ALTER COLUMN "action" TYPE "AuditAction"
  USING "action"::text::"AuditAction";
DROP TYPE "AuditAction_old";

DELETE FROM "_prisma_migrations"
 WHERE migration_name = '20260411130000_token_version_and_ratelimit';

COMMIT;
```

---

## `20260412120000_import_undo_and_indexes`

Adds `REVERTED` to `ImportBatchStatus`, `REVERT_PRICE_LIST` to `AuditAction`,
`appliedAt`/`revestedAt` columns on `PriceImportBatch`, undo-snapshot columns on
`PriceImportRow`, and new indexes on `Procurement`, `OrderItem`,
`PriceImportRow`, `AuditLog`.

```sql
BEGIN;

-- Drop indexes.
DROP INDEX IF EXISTS "AuditLog_createdAt_idx";
DROP INDEX IF EXISTS "OrderItem_productId_idx";
DROP INDEX IF EXISTS "OrderItem_orderId_idx";
DROP INDEX IF EXISTS "Procurement_settlementId_status_deadlineAt_idx";
DROP INDEX IF EXISTS "PriceImportRow_batchId_status_idx";

-- Drop new columns on PriceImportRow.
ALTER TABLE "PriceImportRow"
  DROP COLUMN "previousActive",
  DROP COLUMN "previousPrice",
  DROP COLUMN "appliedProductId";

-- Drop new columns on PriceImportBatch.
ALTER TABLE "PriceImportBatch"
  DROP COLUMN "revertedAt",
  DROP COLUMN "appliedAt";

-- Any REVERTED rows must be rewritten before removing the enum value.
UPDATE "PriceImportBatch" SET "status" = 'APPLIED' WHERE "status" = 'REVERTED';

ALTER TYPE "ImportBatchStatus" RENAME TO "ImportBatchStatus_old";
CREATE TYPE "ImportBatchStatus" AS ENUM ('DRAFT', 'APPLIED');
ALTER TABLE "PriceImportBatch"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "ImportBatchStatus"
    USING "status"::text::"ImportBatchStatus",
  ALTER COLUMN "status" SET DEFAULT 'DRAFT';
DROP TYPE "ImportBatchStatus_old";

DELETE FROM "AuditLog" WHERE "action"::text = 'REVERT_PRICE_LIST';
ALTER TYPE "AuditAction" RENAME TO "AuditAction_old";
CREATE TYPE "AuditAction" AS ENUM (
  'CREATE_PROCUREMENT', 'CLOSE_PROCUREMENT', 'SUBMIT_ORDER',
  'CREATE_RECEIVING', 'UPDATE_RECEIVING_LINE', 'FINALIZE_RECEIVING',
  'EXPORT_DOC',
  'CREATE_PICKUP_SESSION', 'CHECKIN_ORDER', 'CLOSE_PICKUP_SESSION',
  'IMPORT_PRICE_LIST', 'IMPORT_PRICE_LIST_DRAFT', 'APPLY_PRICE_LIST',
  'UPDATE_DELIVERY_SETTINGS', 'RECALC_DELIVERY_SHARES', 'UPDATE_PAYMENT_STATUS',
  'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT',
  'PROCUREMENT_AUTO_CLOSED', 'FORCE_LOGOUT'
);
ALTER TABLE "AuditLog"
  ALTER COLUMN "action" TYPE "AuditAction"
  USING "action"::text::"AuditAction";
DROP TYPE "AuditAction_old";

DELETE FROM "_prisma_migrations"
 WHERE migration_name = '20260412120000_import_undo_and_indexes';

COMMIT;
```
