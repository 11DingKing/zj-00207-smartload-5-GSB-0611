const prisma = require("../utils/prisma");

const VEHICLE_MODEL_INCLUDE = {
  vehicleConfigs: {
    include: { configItem: { include: { versions: true } } },
  },
  optionPackages: {
    include: {
      optionPackage: {
        include: { items: { include: { configItem: true } } },
      },
    },
  },
};

const getPackageConfigIds = (optionPackages = []) => {
  const packageConfigIds = new Set();
  optionPackages.forEach((vp) => {
    if (vp.optionPackage?.items) {
      vp.optionPackage.items.forEach((item) => {
        packageConfigIds.add(item.configItemId);
      });
    }
  });
  return packageConfigIds;
};

const calculateConfigWeightOnly = (vehicleConfigs, packageConfigIds) => {
  return vehicleConfigs.reduce((sum, vc) => {
    if (packageConfigIds.has(vc.configItemId)) {
      return sum;
    }
    const weight = vc.actualWeight || vc.configItem.typicalWeight;
    return sum + weight * vc.quantity;
  }, 0);
};

const calculateVehicleSmartWeight = (vehicleConfigs, optionPackages = []) => {
  const packageConfigIds = getPackageConfigIds(optionPackages);

  const configWeight = calculateConfigWeightOnly(vehicleConfigs, packageConfigIds);

  const packageWeight = calculatePackageWeight(optionPackages);

  return configWeight + packageWeight;
};

const calculateCategoryWeight = (vehicleConfigs, optionPackages = []) => {
  const byCategory = {};
  const packageConfigIds = getPackageConfigIds(optionPackages);

  vehicleConfigs.forEach((vc) => {
    if (packageConfigIds.has(vc.configItemId)) {
      return;
    }
    const category = vc.configItem.category;
    const weight = (vc.actualWeight || vc.configItem.typicalWeight) * vc.quantity;
    if (!byCategory[category]) {
      byCategory[category] = 0;
    }
    byCategory[category] += weight;
  });

  optionPackages.forEach((vp) => {
    if (vp.optionPackage?.items) {
      vp.optionPackage.items.forEach((item) => {
        const category = item.configItem.category;
        const weight = item.configItem.typicalWeight * item.quantity;
        if (!byCategory[category]) {
          byCategory[category] = 0;
        }
        byCategory[category] += weight;
      });
    }
  });

  return byCategory;
};

const calculatePackageWeight = (optionPackages = []) => {
  return optionPackages.reduce((sum, vp) => {
    if (vp.optionPackage?.items) {
      return (
        sum +
        vp.optionPackage.items.reduce((s, item) => {
          return s + item.configItem.typicalWeight * item.quantity;
        }, 0)
      );
    }
    return sum;
  }, 0);
};

const calculateVersionUpgradeSaving = (vehicleConfigs) => {
  let totalSaving = 0;
  const upgradeableItems = [];

  vehicleConfigs.forEach((vc) => {
    const configItem = vc.configItem;
    if (configItem.versionGroupId && configItem.versions && configItem.versions.length > 0) {
      const currentVersion = configItem.versions.find(
        (v) => v.versionCode === configItem.versionCode
      );
      const latestVersion =
        configItem.versions.find((v) => v.isCurrent) ||
        [...configItem.versions].sort((a, b) => b.versionOrder - a.versionOrder)[0];

      if (
        currentVersion &&
        latestVersion &&
        latestVersion.versionOrder > currentVersion.versionOrder
      ) {
        const currentWeight = (vc.actualWeight || currentVersion.weight) * vc.quantity;
        const newWeight = latestVersion.weight * vc.quantity;
        const saving = currentWeight - newWeight;

        if (saving > 0) {
          totalSaving += saving;
          upgradeableItems.push({
            vehicleConfigId: vc.id,
            configItemId: configItem.id,
            name: configItem.name,
            category: configItem.category,
            currentVersion: currentVersion.versionCode,
            latestVersion: latestVersion.versionCode,
            weightSaving: saving,
            currentWeight,
            newWeight,
            quantity: vc.quantity,
          });
        }
      }
    }
  });

  return { totalSaving, upgradeableItems, upgradeableCount: upgradeableItems.length };
};

const getVehicleSmartWeightBreakdown = (vehicle) => {
  const { vehicleConfigs, optionPackages } = vehicle;
  const packageConfigIds = getPackageConfigIds(optionPackages);
  const smartWeight = calculateVehicleSmartWeight(vehicleConfigs, optionPackages);
  const packageWeight = calculatePackageWeight(optionPackages);
  const configWeight = calculateConfigWeightOnly(vehicleConfigs, packageConfigIds);
  const versionSaving = calculateVersionUpgradeSaving(vehicleConfigs);

  return {
    smartWeight,
    configWeight,
    packageWeight,
    versionSaving,
    packageConfigIds,
  };
};

const findAllVehiclesWithStats = async (where = {}) => {
  return prisma.vehicleModel.findMany({
    where,
    include: VEHICLE_MODEL_INCLUDE,
  });
};

module.exports = {
  VEHICLE_MODEL_INCLUDE,
  getPackageConfigIds,
  calculateConfigWeightOnly,
  calculateVehicleSmartWeight,
  calculateCategoryWeight,
  calculatePackageWeight,
  calculateVersionUpgradeSaving,
  getVehicleSmartWeightBreakdown,
  findAllVehiclesWithStats,
};
