import { Router } from "express";
import {
  createUser,
  deleteUser,
  getAllUsers,
  getUserById,
  resetUserPassword,
  updateUserRole,
  updateUserStatus,
} from "../controllers/user.controller";
import { authMiddleware, requireRole } from "../middlewares/auth.middleware";

const router = Router();

// ການຈັດການບັນຊີຜູ້ໃຊ້ (users) ທັງໝົດແມ່ນສະຫງວນໄວ້ສະເພາະ admin
router.get("/", authMiddleware, requireRole("admin"), getAllUsers);
router.post("/", authMiddleware, requireRole("admin"), createUser);
router.get("/:id", authMiddleware, requireRole("admin"), getUserById);
router.patch("/:id/role", authMiddleware, requireRole("admin"), updateUserRole);
router.patch("/:id/status", authMiddleware, requireRole("admin"), updateUserStatus);
router.patch("/:id/password", authMiddleware, requireRole("admin"), resetUserPassword);
router.delete("/:id", authMiddleware, requireRole("admin"), deleteUser);

export default router;
