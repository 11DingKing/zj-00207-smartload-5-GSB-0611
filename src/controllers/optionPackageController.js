const prisma = require("../utils/prisma");
const { ConfigCategoryLabels, VehicleGradeLabels } = require("../utils/constants");

const calculatePackageWeight = (items) => {
  return items.reduce((sum, item) => {
    const weight = item.configItem.typicalWeight;
    return sum + weight * item.quantity;
  }, 0);
};

const calculateCategoryBreakdown = (items) => {
  const byCategory = {};
  items.forEach((item) => {
    const category = item.configItem.category;
    const weight = item.configItem.typicalWeight * item.quantity;
    if (!byCategory[category]) {
      byCategory[category] = { weight: 0, count: 0 };
    }
    byCategory[category].weight += weight;
    byCategory[category].count += item.quantity;
  });
  return Object.entries(byCategory).map(([category, data]) => ({
    category,
    categoryLabel: ConfigCategoryLabels[category] || category,
    weight: data.weight,
    count: data.count,
    percentage: 0,
  }));
};

const enhancePackage = (pkg) => {
  const totalWeight = pkg.items ? calculatePackageWeight(pkg.items) : 0;
  const categoryBreakdown = pkg.items ? calculateCategoryBreakdown(pkg.items) : [];
  const totalWithPercentage = categoryBreakdown.map((c) => ({
    ...c,
    percentage: totalWeight > 0 ? ((c.weight / totalWeight) * 100).toFixed(1) : 0,
  }));

  return {
    ...pkg,
    totalWeight,
    categoryBreakdown: totalWithPercentage.sort((a, b) => b.weight - a.weight),
    itemCount: pkg.items?.length || 0,
    mandatoryCount: pkg.items?.filter((i) => !i.isOptional).length || 0,
    optionalCount: pkg.items?.filter((i) => i.isOptional).length || 0,
  };
};

const getOptionPackages = async (req, res) => {
  try {
    const { category, isPopular, minWeight, maxWeight, search } = req.query;
    const where = {};

    if (category) where.category = category;
    if (isPopular !== undefined) where.isPopular = isPopular === "true";
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { code: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const packages = await prisma.optionPackage.findMany({
      where,
      include: {
        items: { include: { configItem: true } },
        vehicles: true,
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    let enhanced = packages.map((pkg) => ({
      ...enhancePackage(pkg),
      vehicleCount: pkg.vehicles.length,
      standardCount: pkg.vehicles.filter((v) => v.isStandard).length,
      optionalCount: pkg.vehicles.filter((v) => !v.isStandard).length,
    }));

    if (minWeight !== undefined) {
      enhanced = enhanced.filter((p) => p.totalWeight >= parseFloat(minWeight));
    }
    if (maxWeight !== undefined) {
      enhanced = enhanced.filter((p) => p.totalWeight <= parseFloat(maxWeight));
    }

    res.json({ success: true, data: enhanced, count: enhanced.length });
  } catch (error) {
    console.error("获取选装包列表失败:", error);
    res.status(500).json({ success: false, message: "获取选装包列表失败", error: error.message });
  }
};

const getOptionPackageById = async (req, res) => {
  try {
    const { id } = req.params;
    const pkg = await prisma.optionPackage.findUnique({
      where: { id: parseInt(id) },
      include: {
        items: {
          include: {
            configItem: {
              include: { versions: true },
            },
          },
          orderBy: { configItemId: "asc" },
        },
        vehicles: {
          include: {
            vehicleModel: {
              select: { id: true, name: true, brand: true, grade: true },
            },
          },
        },
      },
    });

    if (!pkg) {
      return res.status(404).json({ success: false, message: "选装包不存在" });
    }

    const enhancedVehicles = pkg.vehicles.map((v) => ({
      vehicleId: v.vehicleModel.id,
      vehicleName: v.vehicleModel.name,
      brand: v.vehicleModel.brand,
      grade: v.vehicleModel.grade,
      gradeLabel: VehicleGradeLabels[v.vehicleModel.grade] || v.vehicleModel.grade,
      isStandard: v.isStandard,
      adoptionDate: v.adoptionDate,
    }));

    const result = enhancePackage(pkg);
    res.json({
      success: true,
      data: {
        ...result,
        vehicles: enhancedVehicles,
        vehicleCount: enhancedVehicles.length,
      },
    });
  } catch (error) {
    console.error("获取选装包详情失败:", error);
    res.status(500).json({ success: false, message: "获取选装包详情失败", error: error.message });
  }
};

const createOptionPackage = async (req, res) => {
  try {
    const { name, code, category, description, price, isPopular, items } = req.body;

    if (!name || !code || !category) {
      return res.status(400).json({ success: false, message: "缺少必要参数" });
    }

    const result = await prisma.$transaction(async (tx) => {
      const pkg = await tx.optionPackage.create({
        data: {
          name,
          code,
          category,
          description,
          price: price ? parseFloat(price) : null,
          isPopular: isPopular || false,
        },
      });

      if (items && items.length > 0) {
        for (const item of items) {
          await tx.optionPackageItem.create({
            data: {
              optionPackageId: pkg.id,
              configItemId: item.configItemId,
              quantity: item.quantity || 1,
              isOptional: item.isOptional || false,
            },
          });
        }
      }

      return tx.optionPackage.findUnique({
        where: { id: pkg.id },
        include: { items: { include: { configItem: true } } },
      });
    });

    res
      .status(201)
      .json({ success: true, data: enhancePackage(result), message: "选装包创建成功" });
  } catch (error) {
    console.error("创建选装包失败:", error);
    if (error.code === "P2002") {
      return res.status(400).json({ success: false, message: "选装包编码已存在" });
    }
    res.status(500).json({ success: false, message: "创建选装包失败", error: error.message });
  }
};

const updateOptionPackage = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, category, description, price, isPopular, items } = req.body;

    const existing = await prisma.optionPackage.findUnique({ where: { id: parseInt(id) } });
    if (!existing) {
      return res.status(404).json({ success: false, message: "选装包不存在" });
    }

    const result = await prisma.$transaction(async (tx) => {
      const pkg = await tx.optionPackage.update({
        where: { id: parseInt(id) },
        data: {
          name,
          code,
          category,
          description,
          price: price !== undefined ? (price ? parseFloat(price) : null) : undefined,
          isPopular,
        },
      });

      if (items !== undefined) {
        await tx.optionPackageItem.deleteMany({ where: { optionPackageId: parseInt(id) } });
        for (const item of items) {
          await tx.optionPackageItem.create({
            data: {
              optionPackageId: pkg.id,
              configItemId: item.configItemId,
              quantity: item.quantity || 1,
              isOptional: item.isOptional || false,
            },
          });
        }
      }

      return tx.optionPackage.findUnique({
        where: { id: pkg.id },
        include: { items: { include: { configItem: true } } },
      });
    });

    res.json({ success: true, data: enhancePackage(result), message: "选装包更新成功" });
  } catch (error) {
    console.error("更新选装包失败:", error);
    res.status(500).json({ success: false, message: "更新选装包失败", error: error.message });
  }
};

const deleteOptionPackage = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.optionPackage.findUnique({ where: { id: parseInt(id) } });
    if (!existing) {
      return res.status(404).json({ success: false, message: "选装包不存在" });
    }

    await prisma.optionPackage.delete({ where: { id: parseInt(id) } });
    res.json({ success: true, message: "选装包删除成功" });
  } catch (error) {
    console.error("删除选装包失败:", error);
    res.status(500).json({ success: false, message: "删除选装包失败", error: error.message });
  }
};

const addPackageToVehicle = async (req, res) => {
  try {
    const { vehicleId, packageId } = req.params;
    const { isStandard, adoptionDate } = req.body;

    const [vehicle, pkg] = await Promise.all([
      prisma.vehicleModel.findUnique({ where: { id: parseInt(vehicleId) } }),
      prisma.optionPackage.findUnique({ where: { id: parseInt(packageId) } }),
    ]);

    if (!vehicle) {
      return res.status(404).json({ success: false, message: "车型不存在" });
    }
    if (!pkg) {
      return res.status(404).json({ success: false, message: "选装包不存在" });
    }

    const vehiclePackage = await prisma.vehicleOptionPackage.create({
      data: {
        vehicleModelId: parseInt(vehicleId),
        optionPackageId: parseInt(packageId),
        isStandard: isStandard || false,
        adoptionDate: adoptionDate ? new Date(adoptionDate) : null,
      },
      include: { optionPackage: { include: { items: { include: { configItem: true } } } } },
    });

    res.status(201).json({
      success: true,
      data: {
        ...vehiclePackage,
        packageDetails: enhancePackage(vehiclePackage.optionPackage),
      },
      message: "选装包已添加到车型",
    });
  } catch (error) {
    console.error("添加选装包到车型失败:", error);
    if (error.code === "P2002") {
      return res.status(400).json({ success: false, message: "该车型已挂载此选装包" });
    }
    res.status(500).json({ success: false, message: "添加选装包失败", error: error.message });
  }
};

const removePackageFromVehicle = async (req, res) => {
  try {
    const { vehicleId, packageId } = req.params;

    const existing = await prisma.vehicleOptionPackage.findUnique({
      where: {
        vehicleModelId_optionPackageId: {
          vehicleModelId: parseInt(vehicleId),
          optionPackageId: parseInt(packageId),
        },
      },
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: "该车型未挂载此选装包" });
    }

    await prisma.vehicleOptionPackage.delete({
      where: {
        vehicleModelId_optionPackageId: {
          vehicleModelId: parseInt(vehicleId),
          optionPackageId: parseInt(packageId),
        },
      },
    });

    res.json({ success: true, message: "选装包已从车型移除" });
  } catch (error) {
    console.error("从车型移除选装包失败:", error);
    res.status(500).json({ success: false, message: "移除选装包失败", error: error.message });
  }
};

const getPackagePopularityAnalysis = async (req, res) => {
  try {
    const allVehicles = await prisma.vehicleModel.findMany();
    const totalVehicles = allVehicles.length;

    const packages = await prisma.optionPackage.findMany({
      include: {
        items: { include: { configItem: true } },
        vehicles: true,
      },
    });

    const analysis = packages.map((pkg) => {
      const enhanced = enhancePackage(pkg);
      const totalAdoption = pkg.vehicles.length;
      const standardAdoption = pkg.vehicles.filter((v) => v.isStandard).length;
      const optionalAdoption = pkg.vehicles.filter((v) => !v.isStandard).length;

      const byGrade = {};
      pkg.vehicles.forEach((v) => {
        const vehicle = allVehicles.find((av) => av.id === v.vehicleModelId);
        if (vehicle) {
          const grade = vehicle.grade;
          if (!byGrade[grade]) {
            byGrade[grade] = { count: 0, standard: 0, optional: 0 };
          }
          byGrade[grade].count++;
          if (v.isStandard) {
            byGrade[grade].standard++;
          } else {
            byGrade[grade].optional++;
          }
        }
      });

      const gradeBreakdown = Object.entries(byGrade).map(([grade, data]) => ({
        grade,
        gradeLabel: VehicleGradeLabels[grade] || grade,
        count: data.count,
        standard: data.standard,
        optional: data.optional,
      }));

      return {
        id: pkg.id,
        name: pkg.name,
        code: pkg.code,
        category: pkg.category,
        isPopular: pkg.isPopular,
        totalWeight: enhanced.totalWeight,
        itemCount: enhanced.itemCount,
        price: pkg.price,
        totalAdoption,
        standardAdoption,
        optionalAdoption,
        adoptionRate: totalVehicles > 0 ? ((totalAdoption / totalVehicles) * 100).toFixed(1) : 0,
        standardRate: totalVehicles > 0 ? ((standardAdoption / totalVehicles) * 100).toFixed(1) : 0,
        optionalRate: totalVehicles > 0 ? ((optionalAdoption / totalVehicles) * 100).toFixed(1) : 0,
        gradeBreakdown,
        brands: [
          ...new Set(
            pkg.vehicles
              .map((v) => {
                const vehicle = allVehicles.find((av) => av.id === v.vehicleModelId);
                return vehicle?.brand;
              })
              .filter(Boolean)
          ),
        ],
      };
    });

    const categoryStats = {};
    analysis.forEach((pkg) => {
      if (!categoryStats[pkg.category]) {
        categoryStats[pkg.category] = { packages: 0, totalWeight: 0, avgAdoption: 0 };
      }
      categoryStats[pkg.category].packages++;
      categoryStats[pkg.category].totalWeight += pkg.totalWeight;
      categoryStats[pkg.category].avgAdoption += parseFloat(pkg.adoptionRate);
    });

    const categoryBreakdown = Object.entries(categoryStats).map(([category, data]) => ({
      category,
      packageCount: data.packages,
      totalWeight: data.totalWeight,
      avgAdoptionRate: (data.avgAdoption / data.packages).toFixed(1),
    }));

    res.json({
      success: true,
      data: {
        summary: {
          totalPackages: packages.length,
          totalVehicles,
          avgAdoptionRate:
            analysis.length > 0
              ? (
                  analysis.reduce((sum, p) => sum + parseFloat(p.adoptionRate), 0) / analysis.length
                ).toFixed(1)
              : 0,
        },
        packages: analysis.sort((a, b) => parseFloat(b.adoptionRate) - parseFloat(a.adoptionRate)),
        categoryBreakdown,
      },
    });
  } catch (error) {
    console.error("选装包普及分析失败:", error);
    res.status(500).json({ success: false, message: "选装包普及分析失败", error: error.message });
  }
};

const getVehicleOptionPackages = async (req, res) => {
  try {
    const { vehicleId } = req.params;

    const vehicle = await prisma.vehicleModel.findUnique({
      where: { id: parseInt(vehicleId) },
      include: {
        optionPackages: {
          include: {
            optionPackage: {
              include: {
                items: { include: { configItem: true } },
              },
            },
          },
        },
      },
    });

    if (!vehicle) {
      return res.status(404).json({ success: false, message: "车型不存在" });
    }

    const packages = vehicle.optionPackages.map((vp) => {
      const enhanced = enhancePackage(vp.optionPackage);
      return {
        vehiclePackageId: vp.id,
        packageId: vp.optionPackage.id,
        name: vp.optionPackage.name,
        code: vp.optionPackage.code,
        category: vp.optionPackage.category,
        isStandard: vp.isStandard,
        adoptionDate: vp.adoptionDate,
        price: vp.optionPackage.price,
        description: vp.optionPackage.description,
        ...enhanced,
      };
    });

    const totalWeight = packages.reduce((sum, p) => sum + p.totalWeight, 0);
    const standardWeight = packages
      .filter((p) => p.isStandard)
      .reduce((sum, p) => sum + p.totalWeight, 0);
    const optionalWeight = packages
      .filter((p) => !p.isStandard)
      .reduce((sum, p) => sum + p.totalWeight, 0);

    res.json({
      success: true,
      data: {
        vehicleId: vehicle.id,
        vehicleName: vehicle.name,
        brand: vehicle.brand,
        packageCount: packages.length,
        standardCount: packages.filter((p) => p.isStandard).length,
        optionalCount: packages.filter((p) => !p.isStandard).length,
        totalWeight,
        standardWeight,
        optionalWeight,
        packages,
      },
    });
  } catch (error) {
    console.error("获取车型选装包失败:", error);
    res.status(500).json({ success: false, message: "获取车型选装包失败", error: error.message });
  }
};

module.exports = {
  getOptionPackages,
  getOptionPackageById,
  createOptionPackage,
  updateOptionPackage,
  deleteOptionPackage,
  addPackageToVehicle,
  removePackageFromVehicle,
  getPackagePopularityAnalysis,
  getVehicleOptionPackages,
};
