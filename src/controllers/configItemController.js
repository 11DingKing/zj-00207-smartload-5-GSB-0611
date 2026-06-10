const prisma = require("../utils/prisma");
const {
  ConfigCategory,
  ConfigStatus,
  FeatureLevel,
  ConfigCategoryLabels,
  ConfigStatusLabels,
  FeatureLevelLabels,
} = require("../utils/constants");

const validateConfigItem = (data) => {
  const errors = [];
  if (!data.name || data.name.trim() === "") {
    errors.push("配置项名称不能为空");
  }
  if (!data.category || !Object.values(ConfigCategory).includes(data.category)) {
    errors.push("无效的配置类别");
  }
  if (!data.status || !Object.values(ConfigStatus).includes(data.status)) {
    errors.push("无效的状态");
  }
  if (!data.featureLevel || !Object.values(FeatureLevel).includes(data.featureLevel)) {
    errors.push("无效的功能等级");
  }
  if (typeof data.typicalWeight !== "number" || data.typicalWeight < 0) {
    errors.push("典型重量必须为非负数");
  }
  return errors;
};

const enhanceConfigItem = (item) => {
  return {
    ...item,
    categoryLabel: ConfigCategoryLabels[item.category] || item.category,
    statusLabel: ConfigStatusLabels[item.status] || item.status,
    featureLevelLabel: FeatureLevelLabels[item.featureLevel] || item.featureLevel,
  };
};

const getConfigItems = async (req, res) => {
  try {
    const { category, status, featureLevel, isHighlyAdopted, search } = req.query;
    const where = {};

    if (category) where.category = category;
    if (status) where.status = status;
    if (featureLevel) where.featureLevel = featureLevel;
    if (isHighlyAdopted !== undefined) where.isHighlyAdopted = isHighlyAdopted === "true";
    if (search) {
      where.OR = [{ name: { contains: search } }, { description: { contains: search } }];
    }

    const configItems = await prisma.configItem.findMany({
      where,
      orderBy: [{ category: "asc" }, { typicalWeight: "desc" }],
    });

    const enhanced = configItems.map(enhanceConfigItem);
    res.json({ success: true, data: enhanced, count: enhanced.length });
  } catch (error) {
    console.error("获取配置项列表失败:", error);
    res.status(500).json({ success: false, message: "获取配置项列表失败", error: error.message });
  }
};

const getConfigItemById = async (req, res) => {
  try {
    const { id } = req.params;
    const configItem = await prisma.configItem.findUnique({
      where: { id: parseInt(id) },
      include: {
        vehicleConfigs: {
          include: {
            vehicleModel: {
              select: { id: true, name: true, brand: true, grade: true },
            },
          },
        },
      },
    });

    if (!configItem) {
      return res.status(404).json({ success: false, message: "配置项不存在" });
    }

    res.json({ success: true, data: enhanceConfigItem(configItem) });
  } catch (error) {
    console.error("获取配置项详情失败:", error);
    res.status(500).json({ success: false, message: "获取配置项详情失败", error: error.message });
  }
};

const createConfigItem = async (req, res) => {
  try {
    const errors = validateConfigItem(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: "参数校验失败", errors });
    }

    const configItem = await prisma.configItem.create({
      data: {
        name: req.body.name,
        category: req.body.category,
        typicalWeight: req.body.typicalWeight,
        featureLevel: req.body.featureLevel,
        status: req.body.status,
        description: req.body.description,
        popularityRate: req.body.popularityRate || 0,
        isHighlyAdopted: req.body.isHighlyAdopted || false,
      },
    });

    res
      .status(201)
      .json({ success: true, data: enhanceConfigItem(configItem), message: "配置项创建成功" });
  } catch (error) {
    console.error("创建配置项失败:", error);
    res.status(500).json({ success: false, message: "创建配置项失败", error: error.message });
  }
};

const updateConfigItem = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.configItem.findUnique({ where: { id: parseInt(id) } });
    if (!existing) {
      return res.status(404).json({ success: false, message: "配置项不存在" });
    }

    const errors = validateConfigItem(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: "参数校验失败", errors });
    }

    const configItem = await prisma.configItem.update({
      where: { id: parseInt(id) },
      data: {
        name: req.body.name,
        category: req.body.category,
        typicalWeight: req.body.typicalWeight,
        featureLevel: req.body.featureLevel,
        status: req.body.status,
        description: req.body.description,
        popularityRate: req.body.popularityRate,
        isHighlyAdopted: req.body.isHighlyAdopted,
      },
    });

    res.json({ success: true, data: enhanceConfigItem(configItem), message: "配置项更新成功" });
  } catch (error) {
    console.error("更新配置项失败:", error);
    res.status(500).json({ success: false, message: "更新配置项失败", error: error.message });
  }
};

const deleteConfigItem = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.configItem.findUnique({ where: { id: parseInt(id) } });
    if (!existing) {
      return res.status(404).json({ success: false, message: "配置项不存在" });
    }

    await prisma.configItem.delete({ where: { id: parseInt(id) } });
    res.json({ success: true, message: "配置项删除成功" });
  } catch (error) {
    console.error("删除配置项失败:", error);
    if (error.code === "P2003") {
      return res.status(400).json({ success: false, message: "该配置项已被车型引用，无法删除" });
    }
    res.status(500).json({ success: false, message: "删除配置项失败", error: error.message });
  }
};

const getConfigStats = async (req, res) => {
  try {
    const byCategory = await prisma.configItem.groupBy({
      by: ["category"],
      _count: { id: true },
      _sum: { typicalWeight: true },
      _avg: { typicalWeight: true },
    });

    const byStatus = await prisma.configItem.groupBy({
      by: ["status"],
      _count: { id: true },
    });

    const byFeatureLevel = await prisma.configItem.groupBy({
      by: ["featureLevel"],
      _count: { id: true },
      _sum: { typicalWeight: true },
    });

    const total = await prisma.configItem.aggregate({
      _count: { id: true },
      _sum: { typicalWeight: true },
    });

    res.json({
      success: true,
      data: {
        total: {
          count: total._count.id,
          totalWeight: total._sum.typicalWeight,
        },
        byCategory: byCategory.map((item) => ({
          category: item.category,
          categoryLabel: ConfigCategoryLabels[item.category] || item.category,
          count: item._count.id,
          totalWeight: item._sum.typicalWeight,
          avgWeight: item._avg.typicalWeight,
        })),
        byStatus: byStatus.map((item) => ({
          status: item.status,
          statusLabel: ConfigStatusLabels[item.status] || item.status,
          count: item._count.id,
        })),
        byFeatureLevel: byFeatureLevel.map((item) => ({
          featureLevel: item.featureLevel,
          featureLevelLabel: FeatureLevelLabels[item.featureLevel] || item.featureLevel,
          count: item._count.id,
          totalWeight: item._sum.typicalWeight,
        })),
      },
    });
  } catch (error) {
    console.error("获取配置项统计失败:", error);
    res.status(500).json({ success: false, message: "获取配置项统计失败", error: error.message });
  }
};

module.exports = {
  getConfigItems,
  getConfigItemById,
  createConfigItem,
  updateConfigItem,
  deleteConfigItem,
  getConfigStats,
};
