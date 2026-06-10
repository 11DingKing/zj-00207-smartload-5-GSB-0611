-- AlterTable
ALTER TABLE "ConfigItem" ADD COLUMN "isLatestVersion" BOOLEAN DEFAULT false;
ALTER TABLE "ConfigItem" ADD COLUMN "releaseYear" INTEGER;
ALTER TABLE "ConfigItem" ADD COLUMN "versionCode" TEXT;
ALTER TABLE "ConfigItem" ADD COLUMN "versionGroupId" TEXT;
ALTER TABLE "ConfigItem" ADD COLUMN "versionOrder" INTEGER DEFAULT 0;
ALTER TABLE "ConfigItem" ADD COLUMN "weightSavingFromPrev" REAL DEFAULT 0;

-- CreateTable
CREATE TABLE "ConfigItemVersion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "configItemId" INTEGER NOT NULL,
    "versionGroupId" TEXT NOT NULL,
    "versionCode" TEXT NOT NULL,
    "versionName" TEXT NOT NULL,
    "versionOrder" INTEGER NOT NULL DEFAULT 0,
    "weight" REAL NOT NULL,
    "weightSaving" REAL NOT NULL DEFAULT 0,
    "releaseYear" INTEGER,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "improvementNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConfigItemVersion_configItemId_fkey" FOREIGN KEY ("configItemId") REFERENCES "ConfigItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OptionPackage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "price" REAL,
    "isPopular" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "OptionPackageItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "optionPackageId" INTEGER NOT NULL,
    "configItemId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "OptionPackageItem_optionPackageId_fkey" FOREIGN KEY ("optionPackageId") REFERENCES "OptionPackage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OptionPackageItem_configItemId_fkey" FOREIGN KEY ("configItemId") REFERENCES "ConfigItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VehicleOptionPackage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "vehicleModelId" INTEGER NOT NULL,
    "optionPackageId" INTEGER NOT NULL,
    "isStandard" BOOLEAN NOT NULL DEFAULT false,
    "adoptionDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VehicleOptionPackage_vehicleModelId_fkey" FOREIGN KEY ("vehicleModelId") REFERENCES "VehicleModel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VehicleOptionPackage_optionPackageId_fkey" FOREIGN KEY ("optionPackageId") REFERENCES "OptionPackage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ConfigItemVersion_configItemId_idx" ON "ConfigItemVersion"("configItemId");

-- CreateIndex
CREATE INDEX "ConfigItemVersion_versionGroupId_idx" ON "ConfigItemVersion"("versionGroupId");

-- CreateIndex
CREATE INDEX "ConfigItemVersion_versionOrder_idx" ON "ConfigItemVersion"("versionOrder");

-- CreateIndex
CREATE UNIQUE INDEX "OptionPackage_code_key" ON "OptionPackage"("code");

-- CreateIndex
CREATE INDEX "OptionPackage_category_idx" ON "OptionPackage"("category");

-- CreateIndex
CREATE INDEX "OptionPackage_isPopular_idx" ON "OptionPackage"("isPopular");

-- CreateIndex
CREATE INDEX "OptionPackageItem_optionPackageId_idx" ON "OptionPackageItem"("optionPackageId");

-- CreateIndex
CREATE INDEX "OptionPackageItem_configItemId_idx" ON "OptionPackageItem"("configItemId");

-- CreateIndex
CREATE UNIQUE INDEX "OptionPackageItem_optionPackageId_configItemId_key" ON "OptionPackageItem"("optionPackageId", "configItemId");

-- CreateIndex
CREATE INDEX "VehicleOptionPackage_vehicleModelId_idx" ON "VehicleOptionPackage"("vehicleModelId");

-- CreateIndex
CREATE INDEX "VehicleOptionPackage_optionPackageId_idx" ON "VehicleOptionPackage"("optionPackageId");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleOptionPackage_vehicleModelId_optionPackageId_key" ON "VehicleOptionPackage"("vehicleModelId", "optionPackageId");

-- CreateIndex
CREATE INDEX "ConfigItem_versionGroupId_idx" ON "ConfigItem"("versionGroupId");
