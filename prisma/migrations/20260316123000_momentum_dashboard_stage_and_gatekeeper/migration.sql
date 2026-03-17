-- Add new dashboard-support columns.
ALTER TABLE "Deal" ADD COLUMN "gatekeeperName" TEXT;
ALTER TABLE "Deal" ADD COLUMN "gatekeeperLastContacted" DATETIME;
ALTER TABLE "Deal" ADD COLUMN "stageChangedAt" DATETIME;
ALTER TABLE "Deal" ADD COLUMN "lossReason" TEXT;
ALTER TABLE "Deal" ADD COLUMN "isGatekept" BOOLEAN NOT NULL DEFAULT false;

-- Stage normalization for the new 8-stage pipeline.
UPDATE "Deal" SET "stage" = 'active_convo' WHERE "stage" = 'contacted';
UPDATE "Deal" SET "stage" = 'signal' WHERE "stage" = 'lead';
