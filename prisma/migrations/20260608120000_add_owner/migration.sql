-- AlterTable: add deal owner (creator) for Johnny/Joe attribution & filtering
ALTER TABLE "Deal" ADD COLUMN "owner" TEXT NOT NULL DEFAULT 'Johnny';

-- Existing deals were all created by Johnny.
UPDATE "Deal" SET "owner" = 'Johnny' WHERE "owner" IS NULL OR "owner" = '';
