import { Router } from "express";
import {
  getAllBuildings,
  getBuildingById,
  createBuilding,
  updateBuilding,
  deleteBuilding,
} from "../controllers/building.controller";
import { authMiddleware, requireRole } from "../middlewares/auth.middleware";

const router = Router();

router.get("/", authMiddleware, getAllBuildings);
router.get("/:id", authMiddleware, getBuildingById);
router.post("/", authMiddleware, requireRole("admin"), createBuilding);
router.put("/:id", authMiddleware, requireRole("admin"), updateBuilding);
router.delete("/:id", authMiddleware, requireRole("admin"), deleteBuilding);

export default router;
