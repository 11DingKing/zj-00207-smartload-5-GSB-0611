const express = require("express");
const router = express.Router();
const {
  getConfigItems,
  getConfigItemById,
  createConfigItem,
  updateConfigItem,
  deleteConfigItem,
  getConfigStats,
} = require("../controllers/configItemController");

router.get("/", getConfigItems);
router.get("/stats", getConfigStats);
router.get("/:id", getConfigItemById);
router.post("/", createConfigItem);
router.put("/:id", updateConfigItem);
router.delete("/:id", deleteConfigItem);

module.exports = router;
