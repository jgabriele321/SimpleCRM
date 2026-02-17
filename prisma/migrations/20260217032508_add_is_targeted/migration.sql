-- CreateTable
CREATE TABLE "Deal" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "personName" TEXT,
    "companyName" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'lead',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "expectedValue" REAL NOT NULL DEFAULT 0,
    "closeProbability" INTEGER NOT NULL DEFAULT 50,
    "expectedCloseDate" DATETIME,
    "lastContactDate" DATETIME,
    "nextActionDate" DATETIME,
    "nextAction" TEXT,
    "notes" TEXT,
    "isTargeted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
