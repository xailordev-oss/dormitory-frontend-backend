import { Router } from "express";
import {
  getAllStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent,
} from "../controllers/student.controller";
import {
  getMyProfile,
  updateMyProfile,
  uploadMyAvatar,
} from "../controllers/profile.controller";
import { authMiddleware, requireRole } from "../middlewares/auth.middleware";
import { upload } from "../middlewares/upload.middleware";

const router = Router();

// ⚠️ ຕ້ອງໃສ່ໄວ້ກ່ອນ "/:id" ເພື່ອບໍ່ໃຫ້ "me" ຖືກຈັບເປັນ :id
// ເສັ້ນທາງ /me/* ເປັນຂອງຜູ້ໃຊ້ທີ່ login ເອງ (student ຫຼື admin) ບໍ່ຈຳກັດ role
router.get("/me/profile", authMiddleware, getMyProfile);
router.put("/me/profile", authMiddleware, updateMyProfile);
router.post("/me/avatar", authMiddleware, upload.single("avatar"), uploadMyAvatar);

// ເບິ່ງລາຍຊື່ນັກສຶກສາ: admin + staff | ເພີ່ມ/ແກ້/ລຶບ: ສະເພາະ admin
router.get("/", authMiddleware, requireRole("admin", "staff"), getAllStudents);
router.get("/:id", authMiddleware, requireRole("admin", "staff"), getStudentById);
router.post("/", authMiddleware, requireRole("admin"), createStudent);
router.put("/:id", authMiddleware, requireRole("admin"), updateStudent);
router.delete("/:id", authMiddleware, requireRole("admin"), deleteStudent);

export default router;