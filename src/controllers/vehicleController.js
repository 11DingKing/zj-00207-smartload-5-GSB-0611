const prisma = require("../utils/prisma");
const {
  VehicleGrade,
  VehicleGradeLabels,
  ConfigCategoryLabels,
  ConfigStatusLabels,
  FeatureLevelLabels,
} = require("../utils/constants");

const validateVehicleModel = (data) => {
  const errors = [];
  if (!data.name || data.name.trim() === "") {
    errors.push("车型名称不能为空");
  }
  if (!data.brand || data.brand.trim() === "") {
    errors.push("品牌不能为空");
  }
  if (!data.grade || !Object.values(VehicleGrade).includes(data.grade)) {
    errors.push("无效的车型档次");
  }
  if (!Number.isInteger(data.modelYear) || data.modelYear < 2000 || data.modelYear > 2030) {
    errors.push("无效的年款");
  }
  if (typeof data.baseWeight !== "number" || data.baseWeight <= 0) {
    errors.push("基础重量必须为正数");
  }
  return errors;
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

const calculateWeight = (vehicleConfigs, optionPackages = []) => {
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

  const totalWeight = configWeight + packageWeight;

  const byCategory = {};
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

  const categoryBreakdown = Object.entries(byCategory)
    .map(([category, data]) => ({
      category,
      categoryLabel: ConfigCategoryLabels[category] || category,
      weight: data.weight,
      count: data.count,
      percentage: totalWeight > 0 ? ((data.weight / totalWeight) * 100).toFixed(1) : 0,
    }))
    .sort((a, b) => b.weight - a.weight);

  return {
    totalWeight,
    categoryBreakdown,
    totalConfigs: vehicleConfigs.length,
  };
};

const enhanceVehicleModel = (vehicle) => {
  const weightInfo = vehicle.vehicleConfigs
    ? calculateWeight(vehicle.vehicleConfigs, vehicle.optionPackages || [])
    : null;
  return {
    ...vehicle,
    gradeLabel: VehicleGradeLabels[vehicle.grade] || vehicle.grade,
    smartWeight: weightInfo?.totalWeight || 0,
    categoryBreakdown: weightInfo?.categoryBreakdown || [],
    totalConfigs: weightInfo?.totalConfigs || 0,
    totalWeight: (vehicle.baseWeight || 0) + (weightInfo?.totalWeight || 0),
  };
};

const getVehicles = async (req, res) => {
  try {
    const { brand, grade, modelYear, isNewModel, search, minWeight, maxWeight } = req.query;
    const where = {};

    if (brand) where.brand = brand;
    if (grade) where.grade = grade;
    if (modelYear) where.modelYear = parseInt(modelYear);
    if (isNewModel !== undefined) where.isNewModel = isNewModel === "true";
    if (search) {
      where.OR = [{ name: { contains: search } }, { brand: { contains: search } }];
    }

    const vehicles = await prisma.vehicleModel.findMany({
      where,
      include: {
        vehicleConfigs: {
          include: { configItem: true },
        },
        optionPackages: {
          include: {
            optionPackage: {
              include: { items: { include: { configItem: true } } },
            },
          },
        },
      },
      orderBy: [{ brand: "asc" }, { name: "asc" }],
    });

    let enhanced = vehicles.map(enhanceVehicleModel);

    if (minWeight !== undefined) {
      enhanced = enhanced.filter((v) => v.smartWeight >= parseFloat(minWeight));
    }
    if (maxWeight !== undefined) {
      enhanced = enhanced.filter((v) => v.smartWeight <= parseFloat(maxWeight));
    }

    res.json({ success: true, data: enhanced, count: enhanced.length });
  } catch (error) {
    console.error("获取车型列表失败:", error);
    res.status(500).json({
      success: false,
      message: "获取车型列表失败",
      error: error.message,
    });
  }
};

const getVehicleById = async (req, res) => {
  try {
    const { id } = req.params;
    const vehicle = await prisma.vehicleModel.findUnique({
      where: { id: parseInt(id) },
      include: {
        vehicleConfigs: {
          include: { configItem: true },
          orderBy: { createdAt: "asc" },
        },
        optionPackages: {
          include: {
            optionPackage: {
              include: { items: { include: { configItem: true } } },
            },
          },
        },
      },
    });

    if (!vehicle) {
      return res.status(404).json({ success: false, message: "车型不存在" });
    }

    const enhancedConfigs = vehicle.vehicleConfigs.map((vc) => ({
      ...vc,
      configItem: {
        ...vc.configItem,
        categoryLabel: ConfigCategoryLabels[vc.configItem.category],
        statusLabel: ConfigStatusLabels[vc.configItem.status],
        featureLevelLabel: FeatureLevelLabels[vc.configItem.featureLevel],
      },
    }));

    const result = enhanceVehicleModel({
      ...vehicle,
      vehicleConfigs: enhancedConfigs,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error("获取车型详情失败:", error);
    res.status(500).json({
      success: false,
      message: "获取车型详情失败",
      error: error.message,
    });
  }
};

const createVehicle = async (req, res) => {
  try {
    const errors = validateVehicleModel(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: "参数校验失败", errors });
    }

    const vehicle = await prisma.vehicleModel.create({
      data: {
        name: req.body.name,
        brand: req.body.brand,
        grade: req.body.grade,
        modelYear: req.body.modelYear,
        baseWeight: req.body.baseWeight,
        description: req.body.description,
        isNewModel: req.body.isNewModel || false,
      },
      include: { vehicleConfigs: { include: { configItem: true } } },
    });

    res.status(201).json({
      success: true,
      data: enhanceVehicleModel(vehicle),
      message: "车型创建成功",
    });
  } catch (error) {
    console.error("创建车型失败:", error);
    res.status(500).json({ success: false, message: "创建车型失败", error: error.message });
  }
};

const updateVehicle = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.vehicleModel.findUnique({
      where: { id: parseInt(id) },
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: "车型不存在" });
    }

    const errors = validateVehicleModel(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: "参数校验失败", errors });
    }

    const vehicle = await prisma.vehicleModel.update({
      where: { id: parseInt(id) },
      data: {
        name: req.body.name,
        brand: req.body.brand,
        grade: req.body.grade,
        modelYear: req.body.modelYear,
        baseWeight: req.body.baseWeight,
        description: req.body.description,
        isNewModel: req.body.isNewModel,
      },
      include: { vehicleConfigs: { include: { configItem: true } } },
    });

    res.json({
      success: true,
      data: enhanceVehicleModel(vehicle),
      message: "车型更新成功",
    });
  } catch (error) {
    console.error("更新车型失败:", error);
    res.status(500).json({ success: false, message: "更新车型失败", error: error.message });
  }
};

const deleteVehicle = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.vehicleModel.findUnique({
      where: { id: parseInt(id) },
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: "车型不存在" });
    }

    await prisma.vehicleModel.delete({ where: { id: parseInt(id) } });
    res.json({ success: true, message: "车型删除成功" });
  } catch (error) {
    console.error("删除车型失败:", error);
    res.status(500).json({ success: false, message: "删除车型失败", error: error.message });
  }
};

const addConfigToVehicle = async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const { configItemId, quantity, actualWeight, isFrequentlyUsed, adoptionDate } = req.body;

    const vehicle = await prisma.vehicleModel.findUnique({
      where: { id: parseInt(vehicleId) },
    });
    if (!vehicle) {
      return res.status(404).json({ success: false, message: "车型不存在" });
    }

    const configItem = await prisma.configItem.findUnique({
      where: { id: configItemId },
    });
    if (!configItem) {
      return res.status(404).json({ success: false, message: "配置项不存在" });
    }

    const vehicleConfig = await prisma.vehicleConfig.create({
      data: {
        vehicleModelId: parseInt(vehicleId),
        configItemId,
        quantity: quantity || 1,
        actualWeight,
        isFrequentlyUsed: isFrequentlyUsed !== undefined ? isFrequentlyUsed : true,
        adoptionDate: adoptionDate ? new Date(adoptionDate) : null,
      },
      include: { configItem: true },
    });

    res.status(201).json({ success: true, data: vehicleConfig, message: "配置项添加成功" });
  } catch (error) {
    console.error("添加配置项失败:", error);
    if (error.code === "P2002") {
      return res.status(400).json({ success: false, message: "该车型已搭载此配置项" });
    }
    res.status(500).json({
      success: false,
      message: "添加配置项失败",
      error: error.message,
    });
  }
};

const updateVehicleConfig = async (req, res) => {
  try {
    const { vehicleId, configId } = req.params;
    const { quantity, actualWeight, isFrequentlyUsed, adoptionDate } = req.body;

    const existing = await prisma.vehicleConfig.findUnique({
      where: { id: parseInt(configId), vehicleModelId: parseInt(vehicleId) },
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: "搭载关系不存在" });
    }

    const vehicleConfig = await prisma.vehicleConfig.update({
      where: { id: parseInt(configId) },
      data: {
        quantity,
        actualWeight,
        isFrequentlyUsed,
        adoptionDate: adoptionDate ? new Date(adoptionDate) : existing.adoptionDate,
      },
      include: { configItem: true },
    });

    res.json({
      success: true,
      data: vehicleConfig,
      message: "搭载配置更新成功",
    });
  } catch (error) {
    console.error("更新搭载配置失败:", error);
    res.status(500).json({
      success: false,
      message: "更新搭载配置失败",
      error: error.message,
    });
  }
};

const removeConfigFromVehicle = async (req, res) => {
  try {
    const { vehicleId, configId } = req.params;

    const existing = await prisma.vehicleConfig.findUnique({
      where: { id: parseInt(configId), vehicleModelId: parseInt(vehicleId) },
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: "搭载关系不存在" });
    }

    await prisma.vehicleConfig.delete({ where: { id: parseInt(configId) } });
    res.json({ success: true, message: "配置项移除成功" });
  } catch (error) {
    console.error("移除配置项失败:", error);
    res.status(500).json({
      success: false,
      message: "移除配置项失败",
      error: error.message,
    });
  }
};

const batchUpdateConfigs = async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const { configs } = req.body;

    const vehicle = await prisma.vehicleModel.findUnique({
      where: { id: parseInt(vehicleId) },
    });
    if (!vehicle) {
      return res.status(404).json({ success: false, message: "车型不存在" });
    }

    await prisma.$transaction(async (tx) => {
      await tx.vehicleConfig.deleteMany({
        where: { vehicleModelId: parseInt(vehicleId) },
      });

      for (const config of configs) {
        await tx.vehicleConfig.create({
          data: {
            vehicleModelId: parseInt(vehicleId),
            configItemId: config.configItemId,
            quantity: config.quantity || 1,
            actualWeight: config.actualWeight,
            isFrequentlyUsed:
              config.isFrequentlyUsed !== undefined ? config.isFrequentlyUsed : true,
            adoptionDate: config.adoptionDate ? new Date(config.adoptionDate) : null,
          },
        });
      }
    });

    const updated = await prisma.vehicleModel.findUnique({
      where: { id: parseInt(vehicleId) },
      include: { vehicleConfigs: { include: { configItem: true } } },
    });

    res.json({
      success: true,
      data: enhanceVehicleModel(updated),
      message: "批量更新配置成功",
    });
  } catch (error) {
    console.error("批量更新配置失败:", error);
    res.status(500).json({
      success: false,
      message: "批量更新配置失败",
      error: error.message,
    });
  }
};

module.exports = {
  getVehicles,
  getVehicleById,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  addConfigToVehicle,
  updateVehicleConfig,
  removeConfigFromVehicle,
  batchUpdateConfigs,
};
