-- AlterTable: optional contact email & phone on deals
ALTER TABLE "Deal" ADD COLUMN "email" TEXT;
ALTER TABLE "Deal" ADD COLUMN "phone" TEXT;
