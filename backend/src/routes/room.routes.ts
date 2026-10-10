import { Router } from "express";
import {
  getAllRooms,
  getAvailableRooms,
  getRoomById,
  getRoomOccupants,
  createRoom,
  updateRoom,
  deleteRoom,
} from "../controllers/room.controller";
import { authMiddleware, requireRole } from "../middlewares/auth.middleware";

const router = Router();

// ⚠️ "/available" ຕ້ອງມາກ່ອນ "/:id" ບໍ່ດັ່ງນັ້ນ "available" ຈະຖືກຈັບເປັນ id
router.get("/available", authMiddleware, getAvailableRooms);
router.get("/", authMiddleware, getAllRooms);
router.get("/:id/occupants", authMiddleware, getRoomOccupants);
router.get("/:id", authMiddleware, getRoomById);

router.post("/", authMiddleware, requireRole("admin"), createRoom);
router.put("/:id", authMiddleware, requireRole("admin"), updateRoom);
router.delete("/:id", authMiddleware, requireRole("admin"), deleteRoom);

export default router;
