import { Router } from "express";
import {
  getAllBookings,
  getBookingById,
  createBooking,
  updateBooking,
  approveBooking,
  cancelBooking,
  checkoutBooking,
  deleteBooking,
} from "../controllers/booking.controller";
import { authMiddleware, requireRole } from "../middlewares/auth.middleware";

const router = Router();

router.get("/", authMiddleware, getAllBookings);
router.get("/:id", authMiddleware, getBookingById);
router.post("/", authMiddleware, createBooking);
// ນັກສຶກສາຍົກເລີກການຈອງຂອງຕົນທີ່ຍັງ pending ໄດ້ (ກວດສິດໃນ controller)
router.patch("/:id/cancel", authMiddleware, cancelBooking);
router.patch("/:id/approve", authMiddleware, requireRole("admin", "staff"), approveBooking);
router.patch("/:id/checkout", authMiddleware, requireRole("admin", "staff"), checkoutBooking);
router.put("/:id", authMiddleware, requireRole("admin"), updateBooking);
router.delete("/:id", authMiddleware, requireRole("admin"), deleteBooking);

export default router;
