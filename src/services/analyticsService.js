const prisma = require("../utils/prisma");

const vehicleWithConfigsInclude = {
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

const calculateVehicleSmartWeight = (vehicleConfigs, optionPackages = []) => {
  const packageConfigIds = getPackageConfigIds(optionPackages);

  const configWeight = vehicleConfigs.reduce((sum, vc) => {
    if (packageConfigIds.has(vc.configItemId)) {
      return sum;
    }
    const weight = vc.actualWeight || vc.configItem.typicalWeight;
    return sum + weight * vc.quantity;
  }, 0);

  const packageWeight = optionPackages.reduce((sum, vp) => {
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
            configItemId: configItem.id,
            name: configItem.name,
            currentVersion: currentVersion.versionCode,
            latestVersion: latestVersion.versionCode,
            weightSaving: saving,
            quantity: vc.quantity,
          });
        }
      }
    }
  });

  return { totalSaving, upgradeableItems };
};

const calculateConfigWeight = (vehicleConfigs, optionPackages = []) => {
  const packageConfigIds = getPackageConfigIds(optionPackages);
  return vehicleConfigs.reduce((sum, vc) => {
    if (packageConfigIds.has(vc.configItemId)) {
      return sum;
    }
    const weight = vc.actualWeight || vc.configItem.typicalWeight;
    return sum + weight * vc.quantity;
  }, 0);
};

const getVehicleWeightDetails = (vehicle) => {
  const smartWeight = calculateVehicleSmartWeight(vehicle.vehicleConfigs, vehicle.optionPackages);
  const packageWeight = calculatePackageWeight(vehicle.optionPackages);
  const configWeight = calculateConfigWeight(vehicle.vehicleConfigs, vehicle.optionPackages);
  const versionSaving = calculateVersionUpgradeSaving(vehicle.vehicleConfigs);

  return {
    smartWeight,
    packageWeight,
    configWeight,
    versionUpgradeSaving: versionSaving.totalSaving,
    upgradeableConfigCount: versionSaving.upgradeableItems.length,
  };
};

const fetchAllVehiclesWithConfigs = async (where = {}) => {
  return prisma.vehicleModel.findMany({
    where,
    include: vehicleWithConfigsInclude,
  });
};

module.exports = {
  vehicleWithConfigsInclude,
  getPackageConfigIds,
  calculateVehicleSmartWeight,
  calculateCategoryWeight,
  calculatePackageWeight,
  calculateVersionUpgradeSaving,
  calculateConfigWeight,
  getVehicleWeightDetails,
  fetchAllVehiclesWithConfigs,
};
