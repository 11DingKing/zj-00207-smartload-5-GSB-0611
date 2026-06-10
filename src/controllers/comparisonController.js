const prisma = require("../utils/prisma");
const {
  ConfigCategoryLabels,
  VehicleGradeLabels,
  FeatureLevelLabels,
  ConfigStatusLabels,
} = require("../utils/constants");

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

const calculateSmartWeight = (vehicleConfigs, optionPackages = []) => {
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
      byCategory[category] = { weight: 0, count: 0 };
    }
    byCategory[category].weight += weight;
    byCategory[category].count += vc.quantity;
  });

  optionPackages.forEach((vp) => {
    if (vp.optionPackage?.items) {
      vp.optionPackage.items.forEach((item) => {
        const category = item.configItem.category;
        const weight = item.configItem.typicalWeight * item.quantity;
        if (!byCategory[category]) {
          byCategory[category] = { weight: 0, count: 0 };
        }
        byCategory[category].weight += weight;
        byCategory[category].count += item.quantity;
      });
    }
  });

  return byCategory;
};

const enhanceConfig = (vc) => ({
  vehicleConfigId: vc.id,
  configItemId: vc.configItem.id,
  name: vc.configItem.name,
  category: vc.configItem.category,
  categoryLabel: ConfigCategoryLabels[vc.configItem.category] || vc.configItem.category,
  typicalWeight: vc.configItem.typicalWeight,
  actualWeight: vc.actualWeight,
  weight: (vc.actualWeight || vc.configItem.typicalWeight) * vc.quantity,
  quantity: vc.quantity,
  featureLevel: vc.configItem.featureLevel,
  featureLevelLabel: FeatureLevelLabels[vc.configItem.featureLevel] || vc.configItem.featureLevel,
  status: vc.configItem.status,
  statusLabel: ConfigStatusLabels[vc.configItem.status] || vc.configItem.status,
  isFrequentlyUsed: vc.isFrequentlyUsed,
  versionGroupId: vc.configItem.versionGroupId,
  versionCode: vc.configItem.versionCode,
  isLatestVersion: vc.configItem.isLatestVersion,
});

const getVehicleComparison = async (req, res) => {
  try {
    const { vehicleId1, vehicleId2 } = req.query;

    if (!vehicleId1 || !vehicleId2) {
      return res.status(400).json({ success: false, message: "请指定两个车型ID" });
    }

    if (vehicleId1 === vehicleId2) {
      return res.status(400).json({ success: false, message: "两个车型ID不能相同" });
    }

    const [vehicle1, vehicle2] = await Promise.all([
      prisma.vehicleModel.findUnique({
        where: { id: parseInt(vehicleId1) },
        include: {
          vehicleConfigs: { include: { configItem: true } },
          optionPackages: {
            include: {
              optionPackage: {
                include: { items: { include: { configItem: true } } },
              },
            },
          },
        },
      }),
      prisma.vehicleModel.findUnique({
        where: { id: parseInt(vehicleId2) },
        include: {
          vehicleConfigs: { include: { configItem: true } },
          optionPackages: {
            include: {
              optionPackage: {
                include: { items: { include: { configItem: true } } },
              },
            },
          },
        },
      }),
    ]);

    if (!vehicle1) {
      return res.status(404).json({ success: false, message: `车型ID ${vehicleId1} 不存在` });
    }
    if (!vehicle2) {
      return res.status(404).json({ success: false, message: `车型ID ${vehicleId2} 不存在` });
    }

    const weight1 = calculateSmartWeight(vehicle1.vehicleConfigs, vehicle1.optionPackages);
    const weight2 = calculateSmartWeight(vehicle2.vehicleConfigs, vehicle2.optionPackages);
    const weightDiff = weight2 - weight1;
    const smartWeightDiffPercent = weight1 > 0 ? ((weightDiff / weight1) * 100).toFixed(1) : 0;

    const catWeight1 = calculateCategoryWeight(vehicle1.vehicleConfigs, vehicle1.optionPackages);
    const catWeight2 = calculateCategoryWeight(vehicle2.vehicleConfigs, vehicle2.optionPackages);

    const categories = [...new Set([...Object.keys(catWeight1), ...Object.keys(catWeight2)])];
    const categoryComparison = categories
      .map((cat) => {
        const w1 = catWeight1[cat]?.weight || 0;
        const w2 = catWeight2[cat]?.weight || 0;
        return {
          category: cat,
          categoryLabel: ConfigCategoryLabels[cat] || cat,
          vehicle1Weight: w1,
          vehicle1Count: catWeight1[cat]?.count || 0,
          vehicle2Weight: w2,
          vehicle2Count: catWeight2[cat]?.count || 0,
          weightDiff: w2 - w1,
          weightDiffPercent: w1 > 0 ? (((w2 - w1) / w1) * 100).toFixed(1) : 0,
        };
      })
      .sort((a, b) => Math.abs(b.weightDiff) - Math.abs(a.weightDiff));

    const configs1Map = new Map(vehicle1.vehicleConfigs.map((vc) => [vc.configItem.id, vc]));
    const configs2Map = new Map(vehicle2.vehicleConfigs.map((vc) => [vc.configItem.id, vc]));
    const allConfigIds = [...new Set([...configs1Map.keys(), ...configs2Map.keys()])];

    const onlyInVehicle1 = [];
    const onlyInVehicle2 = [];
    const commonConfigs = [];
    const quantityDiff = [];

    for (const configId of allConfigIds) {
      const vc1 = configs1Map.get(configId);
      const vc2 = configs2Map.get(configId);

      if (vc1 && !vc2) {
        onlyInVehicle1.push(enhanceConfig(vc1));
      } else if (!vc1 && vc2) {
        onlyInVehicle2.push(enhanceConfig(vc2));
      } else if (vc1 && vc2) {
        const w1 = (vc1.actualWeight || vc1.configItem.typicalWeight) * vc1.quantity;
        const w2 = (vc2.actualWeight || vc2.configItem.typicalWeight) * vc2.quantity;

        commonConfigs.push({
          configItemId: configId,
          name: vc1.configItem.name,
          category: vc1.configItem.category,
          categoryLabel: ConfigCategoryLabels[vc1.configItem.category] || vc1.configItem.category,
          vehicle1: enhanceConfig(vc1),
          vehicle2: enhanceConfig(vc2),
          weightDiff: w2 - w1,
          weightDiffPercent: w1 > 0 ? (((w2 - w1) / w1) * 100).toFixed(1) : 0,
        });

        if (vc1.quantity !== vc2.quantity) {
          quantityDiff.push({
            configItemId: configId,
            name: vc1.configItem.name,
            category: vc1.configItem.category,
            categoryLabel: ConfigCategoryLabels[vc1.configItem.category] || vc1.configItem.category,
            vehicle1Quantity: vc1.quantity,
            vehicle2Quantity: vc2.quantity,
            quantityDiff: vc2.quantity - vc1.quantity,
            weightImpact: w2 - w1,
          });
        }
      }
    }

    const weightOnlyIn1 = onlyInVehicle1.reduce((sum, c) => sum + c.weight, 0);
    const weightOnlyIn2 = onlyInVehicle2.reduce((sum, c) => sum + c.weight, 0);

    const packages1 = vehicle1.optionPackages.map((vp) => ({
      packageId: vp.optionPackage.id,
      name: vp.optionPackage.name,
      code: vp.optionPackage.code,
      isStandard: vp.isStandard,
      totalWeight: vp.optionPackage.items.reduce(
        (sum, item) => sum + item.configItem.typicalWeight * item.quantity,
        0
      ),
    }));
    const packages2 = vehicle2.optionPackages.map((vp) => ({
      packageId: vp.optionPackage.id,
      name: vp.optionPackage.name,
      code: vp.optionPackage.code,
      isStandard: vp.isStandard,
      totalWeight: vp.optionPackage.items.reduce(
        (sum, item) => sum + item.configItem.typicalWeight * item.quantity,
        0
      ),
    }));

    const pkgWeight1 = packages1.reduce((sum, p) => sum + p.totalWeight, 0);
    const pkgWeight2 = packages2.reduce((sum, p) => sum + p.totalWeight, 0);

    const pkgMap1 = new Map(packages1.map((p) => [p.packageId, p]));
    const pkgMap2 = new Map(packages2.map((p) => [p.packageId, p]));
    const allPkgIds = [...new Set([...pkgMap1.keys(), ...pkgMap2.keys()])];

    const packageComparison = allPkgIds.map((pkgId) => {
      const p1 = pkgMap1.get(pkgId);
      const p2 = pkgMap2.get(pkgId);
      return {
        packageId: pkgId,
        name: p1?.name || p2?.name,
        code: p1?.code || p2?.code,
        inVehicle1: !!p1,
        inVehicle2: !!p2,
        vehicle1Standard: p1?.isStandard,
        vehicle2Standard: p2?.isStandard,
        weightDiff: (p2?.totalWeight || 0) - (p1?.totalWeight || 0),
      };
    });

    res.json({
      success: true,
      data: {
        vehicles: {
          vehicle1: {
            id: vehicle1.id,
            name: vehicle1.name,
            brand: vehicle1.brand,
            grade: vehicle1.grade,
            gradeLabel: VehicleGradeLabels[vehicle1.grade] || vehicle1.grade,
            baseWeight: vehicle1.baseWeight,
            modelYear: vehicle1.modelYear,
            smartWeight: weight1,
            totalWeight: vehicle1.baseWeight + weight1,
            configCount: vehicle1.vehicleConfigs.length,
            packageCount: packages1.length,
            packagesWeight: pkgWeight1,
            packages: packages1,
          },
          vehicle2: {
            id: vehicle2.id,
            name: vehicle2.name,
            brand: vehicle2.brand,
            grade: vehicle2.grade,
            gradeLabel: VehicleGradeLabels[vehicle2.grade] || vehicle2.grade,
            baseWeight: vehicle2.baseWeight,
            modelYear: vehicle2.modelYear,
            smartWeight: weight2,
            totalWeight: vehicle2.baseWeight + weight2,
            configCount: vehicle2.vehicleConfigs.length,
            packageCount: packages2.length,
            packagesWeight: pkgWeight2,
            packages: packages2,
          },
        },
        summary: {
          baseWeightDiff: vehicle2.baseWeight - vehicle1.baseWeight,
          smartWeightDiff: weightDiff,
          smartWeightDiffPercent,
          totalWeightDiff: vehicle2.baseWeight + weight2 - (vehicle1.baseWeight + weight1),
          configCountDiff: vehicle2.vehicleConfigs.length - vehicle1.vehicleConfigs.length,
          packageCountDiff: packages2.length - packages1.length,
          packagesWeightDiff: pkgWeight2 - pkgWeight1,
          onlyInVehicle1Count: onlyInVehicle1.length,
          onlyInVehicle1Weight: weightOnlyIn1,
          onlyInVehicle2Count: onlyInVehicle2.length,
          onlyInVehicle2Weight: weightOnlyIn2,
          commonCount: commonConfigs.length,
          quantityDiffCount: quantityDiff.length,
        },
        categoryComparison,
        details: {
          onlyInVehicle1: onlyInVehicle1.sort((a, b) => b.weight - a.weight),
          onlyInVehicle2: onlyInVehicle2.sort((a, b) => b.weight - a.weight),
          commonConfigs: commonConfigs.sort(
            (a, b) => Math.abs(b.weightDiff) - Math.abs(a.weightDiff)
          ),
          quantityDiff: quantityDiff.sort(
            (a, b) => Math.abs(b.weightImpact) - Math.abs(a.weightImpact)
          ),
        },
        packageComparison,
      },
    });
  } catch (error) {
    console.error("车型对比失败:", error);
    res.status(500).json({ success: false, message: "车型对比失败", error: error.message });
  }
};

const getMultiVehicleComparison = async (req, res) => {
  try {
    const { vehicleIds } = req.query;
    if (!vehicleIds) {
      return res.status(400).json({ success: false, message: "请指定车型ID列表，用逗号分隔" });
    }

    const ids = vehicleIds
      .split(",")
      .map((id) => parseInt(id.trim()))
      .filter(Boolean);
    if (ids.length < 2) {
      return res.status(400).json({ success: false, message: "至少需要指定2个车型" });
    }

    const vehicles = await Promise.all(
      ids.map((id) =>
        prisma.vehicleModel.findUnique({
          where: { id },
          include: {
            vehicleConfigs: { include: { configItem: true } },
            optionPackages: {
              include: {
                optionPackage: {
                  include: { items: { include: { configItem: true } } },
                },
              },
            },
          },
        })
      )
    );

    const validVehicles = vehicles.filter(Boolean);
    if (validVehicles.length < 2) {
      return res.status(400).json({ success: false, message: "有效的车型不足2个" });
    }

    const vehicleData = validVehicles.map((v) => ({
      id: v.id,
      name: v.name,
      brand: v.brand,
      grade: v.grade,
      gradeLabel: VehicleGradeLabels[v.grade] || v.grade,
      baseWeight: v.baseWeight,
      smartWeight: calculateSmartWeight(v.vehicleConfigs, v.optionPackages),
      configCount: v.vehicleConfigs.length,
      packageCount: v.optionPackages.length,
      configIds: new Set(v.vehicleConfigs.map((vc) => vc.configItem.id)),
      categoryWeights: calculateCategoryWeight(v.vehicleConfigs, v.optionPackages),
    }));

    const allConfigIds = new Set();
    vehicleData.forEach((v) => v.configIds.forEach((id) => allConfigIds.add(id)));

    const configCoverage = [];
    for (const configId of allConfigIds) {
      const configItem = await prisma.configItem.findUnique({
        where: { id: configId },
      });
      if (!configItem) continue;

      const coverage = vehicleData.map((v) => ({
        vehicleId: v.id,
        vehicleName: v.name,
        present: v.configIds.has(configId),
      }));
      const presentCount = coverage.filter((c) => c.present).length;

      configCoverage.push({
        configItemId: configId,
        name: configItem.name,
        category: configItem.category,
        categoryLabel: ConfigCategoryLabels[configItem.category] || configItem.category,
        typicalWeight: configItem.typicalWeight,
        coverage: presentCount,
        coveragePercent: ((presentCount / vehicleData.length) * 100).toFixed(1),
        vehicles: coverage,
      });
    }

    const categories = [...new Set(configCoverage.map((c) => c.category))];
    const categoryStats = categories.map((cat) => {
      const configs = configCoverage.filter((c) => c.category === cat);
      return {
        category: cat,
        categoryLabel: ConfigCategoryLabels[cat] || cat,
        totalConfigs: configs.length,
        avgCoverage: (
          configs.reduce((sum, c) => sum + parseFloat(c.coveragePercent), 0) / configs.length
        ).toFixed(1),
      };
    });

    const weightMatrix = vehicleData.map((v1) => ({
      vehicleId: v1.id,
      vehicleName: v1.name,
      comparisons: vehicleData.map((v2) => ({
        vehicleId: v2.id,
        vehicleName: v2.name,
        weightDiff: v2.smartWeight - v1.smartWeight,
        weightDiffPercent:
          v1.smartWeight > 0
            ? (((v2.smartWeight - v1.smartWeight) / v1.smartWeight) * 100).toFixed(1)
            : 0,
        configDiff: v2.configCount - v1.configCount,
        isSame: v1.id === v2.id,
      })),
    }));

    res.json({
      success: true,
      data: {
        vehicles: vehicleData
          .map((v) => ({
            id: v.id,
            name: v.name,
            brand: v.brand,
            gradeLabel: v.gradeLabel,
            baseWeight: v.baseWeight,
            smartWeight: v.smartWeight,
            totalWeight: v.baseWeight + v.smartWeight,
            configCount: v.configCount,
            packageCount: v.packageCount,
          }))
          .sort((a, b) => a.smartWeight - b.smartWeight),
        weightMatrix,
        configCoverage: configCoverage.sort(
          (a, b) => parseFloat(b.coveragePercent) - parseFloat(a.coveragePercent)
        ),
        categoryStats: categoryStats.sort(
          (a, b) => parseFloat(b.avgCoverage) - parseFloat(a.avgCoverage)
        ),
      },
    });
  } catch (error) {
    console.error("多车型对比失败:", error);
    res.status(500).json({
      success: false,
      message: "多车型对比失败",
      error: error.message,
    });
  }
};

const getWeightComparisonByGrade = async (req, res) => {
  try {
    const vehicles = await prisma.vehicleModel.findMany({
      include: {
        vehicleConfigs: { include: { configItem: true } },
        optionPackages: {
          include: {
            optionPackage: {
              include: { items: { include: { configItem: true } } },
            },
          },
        },
      },
    });

    const gradeOrder = ["ENTRY", "MID", "HIGH", "LUXURY"];
    const byGrade = {};

    for (const grade of gradeOrder) {
      const gradeVehicles = vehicles.filter((v) => v.grade === grade);
      if (gradeVehicles.length === 0) continue;

      const weights = gradeVehicles.map((v) =>
        calculateSmartWeight(v.vehicleConfigs, v.optionPackages)
      );
      const pkgWeights = gradeVehicles.map((v) =>
        v.optionPackages.reduce(
          (sum, vp) =>
            sum +
            vp.optionPackage.items.reduce(
              (s, item) => s + item.configItem.typicalWeight * item.quantity,
              0
            ),
          0
        )
      );

      byGrade[grade] = {
        grade,
        gradeLabel: VehicleGradeLabels[grade] || grade,
        vehicleCount: gradeVehicles.length,
        avgSmartWeight: (weights.reduce((a, b) => a + b, 0) / weights.length).toFixed(1),
        minSmartWeight: Math.min(...weights).toFixed(1),
        maxSmartWeight: Math.max(...weights).toFixed(1),
        avgPackageWeight: (pkgWeights.reduce((a, b) => a + b, 0) / pkgWeights.length).toFixed(1),
        avgPackageCount: (
          gradeVehicles.reduce((sum, v) => sum + v.optionPackages.length, 0) / gradeVehicles.length
        ).toFixed(1),
      };
    }

    const grades = Object.values(byGrade);
    const gradeComparison = [];
    for (let i = 0; i < grades.length - 1; i++) {
      for (let j = i + 1; j < grades.length; j++) {
        const g1 = grades[i];
        const g2 = grades[j];
        const weightDiff = parseFloat(g2.avgSmartWeight) - parseFloat(g1.avgSmartWeight);
        gradeComparison.push({
          comparison: `${g1.gradeLabel} vs ${g2.gradeLabel}`,
          lowerGrade: g1.gradeLabel,
          higherGrade: g2.gradeLabel,
          weightDiff: weightDiff.toFixed(1),
          weightDiffPercent: ((weightDiff / parseFloat(g1.avgSmartWeight)) * 100).toFixed(1),
        });
      }
    }

    res.json({
      success: true,
      data: {
        byGrade: grades,
        gradeComparison,
      },
    });
  } catch (error) {
    console.error("档次重量对比失败:", error);
    res.status(500).json({
      success: false,
      message: "档次重量对比失败",
      error: error.message,
    });
  }
};

module.exports = {
  getVehicleComparison,
  getMultiVehicleComparison,
  getWeightComparisonByGrade,
};
