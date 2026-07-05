-- CreateTable: referral partners (people who send us clients)
CREATE TABLE "ReferralPartner" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "mailingAddress" TEXT,
    "relationship" TEXT,
    "giftNotes" TEXT,
    "notes" TEXT,
    "lastThankYouSent" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- AlterTable: link a deal to the partner who referred it (nullable; SET NULL on partner delete)
ALTER TABLE "Deal" ADD COLUMN "referralPartnerId" INTEGER REFERENCES "ReferralPartner" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
