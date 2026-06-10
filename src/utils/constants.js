const ConfigCategory = {
  PERCEPTION: "PERCEPTION",
  COMPUTING: "COMPUTING",
  COMMUNICATION: "COMMUNICATION",
  ACTUATION: "ACTUATION",
  DISPLAY: "DISPLAY",
};

const ConfigCategoryLabels = {
  PERCEPTION: "感知",
  COMPUTING: "计算",
  COMMUNICATION: "通信",
  ACTUATION: "执行",
  DISPLAY: "显示",
};

const ConfigStatus = {
  ACTIVE: "ACTIVE",
  OBSOLETE: "OBSOLETE",
  NEW: "NEW",
};

const ConfigStatusLabels = {
  ACTIVE: "在用",
  OBSOLETE: "淘汰",
  NEW: "新增",
};

const FeatureLevel = {
  BASIC: "BASIC",
  STANDARD: "STANDARD",
  ADVANCED: "ADVANCED",
  PREMIUM: "PREMIUM",
};

const FeatureLevelLabels = {
  BASIC: "基础",
  STANDARD: "标准",
  ADVANCED: "进阶",
  PREMIUM: "高端",
};

const VehicleGrade = {
  ENTRY: "ENTRY",
  MID: "MID",
  HIGH: "HIGH",
  LUXURY: "LUXURY",
};

const VehicleGradeLabels = {
  ENTRY: "低配",
  MID: "中配",
  HIGH: "高配",
  LUXURY: "豪华",
};

module.exports = {
  ConfigCategory,
  ConfigCategoryLabels,
  ConfigStatus,
  ConfigStatusLabels,
  FeatureLevel,
  FeatureLevelLabels,
  VehicleGrade,
  VehicleGradeLabels,
};
