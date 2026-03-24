-- AlterTable
ALTER TABLE "Deal" ADD COLUMN "proposalSentAt" DATETIME;

-- Best-effort backfill: deals still in proposal_sent likely last transitioned into that stage at stageChangedAt
UPDATE "Deal"
SET "proposalSentAt" = "stageChangedAt"
WHERE "stage" = 'proposal_sent'
  AND "proposalSentAt" IS NULL
  AND "stageChangedAt" IS NOT NULL;
