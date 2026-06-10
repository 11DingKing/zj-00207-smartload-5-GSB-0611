const express = require("express");
const router = express.Router();
const {
  getVersions,
  getVersionById,
  getVersionGroup,
  createVersion,
  updateVersion,
  deleteVersion,
  getVersionComparison,
  getVehicleUpgradeAnalysis,
  getAllVersionGroups,
} = require("../controllers/versionController");

router.get("/", getVersions);
router.get("/groups", getAllVersionGroups);
router.get("/groups/:versionGroupId", getVersionGroup);
router.get("/compare", getVersionComparison);
router.get("/vehicle-upgrade/:vehicleId", getVehicleUpgradeAnalysis);
router.get("/:id", getVersionById);
router.post("/", createVersion);
router.put("/:id", updateVersion);
router.delete("/:id", deleteVersion);

module.exports = router;
