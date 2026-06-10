const express = require("express");
const router = express.Router();
const {
  getOptionPackages,
  getOptionPackageById,
  createOptionPackage,
  updateOptionPackage,
  deleteOptionPackage,
  addPackageToVehicle,
  removePackageFromVehicle,
  getPackagePopularityAnalysis,
  getVehicleOptionPackages,
} = require("../controllers/optionPackageController");

router.get("/", getOptionPackages);
router.get("/popularity-analysis", getPackagePopularityAnalysis);
router.get("/vehicle/:vehicleId", getVehicleOptionPackages);
router.get("/:id", getOptionPackageById);
router.post("/", createOptionPackage);
router.put("/:id", updateOptionPackage);
router.delete("/:id", deleteOptionPackage);
router.post("/vehicle/:vehicleId/package/:packageId", addPackageToVehicle);
router.delete("/vehicle/:vehicleId/package/:packageId", removePackageFromVehicle);

module.exports = router;
