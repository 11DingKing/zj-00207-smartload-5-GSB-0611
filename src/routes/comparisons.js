const express = require("express");
const router = express.Router();
const {
  getVehicleComparison,
  getMultiVehicleComparison,
  getWeightComparisonByGrade,
} = require("../controllers/comparisonController");

router.get("/two-vehicles", getVehicleComparison);
router.get("/multi-vehicles", getMultiVehicleComparison);
router.get("/by-grade", getWeightComparisonByGrade);

module.exports = router;
