const express = require("express");
const router = express.Router();
const {
  getVehicles,
  getVehicleById,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  addConfigToVehicle,
  updateVehicleConfig,
  removeConfigFromVehicle,
  batchUpdateConfigs,
} = require("../controllers/vehicleController");

router.get("/", getVehicles);
router.get("/:id", getVehicleById);
router.post("/", createVehicle);
router.put("/:id", updateVehicle);
router.delete("/:id", deleteVehicle);

router.post("/:vehicleId/configs", addConfigToVehicle);
router.put("/:vehicleId/configs/:configId", updateVehicleConfig);
router.delete("/:vehicleId/configs/:configId", removeConfigFromVehicle);
router.put("/:vehicleId/configs/batch", batchUpdateConfigs);

module.exports = router;
