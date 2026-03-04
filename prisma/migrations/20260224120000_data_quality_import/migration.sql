-- ============================================================
-- Migration: data_quality_import
-- Adds Category / Unit dictionaries, migrates Product string
-- fields to FK relations, adds PriceImportBatch/Row models,
-- and extends AuditAction / EntityType enums.
-- ============================================================

-- 1. New enum types
CREATE TYPE "ImportBatchStatus" AS ENUM ('DRAFT', 'APPLIED');
CREATE TYPE "ImportRowStatus" AS ENUM ('OK', 'ERROR');

-- 2. Extend existing enums
ALTER TYPE "AuditAction" ADD VALUE 'IMPORT_PRICE_LIST_DRAFT';
ALTER TYPE "AuditAction" ADD VALUE 'APPLY_PRICE_LIST';
ALTER TYPE "EntityType" ADD VALUE 'PRICE_IMPORT_BATCH';

-- 3. Create Category table
CREATE TABLE "Category" (
    "id"        TEXT         NOT NULL,
    "name"      TEXT         NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- 4. Create Unit table
CREATE TABLE "Unit" (
    "id"        TEXT         NOT NULL,
    "name"      TEXT         NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Unit_name_key" ON "Unit"("name");

-- 5. Populate Category from distinct Product.category values
INSERT INTO "Category" ("id", "name", "createdAt")
SELECT
    gen_random_uuid()::text,
    INITCAP(TRIM(REGEXP_REPLACE("category", '\s+', ' ', 'g'))),
    NOW()
FROM "Product"
WHERE "category" IS NOT NULL AND TRIM("category") <> ''
GROUP BY INITCAP(TRIM(REGEXP_REPLACE("category", '\s+', ' ', 'g')))
ON CONFLICT ("name") DO NOTHING;

-- Ensure at least one fallback category exists
INSERT INTO "Category" ("id", "name", "createdAt")
VALUES (gen_random_uuid()::text, 'Без категории', NOW())
ON CONFLICT ("name") DO NOTHING;

-- 6. Populate Unit from distinct Product.unit values
INSERT INTO "Unit" ("id", "name", "createdAt")
SELECT
    gen_random_uuid()::text,
    TRIM(REGEXP_REPLACE("unit", '\s+', ' ', 'g')),
    NOW()
FROM "Product"
WHERE "unit" IS NOT NULL AND TRIM("unit") <> ''
GROUP BY TRIM(REGEXP_REPLACE("unit", '\s+', ' ', 'g'))
ON CONFLICT ("name") DO NOTHING;

-- Ensure at least one fallback unit exists
INSERT INTO "Unit" ("id", "name", "createdAt")
VALUES (gen_random_uuid()::text, 'шт', NOW())
ON CONFLICT ("name") DO NOTHING;

-- 7. Add nullable FK columns to Product
ALTER TABLE "Product" ADD COLUMN "categoryId" TEXT;
ALTER TABLE "Product" ADD COLUMN "unitId"     TEXT;

-- 8. Backfill categoryId
UPDATE "Product" p
SET "categoryId" = c."id"
FROM "Category" c
WHERE LOWER(TRIM(REGEXP_REPLACE(p."category", '\s+', ' ', 'g')))
    = LOWER(TRIM(REGEXP_REPLACE(c."name",     '\s+', ' ', 'g')));

-- Fallback for any unmatched rows
UPDATE "Product"
SET "categoryId" = (SELECT "id" FROM "Category" WHERE "name" = 'Без категории' LIMIT 1)
WHERE "categoryId" IS NULL;

-- 9. Backfill unitId
UPDATE "Product" p
SET "unitId" = u."id"
FROM "Unit" u
WHERE LOWER(TRIM(REGEXP_REPLACE(p."unit", '\s+', ' ', 'g')))
    = LOWER(TRIM(REGEXP_REPLACE(u."name", '\s+', ' ', 'g')));

-- Fallback for any unmatched rows
UPDATE "Product"
SET "unitId" = (SELECT "id" FROM "Unit" WHERE "name" = 'шт' LIMIT 1)
WHERE "unitId" IS NULL;

-- 10. Make FK columns NOT NULL
ALTER TABLE "Product" ALTER COLUMN "categoryId" SET NOT NULL;
ALTER TABLE "Product" ALTER COLUMN "unitId"     SET NOT NULL;

-- 11. Add FK constraints
ALTER TABLE "Product"
    ADD CONSTRAINT "Product_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "Category"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Product"
    ADD CONSTRAINT "Product_unitId_fkey"
    FOREIGN KEY ("unitId") REFERENCES "Unit"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- 12. Drop old string columns
ALTER TABLE "Product" DROP COLUMN "category";
ALTER TABLE "Product" DROP COLUMN "unit";

-- 13. Create PriceImportBatch table
CREATE TABLE "PriceImportBatch" (
    "id"              TEXT                 NOT NULL,
    "createdAt"       TIMESTAMP(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supplierId"      TEXT                 NOT NULL,
    "fileName"        TEXT                 NOT NULL,
    "delimiter"       TEXT                 NOT NULL DEFAULT ',',
    "status"          "ImportBatchStatus"  NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" TEXT,
    CONSTRAINT "PriceImportBatch_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PriceImportBatch"
    ADD CONSTRAINT "PriceImportBatch_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- 14. Create PriceImportRow table
CREATE TABLE "PriceImportRow" (
    "id"           TEXT                NOT NULL,
    "batchId"      TEXT                NOT NULL,
    "rowNumber"    INTEGER             NOT NULL,
    "rawName"      TEXT                NOT NULL,
    "rawCategory"  TEXT                NOT NULL,
    "rawUnit"      TEXT                NOT NULL,
    "rawPrice"     TEXT                NOT NULL,
    "rawSku"       TEXT,
    "rawImageUrl"  TEXT,
    "status"       "ImportRowStatus"   NOT NULL DEFAULT 'OK',
    "errorMessage" TEXT,
    CONSTRAINT "PriceImportRow_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PriceImportRow"
    ADD CONSTRAINT "PriceImportRow_batchId_fkey"
    FOREIGN KEY ("batchId") REFERENCES "PriceImportBatch"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
