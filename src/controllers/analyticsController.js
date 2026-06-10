const prisma = require("../utils/prisma");
const {
  VehicleGrade,
  VehicleGradeLabels,
  ConfigCategory,
  ConfigCategoryLabels,
  ConfigStatusLabels,
  FeatureLevelLabels,
} = require("../utils/constants");
const {
  fetchAllVehicles,
  getPackageConfigIds,
  calculateVehicleSmartWeight,
  calculateCategoryWeight,
  calculatePackageWeight,
  calculateVersionUpgradeSaving,
} = require("../services/analyticsService");

const getSmartWeightOverview = async (req, res) => {
  try {
    const vehicles = await fetchAllVehicles();

    let totalVersionSaving = 0;
    let totalUpgradeable = 0;

    const vehicleWeights = vehicles.map((v) => {
      const smartWeight = calculateVehicleSmartWeight(v.vehicleConfigs, v.optionPackages);
      const packageWeight = calculatePackageWeight(v.optionPackages);
      const packageConfigIds = getPackageConfigIds(v.optionPackages);
      const configWeight = v.vehicleConfigs.reduce((sum, vc) => {
        if (packageConfigIds.has(vc.configItemId)) {
          return sum;
        }
        const weight = vc.actualWeight || vc.configItem.typicalWeight;
        return sum + weight * vc.quantity;
      }, 0);
      const versionSaving = calculateVersionUpgradeSaving(v.vehicleConfigs);

      totalVersionSaving += versionSaving.totalSaving;
      totalUpgradeable += versionSaving.upgradeableItems.length;

      return {
        id: v.id,
        name: v.name,
        brand: v.brand,
        grade: v.grade,
        gradeLabel: VehicleGradeLabels[v.grade],
        baseWeight: v.baseWeight,
        smartWeight,
        configWeight,
        packageWeight,
        packageCount: v.optionPackages.length,
        versionUpgradeSaving: versionSaving.totalSaving,
        upgradeableConfigCount: versionSaving.upgradeableItems.length,
        configCount: v.vehicleConfigs.length,
        isNewModel: v.isNewModel,
      };
    });

    const allWeights = vehicleWeights.map((v) => v.smartWeight);
    const avgWeight = allWeights.reduce((a, b) => a + b, 0) / allWeights.length;
    const maxWeight = Math.max(...allWeights);
    const minWeight = Math.min(...allWeights);

    const heavyVehicles = [...vehicleWeights]
      .sort((a, b) => b.smartWeight - a.smartWeight)
      .slice(0, 5);
    const lightVehicles = [...vehicleWeights]
      .sort((a, b) => a.smartWeight - b.smartWeight)
      .slice(0, 5);

    const byCategory = {};
    vehicles.forEach((v) => {
      const catWeights = calculateCategoryWeight(v.vehicleConfigs, v.optionPackages);
      Object.entries(catWeights).forEach(([cat, weight]) => {
        if (!byCategory[cat]) {
          byCategory[cat] = { totalWeight: 0, vehicleCount: 0 };
        }
        byCategory[cat].totalWeight += weight;
        byCategory[cat].vehicleCount++;
      });
    });

    const totalPackageWeight = vehicles.reduce(
      (sum, v) => sum + calculatePackageWeight(v.optionPackages),
      0
    );
    const totalPackages = vehicles.reduce((sum, v) => sum + v.optionPackages.length, 0);

    const categoryBreakdown = Object.entries(byCategory)
      .map(([category, data]) => ({
        category,
        categoryLabel: ConfigCategoryLabels[category] || category,
        totalWeight: data.totalWeight,
        avgPerVehicle: data.totalWeight / vehicles.length,
        vehicleCount: data.vehicleCount,
        adoptionRate: ((data.vehicleCount / vehicles.length) * 100).toFixed(1),
      }))
      .sort((a, b) => b.totalWeight - a.totalWeight);

    res.json({
      success: true,
      data: {
        summary: {
          totalVehicles: vehicles.length,
          avgSmartWeight: avgWeight.toFixed(1),
          maxSmartWeight: maxWeight.toFixed(1),
          minSmartWeight: minWeight.toFixed(1),
          totalCategoryWeight: categoryBreakdown.reduce((sum, c) => sum + c.totalWeight, 0),
          totalPackageWeight: totalPackageWeight.toFixed(1),
          totalPackages,
          totalVersionSaving: totalVersionSaving.toFixed(1),
          totalUpgradeableConfigs: totalUpgradeable,
        },
        categoryBreakdown,
        heavyVehicles,
        lightVehicles,
        allVehicles: vehicleWeights,
      },
    });
  } catch (error) {
    console.error("获取增重概览失败:", error);
    res.status(500).json({
      success: false,
      message: "获取增重概览失败",
      error: error.message,
    });
  }
};

const getGradeAnalysis = async (req, res) => {
  try {
    const gradeOrder = [
      VehicleGrade.ENTRY,
      VehicleGrade.MID,
      VehicleGrade.HIGH,
      VehicleGrade.LUXURY,
    ];
    const result = [];

    for (const grade of gradeOrder) {
      const vehicles = await fetchAllVehicles({ grade });

      if (vehicles.length === 0) continue;

      const weights = vehicles.map((v) =>
        calculateVehicleSmartWeight(v.vehicleConfigs, v.optionPackages)
      );
      const avgWeight = weights.reduce((a, b) => a + b, 0) / weights.length;
      const maxWeight = Math.max(...weights);
      const minWeight = Math.min(...weights);

      const avgConfigs =
        vehicles.reduce((sum, v) => sum + v.vehicleConfigs.length, 0) / vehicles.length;
      const avgPackages =
        vehicles.reduce((sum, v) => sum + v.optionPackages.length, 0) / vehicles.length;
      const avgPackageWeight =
        vehicles.reduce((sum, v) => sum + calculatePackageWeight(v.optionPackages), 0) /
        vehicles.length;
      const avgVersionSaving =
        vehicles.reduce(
          (sum, v) => sum + calculateVersionUpgradeSaving(v.vehicleConfigs).totalSaving,
          0
        ) / vehicles.length;

      const categoryWeights = {};
      vehicles.forEach((v) => {
        const catWeights = calculateCategoryWeight(v.vehicleConfigs, v.optionPackages);
        Object.entries(catWeights).forEach(([cat, weight]) => {
          if (!categoryWeights[cat]) categoryWeights[cat] = [];
          categoryWeights[cat].push(weight);
        });
      });

      const categoryBreakdown = Object.entries(categoryWeights).map(([category, weights]) => ({
        category,
        categoryLabel: ConfigCategoryLabels[category] || category,
        avgWeight: weights.reduce((a, b) => a + b, 0) / weights.length,
      }));

      result.push({
        grade,
        gradeLabel: VehicleGradeLabels[grade],
        vehicleCount: vehicles.length,
        avgSmartWeight: avgWeight.toFixed(1),
        maxSmartWeight: maxWeight.toFixed(1),
        minSmartWeight: minWeight.toFixed(1),
        avgConfigCount: avgConfigs.toFixed(1),
        avgPackageCount: avgPackages.toFixed(1),
        avgPackageWeight: avgPackageWeight.toFixed(1),
        avgVersionUpgradeSaving: avgVersionSaving.toFixed(1),
        categoryBreakdown: categoryBreakdown.sort((a, b) => b.avgWeight - a.avgWeight),
      });
    }

    const highGrade = result.find((r) => r.grade === VehicleGrade.HIGH);
    const midGrade = result.find((r) => r.grade === VehicleGrade.MID);
    const luxuryGrade = result.find((r) => r.grade === VehicleGrade.LUXURY);
    const entryGrade = result.find((r) => r.grade === VehicleGrade.ENTRY);

    const comparisons = [];
    if (luxuryGrade && highGrade) {
      comparisons.push({
        name: "豪华 vs 高配",
        higherGrade: luxuryGrade.gradeLabel,
        lowerGrade: highGrade.gradeLabel,
        weightDiff: (
          parseFloat(luxuryGrade.avgSmartWeight) - parseFloat(highGrade.avgSmartWeight)
        ).toFixed(1),
        weightDiffPercent: (
          ((parseFloat(luxuryGrade.avgSmartWeight) - parseFloat(highGrade.avgSmartWeight)) /
            parseFloat(highGrade.avgSmartWeight)) *
          100
        ).toFixed(1),
        configDiff: (
          parseFloat(luxuryGrade.avgConfigCount) - parseFloat(highGrade.avgConfigCount)
        ).toFixed(1),
      });
    }
    if (highGrade && midGrade) {
      comparisons.push({
        name: "高配 vs 中配",
        higherGrade: highGrade.gradeLabel,
        lowerGrade: midGrade.gradeLabel,
        weightDiff: (
          parseFloat(highGrade.avgSmartWeight) - parseFloat(midGrade.avgSmartWeight)
        ).toFixed(1),
        weightDiffPercent: (
          ((parseFloat(highGrade.avgSmartWeight) - parseFloat(midGrade.avgSmartWeight)) /
            parseFloat(midGrade.avgSmartWeight)) *
          100
        ).toFixed(1),
        configDiff: (
          parseFloat(highGrade.avgConfigCount) - parseFloat(midGrade.avgConfigCount)
        ).toFixed(1),
      });
    }
    if (midGrade && entryGrade) {
      comparisons.push({
        name: "中配 vs 低配",
        higherGrade: midGrade.gradeLabel,
        lowerGrade: entryGrade.gradeLabel,
        weightDiff: (
          parseFloat(midGrade.avgSmartWeight) - parseFloat(entryGrade.avgSmartWeight)
        ).toFixed(1),
        weightDiffPercent: (
          ((parseFloat(midGrade.avgSmartWeight) - parseFloat(entryGrade.avgSmartWeight)) /
            parseFloat(entryGrade.avgSmartWeight)) *
          100
        ).toFixed(1),
        configDiff: (
          parseFloat(midGrade.avgConfigCount) - parseFloat(entryGrade.avgConfigCount)
        ).toFixed(1),
      });
    }

    res.json({
      success: true,
      data: {
        byGrade: result,
        gradeComparisons: comparisons,
      },
    });
  } catch (error) {
    console.error("获取档次分析失败:", error);
    res.status(500).json({
      success: false,
      message: "获取档次分析失败",
      error: error.message,
    });
  }
};

const getHighAdoptionConfigs = async (req, res) => {
  try {
    const { minAdoptionRate = 0.7 } = req.query;

    const allVehicles = await prisma.vehicleModel.findMany();
    const totalVehicles = allVehicles.length;

    const newVehicles = allVehicles.filter((v) => v.isNewModel);
    const newVehicleIds = newVehicles.map((v) => v.id);

    const activeConfigItems = await prisma.configItem.findMany({
      where: {
        status: {
          in: ["ACTIVE", "NEW"],
        },
      },
      include: {
        vehicleConfigs: {
          select: { vehicleModelId: true, isFrequentlyUsed: true },
        },
      },
    });

    const adoptionData = activeConfigItems.map((config) => {
      const totalAdoption = config.vehicleConfigs.length;
      const newModelAdoption = config.vehicleConfigs.filter((vc) =>
        newVehicleIds.includes(vc.vehicleModelId)
      ).length;
      const totalRate = totalAdoption / totalVehicles;
      const newModelRate = newVehicles.length > 0 ? newModelAdoption / newVehicles.length : 0;

      return {
        ...config,
        categoryLabel: ConfigCategoryLabels[config.category],
        statusLabel: ConfigStatusLabels[config.status],
        featureLevelLabel: FeatureLevelLabels[config.featureLevel],
        totalAdoption,
        totalAdoptionRate: (totalRate * 100).toFixed(1),
        newModelAdoption,
        newModelAdoptionRate: (newModelRate * 100).toFixed(1),
        isHighlyAdoptedInNew: newModelRate >= parseFloat(minAdoptionRate),
        vehicleConfigs: undefined,
      };
    });

    const highlyAdopted = adoptionData
      .filter((c) => c.isHighlyAdoptedInNew || c.isHighlyAdopted)
      .sort((a, b) => parseFloat(b.newModelAdoptionRate) - parseFloat(a.newModelAdoptionRate));

    const byCategory = {};
    adoptionData.forEach((config) => {
      if (!byCategory[config.category]) {
        byCategory[config.category] = [];
      }
      byCategory[config.category].push(config);
    });

    const categoryStats = Object.entries(byCategory).map(([category, configs]) => ({
      category,
      categoryLabel: ConfigCategoryLabels[category],
      totalConfigs: configs.length,
      highlyAdoptedCount: configs.filter((c) => c.isHighlyAdopted || c.isHighlyAdoptedInNew).length,
      avgAdoptionRate: (
        configs.reduce((sum, c) => sum + parseFloat(c.totalAdoptionRate), 0) / configs.length
      ).toFixed(1),
    }));

    res.json({
      success: true,
      data: {
        summary: {
          totalConfigs: activeConfigItems.length,
          highlyAdoptedCount: highlyAdopted.length,
          totalVehicles,
          newModelCount: newVehicles.length,
        },
        highlyAdopted,
        allConfigs: adoptionData,
        byCategory: categoryStats,
      },
    });
  } catch (error) {
    console.error("获取高普及率配置失败:", error);
    res.status(500).json({
      success: false,
      message: "获取高普及率配置失败",
      error: error.message,
    });
  }
};

const getCategoryWeightAnalysis = async (req, res) => {
  try {
    const vehicles = await fetchAllVehicles();

    const categoryVehicleData = {};
    let totalAllVehiclesWeight = 0;

    vehicles.forEach((vehicle) => {
      const catWeights = calculateCategoryWeight(vehicle.vehicleConfigs, vehicle.optionPackages);
      const totalSmartWeight = calculateVehicleSmartWeight(
        vehicle.vehicleConfigs,
        vehicle.optionPackages
      );
      totalAllVehiclesWeight += totalSmartWeight;

      Object.entries(catWeights).forEach(([category, weight]) => {
        if (!categoryVehicleData[category]) {
          categoryVehicleData[category] = [];
        }
        categoryVehicleData[category].push({
          vehicleId: vehicle.id,
          vehicleName: vehicle.name,
          brand: vehicle.brand,
          grade: vehicle.grade,
          gradeLabel: VehicleGradeLabels[vehicle.grade],
          weight,
          percentage: totalSmartWeight > 0 ? ((weight / totalSmartWeight) * 100).toFixed(1) : 0,
          totalSmartWeight,
        });
      });
    });

    const categoryStats = Object.entries(categoryVehicleData)
      .map(([category, vehiclesData]) => {
        const weights = vehiclesData.map((v) => v.weight);
        const totalWeight = weights.reduce((a, b) => a + b, 0);
        const avgWeight = totalWeight / vehicles.length;
        const overallPercentage =
          totalAllVehiclesWeight > 0 ? (totalWeight / totalAllVehiclesWeight) * 100 : 0;

        const topVehicles = [...vehiclesData].sort((a, b) => b.weight - a.weight).slice(0, 3);

        return {
          category,
          categoryLabel: ConfigCategoryLabels[category] || category,
          totalWeight,
          avgWeight: avgWeight.toFixed(1),
          avgPercentage: overallPercentage.toFixed(1),
          maxWeight: Math.max(...weights).toFixed(1),
          minWeight: Math.min(...weights).toFixed(1),
          vehicleCount: vehiclesData.length,
          adoptionRate: ((vehiclesData.length / vehicles.length) * 100).toFixed(1),
          topVehicles,
          allVehicles: vehiclesData,
        };
      })
      .sort((a, b) => parseFloat(b.avgWeight) - parseFloat(a.avgWeight));

    res.json({
      success: true,
      data: {
        totalVehicles: vehicles.length,
        categories: categoryStats,
      },
    });
  } catch (error) {
    console.error("获取类别重量分析失败:", error);
    res.status(500).json({
      success: false,
      message: "获取类别重量分析失败",
      error: error.message,
    });
  }
};

const getWeightOptimizationSuggestions = async (req, res) => {
  try {
    const { weightThreshold = 2, usageThreshold = false } = req.query;

    const vehicles = await fetchAllVehicles();

    const totalVehicles = vehicles.length;
    const configAdoptionMap = {};

    vehicles.forEach((vehicle) => {
      vehicle.vehicleConfigs.forEach((vc) => {
        const configId = vc.configItem.id;
        if (!configAdoptionMap[configId]) {
          configAdoptionMap[configId] = {
            adoptionCount: 0,
            totalWeight: 0,
            typicalWeight: vc.configItem.typicalWeight,
          };
        }
        configAdoptionMap[configId].adoptionCount++;
      });
    });

    Object.keys(configAdoptionMap).forEach((configId) => {
      const stats = configAdoptionMap[configId];
      stats.adoptionRate = (stats.adoptionCount / totalVehicles) * 100;
      stats.isHighlyAdopted = stats.adoptionRate >= 50;
    });

    const allSuggestions = [];
    const ADOPTION_THRESHOLD = 50;

    vehicles.forEach((vehicle) => {
      const totalSmartWeight = calculateVehicleSmartWeight(
        vehicle.vehicleConfigs,
        vehicle.optionPackages
      );
      const vehicleSuggestions = [];
      let potentialSaving = 0;
      let redundancySaving = 0;
      let versionUpgradeSaving = 0;

      vehicle.vehicleConfigs.forEach((vc) => {
        const weight = (vc.actualWeight || vc.configItem.typicalWeight) * vc.quantity;
        const isInfrequent = !vc.isFrequentlyUsed;
        const isHeavy = weight >= parseFloat(weightThreshold);
        const isObsolete = vc.configItem.status === "OBSOLETE";
        const adoptionStats = configAdoptionMap[vc.configItem.id];
        const adoptionRate = adoptionStats ? adoptionStats.adoptionRate : 0;
        const isLowAdoption = adoptionRate < ADOPTION_THRESHOLD;
        const isHighlyAdopted = adoptionStats ? adoptionStats.isHighlyAdopted : false;

        if (isHeavy && isLowAdoption && isInfrequent) {
          const suggestion = {
            vehicleConfigId: vc.id,
            configItemId: vc.configItem.id,
            configName: vc.configItem.name,
            category: vc.configItem.category,
            categoryLabel: ConfigCategoryLabels[vc.configItem.category],
            weight,
            quantity: vc.quantity,
            isFrequentlyUsed: vc.isFrequentlyUsed,
            status: vc.configItem.status,
            statusLabel: ConfigStatusLabels[vc.configItem.status],
            isObsolete,
            adoptionRate: adoptionRate.toFixed(1),
            adoptionCount: adoptionStats ? adoptionStats.adoptionCount : 0,
            suggestionType: "redundancy",
            reason: [],
          };

          if (isObsolete) suggestion.reason.push("该配置已标记为淘汰");
          if (isInfrequent) suggestion.reason.push("单台车使用频率低");
          if (isLowAdoption)
            suggestion.reason.push(`普及率低 (${adoptionRate.toFixed(1)}% 车型采用)`);
          if (weight >= 5) suggestion.reason.push("重量较大");

          vehicleSuggestions.push(suggestion);
          potentialSaving += weight;
          redundancySaving += weight;
        }

        if (
          vc.configItem.versionGroupId &&
          vc.configItem.versions &&
          vc.configItem.versions.length > 0
        ) {
          const currentVersion = vc.configItem.versions.find(
            (v) => v.versionCode === vc.configItem.versionCode
          );
          const latestVersion =
            vc.configItem.versions.find((v) => v.isCurrent) ||
            [...vc.configItem.versions].sort((a, b) => b.versionOrder - a.versionOrder)[0];

          if (
            currentVersion &&
            latestVersion &&
            latestVersion.versionOrder > currentVersion.versionOrder
          ) {
            const currentWeight = (vc.actualWeight || currentVersion.weight) * vc.quantity;
            const newWeight = latestVersion.weight * vc.quantity;
            const saving = currentWeight - newWeight;

            if (saving > 0) {
              const suggestion = {
                vehicleConfigId: vc.id,
                configItemId: vc.configItem.id,
                configName: vc.configItem.name,
                category: vc.configItem.category,
                categoryLabel: ConfigCategoryLabels[vc.configItem.category],
                weight: saving,
                quantity: vc.quantity,
                currentVersion: currentVersion.versionCode,
                latestVersion: latestVersion.versionCode,
                currentWeight: currentWeight.toFixed(1),
                newWeight: newWeight.toFixed(1),
                suggestionType: "version_upgrade",
                reason: [
                  `版本升级可减重 ${saving.toFixed(1)}kg (${currentVersion.versionCode} → ${latestVersion.versionCode})`,
                ],
              };

              vehicleSuggestions.push(suggestion);
              potentialSaving += saving;
              versionUpgradeSaving += saving;
            }
          }
        }
      });

      if (vehicle.optionPackages.length > 0) {
        const packageWeight = calculatePackageWeight(vehicle.optionPackages);
        if (packageWeight > 0) {
          const suggestion = {
            suggestionType: "package_analysis",
            packageCount: vehicle.optionPackages.length,
            packageWeight: packageWeight.toFixed(1),
            packages: vehicle.optionPackages.map((vp) => ({
              packageId: vp.optionPackage.id,
              packageName: vp.optionPackage.name,
              weight: vp.optionPackage.items
                .reduce((s, item) => s + item.configItem.typicalWeight * item.quantity, 0)
                .toFixed(1),
              isStandard: vp.isStandard,
            })),
          };
          vehicleSuggestions.push(suggestion);
        }
      }

      if (vehicleSuggestions.length > 0) {
        allSuggestions.push({
          vehicleId: vehicle.id,
          vehicleName: vehicle.name,
          brand: vehicle.brand,
          grade: vehicle.grade,
          gradeLabel: VehicleGradeLabels[vehicle.grade],
          currentSmartWeight: totalSmartWeight,
          potentialSaving: potentialSaving.toFixed(1),
          redundancySaving: redundancySaving.toFixed(1),
          versionUpgradeSaving: versionUpgradeSaving.toFixed(1),
          savingPercent:
            totalSmartWeight > 0 ? ((potentialSaving / totalSmartWeight) * 100).toFixed(1) : 0,
          suggestionCount: vehicleSuggestions.length,
          suggestions: vehicleSuggestions.sort((a, b) => (b.weight || 0) - (a.weight || 0)),
        });
      }
    });

    const configStats = {};
    allSuggestions.forEach((vehicle) => {
      vehicle.suggestions.forEach((s) => {
        if (s.suggestionType !== "redundancy") return;
        if (!configStats[s.configItemId]) {
          configStats[s.configItemId] = {
            configItemId: s.configItemId,
            configName: s.configName,
            category: s.category,
            categoryLabel: s.categoryLabel,
            typicalWeight: s.weight / s.quantity,
            adoptionRate: s.adoptionRate,
            adoptionCount: s.adoptionCount,
            affectedVehicles: 0,
            totalWeight: 0,
          };
        }
        configStats[s.configItemId].affectedVehicles++;
        configStats[s.configItemId].totalWeight += s.weight;
      });
    });

    const frequentOffenders = Object.values(configStats)
      .sort((a, b) => b.affectedVehicles - a.affectedVehicles)
      .slice(0, 10);

    const totalVersionSaving = allSuggestions.reduce(
      (sum, v) => sum + parseFloat(v.versionUpgradeSaving),
      0
    );
    const totalRedundancySaving = allSuggestions.reduce(
      (sum, v) => sum + parseFloat(v.redundancySaving),
      0
    );
    const vehiclesWithPackages = allSuggestions.filter((v) =>
      v.suggestions.some((s) => s.suggestionType === "package_analysis")
    ).length;

    res.json({
      success: true,
      data: {
        summary: {
          totalVehiclesAnalyzed: vehicles.length,
          vehiclesWithSuggestions: allSuggestions.length,
          totalPotentialSaving: allSuggestions
            .reduce((sum, v) => sum + parseFloat(v.potentialSaving), 0)
            .toFixed(1),
          totalRedundancySaving: totalRedundancySaving.toFixed(1),
          totalVersionUpgradeSaving: totalVersionSaving.toFixed(1),
          avgSavingPerVehicle:
            allSuggestions.length > 0
              ? (
                  allSuggestions.reduce((sum, v) => sum + parseFloat(v.potentialSaving), 0) /
                  allSuggestions.length
                ).toFixed(1)
              : 0,
          vehiclesWithPackages,
          totalPackages: vehicles.reduce((sum, v) => sum + v.optionPackages.length, 0),
        },
        byVehicle: allSuggestions.sort(
          (a, b) => parseFloat(b.potentialSaving) - parseFloat(a.potentialSaving)
        ),
        frequentOffenders,
      },
    });
  } catch (error) {
    console.error("获取减重建议失败:", error);
    res.status(500).json({
      success: false,
      message: "获取减重建议失败",
      error: error.message,
    });
  }
};

module.exports = {
  getSmartWeightOverview,
  getGradeAnalysis,
  getHighAdoptionConfigs,
  getCategoryWeightAnalysis,
  getWeightOptimizationSuggestions,
};
