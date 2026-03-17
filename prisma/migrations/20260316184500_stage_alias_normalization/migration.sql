-- Normalize legacy stage aliases into canonical stage names.
UPDATE "Deal" SET "stage" = 'proposal_sent' WHERE "stage" = 'proposal';
UPDATE "Deal" SET "stage" = 'verbal_yes' WHERE "stage" = 'negotiation';
