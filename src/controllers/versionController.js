const prisma = require("../utils/prisma");
const { ConfigCategoryLabels } = require("../utils/constants");

const enhanceVersion = (version) => {
  return {
    ...version,
    configItem: version.configItem
      ? {
          ...version.configItem,
          categoryLabel:
            ConfigCategoryLabels[version.configItem.category] || version.configItem.category,
        }
      : undefined,
  };
};

const getVersions = async (req, res) => {
  try {
    const { versionGroupId, configItemId, isCurrent, minReleaseYear, maxReleaseYear } = req.query;
    const where = {};

    if (versionGroupId) where.versionGroupId = versionGroupId;
    if (configItemId) where.configItemId = parseInt(configItemId);
    if (isCurrent !== undefined) where.isCurrent = isCurrent === "true";
    if (minReleaseYear) where.releaseYear = { ...where.releaseYear, gte: parseInt(minReleaseYear) };
    if (maxReleaseYear) where.releaseYear = { ...where.releaseYear, lte: parseInt(maxReleaseYear) };

    const versions = await prisma.configItemVersion.findMany({
      where,
      include: { configItem: true },
      orderBy: [{ versionGroupId: "asc" }, { versionOrder: "asc" }],
    });

    const enhanced = versions.map(enhanceVersion);
    res.json({ success: true, data: enhanced, count: enhanced.length });
  } catch (error) {
    console.error("获取版本列表失败:", error);
    res.status(500).json({ success: false, message: "获取版本列表失败", error: error.message });
  }
};

const getVersionById = async (req, res) => {
  try {
    const { id } = req.params;
    const version = await prisma.configItemVersion.findUnique({
      where: { id: parseInt(id) },
      include: { configItem: true },
    });

    if (!version) {
      return res.status(404).json({ success: false, message: "版本不存在" });
    }

    res.json({ success: true, data: enhanceVersion(version) });
  } catch (error) {
    console.error("获取版本详情失败:", error);
    res.status(500).json({ success: false, message: "获取版本详情失败", error: error.message });
  }
};

const getVersionGroup = async (req, res) => {
  try {
    const { versionGroupId } = req.params;
    const versions = await prisma.configItemVersion.findMany({
      where: { versionGroupId },
      include: { configItem: true },
      orderBy: { versionOrder: "asc" },
    });

    if (versions.length === 0) {
      return res.status(404).json({ success: false, message: "版本组不存在" });
    }

    const weightTrend = versions.map((v, i) => ({
      version: v.versionCode,
      versionName: v.versionName,
      releaseYear: v.releaseYear,
      weight: v.weight,
      weightSaving: v.weightSaving,
      cumulativeSaving: versions.slice(0, i + 1).reduce((sum, ver) => sum + ver.weightSaving, 0),
    }));

    const totalSaving = weightTrend[weightTrend.length - 1]?.cumulativeSaving || 0;
    const firstWeight = weightTrend[0]?.weight || 0;
    const latestWeight = weightTrend[weightTrend.length - 1]?.weight || 0;
    const reductionPercent =
      firstWeight > 0 ? (((firstWeight - latestWeight) / firstWeight) * 100).toFixed(1) : 0;

    res.json({
      success: true,
      data: {
        versionGroupId,
        configItemName: versions[0].configItem?.name,
        category: versions[0].configItem?.category,
        categoryLabel:
          ConfigCategoryLabels[versions[0].configItem?.category] ||
          versions[0].configItem?.category,
        totalVersions: versions.length,
        firstWeight,
        latestWeight,
        totalSaving,
        reductionPercent,
        weightTrend,
        versions: versions.map(enhanceVersion),
      },
    });
  } catch (error) {
    console.error("获取版本组详情失败:", error);
    res.status(500).json({ success: false, message: "获取版本组详情失败", error: error.message });
  }
};

const createVersion = async (req, res) => {
  try {
    const {
      configItemId,
      versionGroupId,
      versionCode,
      versionName,
      versionOrder,
      weight,
      weightSaving,
      releaseYear,
      isCurrent,
      description,
      improvementNotes,
    } = req.body;

    if (!configItemId || !versionGroupId || !versionCode || !versionName || weight === undefined) {
      return res.status(400).json({ success: false, message: "缺少必要参数" });
    }

    const version = await prisma.configItemVersion.create({
      data: {
        configItemId: parseInt(configItemId),
        versionGroupId,
        versionCode,
        versionName,
        versionOrder: versionOrder || 0,
        weight: parseFloat(weight),
        weightSaving: weightSaving !== undefined ? parseFloat(weightSaving) : 0,
        releaseYear: releaseYear ? parseInt(releaseYear) : null,
        isCurrent: isCurrent || false,
        description,
        improvementNotes,
      },
      include: { configItem: true },
    });

    res.status(201).json({ success: true, data: enhanceVersion(version), message: "版本创建成功" });
  } catch (error) {
    console.error("创建版本失败:", error);
    res.status(500).json({ success: false, message: "创建版本失败", error: error.message });
  }
};

const updateVersion = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.configItemVersion.findUnique({ where: { id: parseInt(id) } });
    if (!existing) {
      return res.status(404).json({ success: false, message: "版本不存在" });
    }

    const {
      versionGroupId,
      versionCode,
      versionName,
      versionOrder,
      weight,
      weightSaving,
      releaseYear,
      isCurrent,
      description,
      improvementNotes,
    } = req.body;

    const version = await prisma.configItemVersion.update({
      where: { id: parseInt(id) },
      data: {
        versionGroupId,
        versionCode,
        versionName,
        versionOrder,
        weight: weight !== undefined ? parseFloat(weight) : undefined,
        weightSaving: weightSaving !== undefined ? parseFloat(weightSaving) : undefined,
        releaseYear: releaseYear ? parseInt(releaseYear) : undefined,
        isCurrent,
        description,
        improvementNotes,
      },
      include: { configItem: true },
    });

    res.json({ success: true, data: enhanceVersion(version), message: "版本更新成功" });
  } catch (error) {
    console.error("更新版本失败:", error);
    res.status(500).json({ success: false, message: "更新版本失败", error: error.message });
  }
};

const deleteVersion = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.configItemVersion.findUnique({ where: { id: parseInt(id) } });
    if (!existing) {
      return res.status(404).json({ success: false, message: "版本不存在" });
    }

    await prisma.configItemVersion.delete({ where: { id: parseInt(id) } });
    res.json({ success: true, message: "版本删除成功" });
  } catch (error) {
    console.error("删除版本失败:", error);
    res.status(500).json({ success: false, message: "删除版本失败", error: error.message });
  }
};

const getVersionComparison = async (req, res) => {
  try {
    const { fromVersionId, toVersionId } = req.query;

    if (!fromVersionId || !toVersionId) {
      return res.status(400).json({ success: false, message: "请指定两个版本ID" });
    }

    const [fromVersion, toVersion] = await Promise.all([
      prisma.configItemVersion.findUnique({
        where: { id: parseInt(fromVersionId) },
        include: { configItem: true },
      }),
      prisma.configItemVersion.findUnique({
        where: { id: parseInt(toVersionId) },
        include: { configItem: true },
      }),
    ]);

    if (!fromVersion || !toVersion) {
      return res.status(404).json({ success: false, message: "版本不存在" });
    }

    if (fromVersion.versionGroupId !== toVersion.versionGroupId) {
      return res.status(400).json({ success: false, message: "两个版本必须属于同一个版本组" });
    }

    const weightDiff = toVersion.weight - fromVersion.weight;
    const weightDiffPercent =
      fromVersion.weight > 0 ? ((weightDiff / fromVersion.weight) * 100).toFixed(1) : 0;

    res.json({
      success: true,
      data: {
        fromVersion: enhanceVersion(fromVersion),
        toVersion: enhanceVersion(toVersion),
        weightDiff,
        weightDiffPercent,
        isWeightReduction: weightDiff < 0,
        improvementNotes: toVersion.improvementNotes,
      },
    });
  } catch (error) {
    console.error("版本对比失败:", error);
    res.status(500).json({ success: false, message: "版本对比失败", error: error.message });
  }
};

const getVehicleUpgradeAnalysis = async (req, res) => {
  try {
    const { vehicleId } = req.params;

    const vehicle = await prisma.vehicleModel.findUnique({
      where: { id: parseInt(vehicleId) },
      include: {
        vehicleConfigs: {
          include: { configItem: { include: { versions: true } } },
        },
      },
    });

    if (!vehicle) {
      return res.status(404).json({ success: false, message: "车型不存在" });
    }

    const upgradeOpportunities = [];
    let totalPotentialSaving = 0;

    for (const vc of vehicle.vehicleConfigs) {
      const configItem = vc.configItem;
      if (!configItem.versionGroupId) continue;

      const versions = configItem.versions || [];
      const currentVersion = versions.find((v) => v.versionCode === configItem.versionCode);
      const latestVersion =
        versions.find((v) => v.isCurrent) ||
        [...versions].sort((a, b) => b.versionOrder - a.versionOrder)[0];

      if (
        currentVersion &&
        latestVersion &&
        latestVersion.versionOrder > currentVersion.versionOrder
      ) {
        const currentWeight = (vc.actualWeight || currentVersion.weight) * vc.quantity;
        const newWeight = latestVersion.weight * vc.quantity;
        const weightSaving = currentWeight - newWeight;

        if (weightSaving > 0) {
          totalPotentialSaving += weightSaving;
          upgradeOpportunities.push({
            configItemId: configItem.id,
            configName: configItem.name,
            category: configItem.category,
            categoryLabel: ConfigCategoryLabels[configItem.category] || configItem.category,
            currentVersion: currentVersion.versionCode,
            currentVersionName: currentVersion.versionName,
            currentWeight: currentVersion.weight,
            latestVersion: latestVersion.versionCode,
            latestVersionName: latestVersion.versionName,
            latestWeight: latestVersion.weight,
            quantity: vc.quantity,
            weightSaving,
            weightSavingPercent: ((weightSaving / currentWeight) * 100).toFixed(1),
            improvementNotes: latestVersion.improvementNotes,
            releaseYear: latestVersion.releaseYear,
          });
        }
      }
    }

    const currentSmartWeight = vehicle.vehicleConfigs.reduce((sum, vc) => {
      const weight = vc.actualWeight || vc.configItem.typicalWeight;
      return sum + weight * vc.quantity;
    }, 0);

    res.json({
      success: true,
      data: {
        vehicleId: vehicle.id,
        vehicleName: vehicle.name,
        brand: vehicle.brand,
        currentSmartWeight,
        totalPotentialSaving,
        savingPercent:
          currentSmartWeight > 0
            ? ((totalPotentialSaving / currentSmartWeight) * 100).toFixed(1)
            : 0,
        upgradeCount: upgradeOpportunities.length,
        upgrades: upgradeOpportunities.sort((a, b) => b.weightSaving - a.weightSaving),
      },
    });
  } catch (error) {
    console.error("车型升级分析失败:", error);
    res.status(500).json({ success: false, message: "车型升级分析失败", error: error.message });
  }
};

const getAllVersionGroups = async (req, res) => {
  try {
    const versions = await prisma.configItemVersion.findMany({
      include: { configItem: true },
      orderBy: [{ versionGroupId: "asc" }, { versionOrder: "asc" }],
    });

    const groupsMap = {};
    for (const v of versions) {
      if (!groupsMap[v.versionGroupId]) {
        groupsMap[v.versionGroupId] = {
          versionGroupId: v.versionGroupId,
          configItemName: v.configItem?.name,
          category: v.configItem?.category,
          categoryLabel: ConfigCategoryLabels[v.configItem?.category] || v.configItem?.category,
          versions: [],
          weightTrend: [],
          totalSaving: 0,
          firstWeight: 0,
          latestWeight: 0,
        };
      }
      groupsMap[v.versionGroupId].versions.push(v);
    }

    const groups = Object.values(groupsMap).map((group) => {
      const sortedVersions = group.versions.sort((a, b) => a.versionOrder - b.versionOrder);
      const weightTrend = sortedVersions.map((v, i) => ({
        version: v.versionCode,
        versionName: v.versionName,
        releaseYear: v.releaseYear,
        weight: v.weight,
        weightSaving: v.weightSaving,
        cumulativeSaving: sortedVersions
          .slice(0, i + 1)
          .reduce((sum, ver) => sum + ver.weightSaving, 0),
      }));
      return {
        ...group,
        versions: sortedVersions.map(enhanceVersion),
        weightTrend,
        totalVersions: sortedVersions.length,
        firstWeight: weightTrend[0]?.weight || 0,
        latestWeight: weightTrend[weightTrend.length - 1]?.weight || 0,
        totalSaving: weightTrend[weightTrend.length - 1]?.cumulativeSaving || 0,
        reductionPercent:
          weightTrend[0]?.weight > 0
            ? (
                (((weightTrend[0]?.weight || 0) -
                  (weightTrend[weightTrend.length - 1]?.weight || 0)) /
                  (weightTrend[0]?.weight || 1)) *
                100
              ).toFixed(1)
            : 0,
      };
    });

    const totalSaving = groups.reduce((sum, g) => sum + g.totalSaving, 0);
    const avgReduction =
      groups.length > 0
        ? (
            groups.reduce((sum, g) => sum + parseFloat(g.reductionPercent), 0) / groups.length
          ).toFixed(1)
        : 0;

    res.json({
      success: true,
      data: {
        summary: {
          totalGroups: groups.length,
          totalVersions: versions.length,
          totalSaving,
          avgReduction,
        },
        groups: groups.sort((a, b) => b.totalSaving - a.totalSaving),
      },
    });
  } catch (error) {
    console.error("获取所有版本组失败:", error);
    res.status(500).json({ success: false, message: "获取所有版本组失败", error: error.message });
  }
};

module.exports = {
  getVersions,
  getVersionById,
  getVersionGroup,
  createVersion,
  updateVersion,
  deleteVersion,
  getVersionComparison,
  getVehicleUpgradeAnalysis,
  getAllVersionGroups,
};
