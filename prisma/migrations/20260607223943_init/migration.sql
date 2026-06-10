-- CreateTable
CREATE TABLE "ConfigItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "typicalWeight" REAL NOT NULL,
    "featureLevel" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "description" TEXT,
    "popularityRate" REAL NOT NULL DEFAULT 0,
    "isHighlyAdopted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "VehicleModel" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "modelYear" INTEGER NOT NULL,
    "baseWeight" REAL NOT NULL,
    "description" TEXT,
    "isNewModel" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "VehicleConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "vehicleModelId" INTEGER NOT NULL,
    "configItemId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "actualWeight" REAL,
    "isFrequentlyUsed" BOOLEAN NOT NULL DEFAULT true,
    "adoptionDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VehicleConfig_vehicleModelId_fkey" FOREIGN KEY ("vehicleModelId") REFERENCES "VehicleModel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VehicleConfig_configItemId_fkey" FOREIGN KEY ("configItemId") REFERENCES "ConfigItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ConfigItem_category_idx" ON "ConfigItem"("category");

-- CreateIndex
CREATE INDEX "ConfigItem_status_idx" ON "ConfigItem"("status");

-- CreateIndex
CREATE INDEX "VehicleConfig_vehicleModelId_idx" ON "VehicleConfig"("vehicleModelId");

-- CreateIndex
CREATE INDEX "VehicleConfig_configItemId_idx" ON "VehicleConfig"("configItemId");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleConfig_vehicleModelId_configItemId_key" ON "VehicleConfig"("vehicleModelId", "configItemId");
