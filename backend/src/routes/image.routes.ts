import { Router } from "express";
import { upload } from "../middlewares/upload.middleware";
import { authMiddleware, requireRole } from "../middlewares/auth.middleware";
import {
  uploadImage,
  getImages,
  setCoverImage,
  deleteImage,
} from "../controllers/image.controller";

const router = Router();

// :entityType = rooms | buildings | students
// ອັບໂຫລດ/ຕັ້ງຮູບປົກ/ລຶບຮູບ ແມ່ນການຈັດການຂໍ້ມູນຫ້ອງ/ຕຶກ/ນັກສຶກສາ ຈຶ່ງສະຫງວນໄວ້ສະເພາະ admin
// (ນັກສຶກສາອັບໂຫລດ avatar ຂອງຕົນເອງແມ່ນຄົນລະ endpoint: POST /api/students/me/avatar)
router.post("/:entityType/:entityId", authMiddleware, requireRole("admin"), upload.single("image"), uploadImage);
router.get("/:entityType/:entityId", authMiddleware, getImages);
router.patch("/:id/cover", authMiddleware, requireRole("admin"), setCoverImage);
router.delete("/:id", authMiddleware, requireRole("admin"), deleteImage);

export default router;
