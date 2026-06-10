const express = require("express");
const router = express.Router();
const {
  getSmartWeightOverview,
  getGradeAnalysis,
  getHighAdoptionConfigs,
  getCategoryWeightAnalysis,
  getWeightOptimizationSuggestions,
} = require("../controllers/analyticsController");

router.get("/overview", getSmartWeightOverview);
router.get("/grade-analysis", getGradeAnalysis);
router.get("/high-adoption", getHighAdoptionConfigs);
router.get("/category-analysis", getCategoryWeightAnalysis);
router.get("/optimization-suggestions", getWeightOptimizationSuggestions);

module.exports = router;
