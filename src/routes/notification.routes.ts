import { Router } from "express";
import {
  getAllNotifications,
  createNotification,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from "../controllers/notification.controller";
import { authMiddleware, requireRole } from "../middlewares/auth.middleware";

const router = Router();

router.get("/", authMiddleware, getAllNotifications);
router.patch("/read-all", authMiddleware, markAllNotificationsRead); // ຕ້ອງມາກ່ອນ /:id/read
router.patch("/:id/read", authMiddleware, markNotificationRead);
router.post("/", authMiddleware, requireRole("admin", "staff"), createNotification);
router.delete("/:id", authMiddleware, requireRole("admin"), deleteNotification);

export default router;
