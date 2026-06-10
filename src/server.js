require("dotenv").config();
const express = require("express");
const cors = require("cors");
const prisma = require("./utils/prisma");
const {
  ConfigCategoryLabels,
  ConfigStatusLabels,
  FeatureLevelLabels,
  VehicleGradeLabels,
} = require("./utils/constants");

const configItemsRouter = require("./routes/configItems");
const vehiclesRouter = require("./routes/vehicles");
const analyticsRouter = require("./routes/analytics");
const versionsRouter = require("./routes/versions");
const optionPackagesRouter = require("./routes/optionPackages");
const comparisonsRouter = require("./routes/comparisons");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`${req.method} ${req.url} - ${new Date().toISOString()}`);
  next();
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "SmartLoad API 运行正常",
    timestamp: new Date().toISOString(),
    data: {
      database: "connected",
      version: "1.0.0",
    },
  });
});

app.get("/api/constants", (req, res) => {
  res.json({
    success: true,
    data: {
      categories: Object.entries(ConfigCategoryLabels).map(([key, label]) => ({
        key,
        label,
      })),
      statuses: Object.entries(ConfigStatusLabels).map(([key, label]) => ({
        key,
        label,
      })),
      featureLevels: Object.entries(FeatureLevelLabels).map(([key, label]) => ({
        key,
        label,
      })),
      vehicleGrades: Object.entries(VehicleGradeLabels).map(([key, label]) => ({
        key,
        label,
      })),
    },
  });
});

app.get("/api/summary", async (req, res) => {
  try {
    const [
      configCount,
      vehicleCount,
      vehicleConfigCount,
      versionCount,
      packageCount,
      vehiclePackageCount,
    ] = await Promise.all([
      prisma.configItem.count(),
      prisma.vehicleModel.count(),
      prisma.vehicleConfig.count(),
      prisma.configItemVersion.count(),
      prisma.optionPackage.count(),
      prisma.vehicleOptionPackage.count(),
    ]);

    res.json({
      success: true,
      data: {
        configItems: configCount,
        vehicleModels: vehicleCount,
        vehicleConfigs: vehicleConfigCount,
        configItemVersions: versionCount,
        optionPackages: packageCount,
        vehicleOptionPackages: vehiclePackageCount,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "获取汇总信息失败",
      error: error.message,
    });
  }
});

app.use("/api/config-items", configItemsRouter);
app.use("/api/vehicles", vehiclesRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/versions", versionsRouter);
app.use("/api/option-packages", optionPackagesRouter);
app.use("/api/comparisons", comparisonsRouter);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `接口不存在: ${req.method} ${req.url}`,
  });
});

app.use((err, req, res, next) => {
  console.error("服务器错误:", err);
  res.status(500).json({
    success: false,
    message: "服务器内部错误",
    error: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
});

app.listen(PORT, async () => {
  console.log(`
╔════════════════════════════════════════╗
║                                    ║
║   🚗 SmartLoad API Server       ║
║                                    ║
║   端口: ${PORT}                        ║
║   状态: 运行中                      ║
║   时间: ${new Date().toLocaleString()}   ║
║                                    ║
╚════════════════════════════════════════╝
  `);

  console.log("\n📋 可用接口:");
  console.log("  GET    /api/health           - 健康检查");
  console.log("  GET    /api/constants        - 常量定义");
  console.log("  GET    /api/summary          - 数据汇总");
  console.log("");
  console.log("🔧 配置项管理:");
  console.log("  GET    /api/config-items       - 配置项列表");
  console.log("  GET    /api/config-items/:id   - 配置项详情");
  console.log("  POST   /api/config-items       - 创建配置项");
  console.log("  PUT    /api/config-items/:id   - 更新配置项");
  console.log("  DELETE /api/config-items/:id   - 删除配置项");
  console.log("  GET    /api/config-items/stats - 配置项统计");
  console.log("");
  console.log("🚙 车型管理:");
  console.log("  GET    /api/vehicles         - 车型列表");
  console.log("  GET    /api/vehicles/:id     - 车型详情");
  console.log("  POST   /api/vehicles         - 创建车型");
  console.log("  PUT    /api/vehicles/:id     - 更新车型");
  console.log("  DELETE /api/vehicles/:id     - 删除车型");
  console.log("  POST   /api/vehicles/:id/configs - 添加配置");
  console.log("  PUT    /api/vehicles/:id/configs/batch - 批量更新配置");
  console.log("");
  console.log("� 版本代次管理:");
  console.log("  GET    /api/versions         - 版本列表");
  console.log("  GET    /api/versions/groups  - 版本分组（按配置项）");
  console.log("  POST   /api/versions         - 创建版本");
  console.log("  GET    /api/versions/:configItemId - 配置项版本历史");
  console.log("  GET    /api/versions/comparison - 版本对比（减重分析）");
  console.log("  GET    /api/versions/vehicle-upgrade - 车型升级减重分析");
  console.log("");
  console.log("🎁 选装包管理:");
  console.log("  GET    /api/option-packages  - 选装包列表");
  console.log("  POST   /api/option-packages  - 创建选装包");
  console.log("  GET    /api/option-packages/:id - 选装包详情");
  console.log("  PUT    /api/option-packages/:id - 更新选装包");
  console.log("  DELETE /api/option-packages/:id - 删除选装包");
  console.log("  POST   /api/option-packages/:id/items - 添加配置项到选装包");
  console.log("  POST   /api/option-packages/vehicle - 车型挂载选装包");
  console.log("  DELETE /api/option-packages/vehicle - 车型卸载选装包");
  console.log("  GET    /api/option-packages/:id/popularity - 选装包普及情况");
  console.log("  GET    /api/option-packages/analysis/popularity - 所有选装包普及分析");
  console.log("");
  console.log("⚖️  车型对比:");
  console.log("  GET    /api/comparisons/two-vehicles - 两车型配置差异对比");
  console.log("  GET    /api/comparisons/multi-vehicles - 多车型对比");
  console.log("  GET    /api/comparisons/by-grade - 按档次重量对比");
  console.log("");
  console.log("�📊 统计分析:");
  console.log("  GET    /api/analytics/overview    - 增重概览（含选装包和版本分析）");
  console.log("  GET    /api/analytics/grade-analysis - 档次分析（含选装包和版本分析）");
  console.log("  GET    /api/analytics/high-adoption  - 高普及率配置");
  console.log("  GET    /api/analytics/category-analysis - 类别分析（含选装包）");
  console.log(
    "  GET    /api/analytics/optimization-suggestions - 减重建议（含版本升级和选装包分析）"
  );
  console.log("");
});

process.on("SIGINT", async () => {
  console.log("\n\n正在关闭服务器...");
  await prisma.$disconnect();
  process.exit(0);
});
