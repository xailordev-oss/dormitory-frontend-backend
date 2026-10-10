import { Response } from "express";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import pool from "../config/db";
import { AuthRequest } from "../middlewares/auth.middleware";
import {
  AppError,
  asyncHandler,
  assertRoomHasSpace,
  ensureExists,
  getOwnStudentId,
  getRoomOccupancy,
  isStaff,
  optionalEnum,
  paramId,
  parsePagination,
  requirePositiveInt,
  resolveStudentScope,
  sendPage,
  syncRoomStatus,
} from "../utils/helpers";
import { notifyStudent } from "../utils/notify";

const BOOKING_STATUSES = ["pending", "active", "checked_out", "cancelled"] as const;
type BookingStatus = (typeof BOOKING_STATUSES)[number];

// booking ທີ່ຖືວ່າ "ຍັງກິນບ່ອນຢູ່ໃນຫ້ອງ"
const OCCUPYING = "('pending','active')";

interface BookingRow extends RowDataPacket {
  id: number;
  student_id: number;
  room_id: number;
  check_in_date: string;
  check_out_date: string | null;
  status: BookingStatus;
}

// ຮູບແບບວັນທີ YYYY-MM-DD
const parseDate = (value: unknown, field: string): string => {
  const text = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new AppError(400, `${field} ຕ້ອງເປັນຮູບແບບ YYYY-MM-DD`);
  }
  if (Number.isNaN(new Date(text).getTime())) {
    throw new AppError(400, `${field} ບໍ່ແມ່ນວັນທີທີ່ມີຢູ່ຈິງ`);
  }
  return text;
};

/* ---------------------------------------------------------
   GET /api/bookings   ?status= &studentId= &roomId= &page= &limit=
   student ເຫັນສະເພາະຂອງຕົນ / admin ແລະ staff ເຫັນທັງໝົດ
   --------------------------------------------------------- */
export const getAllBookings = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { studentId, roomId } = req.query;
  const status = optionalEnum(req.query.status, BOOKING_STATUSES, "status");
  const pg = parsePagination(req.query);

  let where = " WHERE 1=1";
  const params: any[] = [];

  if (!isStaff(req.user?.role)) {
    const ownStudentId = await getOwnStudentId(Number(req.user?.id));
    if (!ownStudentId) {
      return sendPage(res, [], 0, pg);
    }
    where += " AND b.student_id = ?";
    params.push(ownStudentId);
  } else if (studentId) {
    where += " AND b.student_id = ?";
    params.push(requirePositiveInt(studentId, "studentId"));
  }

  if (status) {
    where += " AND b.status = ?";
    params.push(status);
  }
  if (roomId) {
    where += " AND b.room_id = ?";
    params.push(requirePositiveInt(roomId, "roomId"));
  }

  const [[countRow]] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM bookings b${where}`,
    params
  );
  const [result] = await pool.query<BookingRow[]>(
    `SELECT b.*, s.name AS student_name, r.room_number, r.building_id, bl.name AS building_name
       FROM bookings b
       LEFT JOIN students s ON s.id = b.student_id
       LEFT JOIN rooms r ON r.id = b.room_id
       LEFT JOIN buildings bl ON bl.id = r.building_id
       ${where}
      ORDER BY b.id DESC LIMIT ? OFFSET ?`,
    [...params, pg.limit, pg.offset]
  );
  return sendPage(res, result, Number(countRow.total), pg);
});

/* ---------------------------------------------------------
   GET /api/bookings/:id
   --------------------------------------------------------- */
export const getBookingById = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = paramId(req.params.id);

  const [rows] = await pool.query<BookingRow[]>(
    "SELECT * FROM bookings WHERE id = ? LIMIT 1",
    [id]
  );
  const booking = rows[0];

  if (!booking) {
    throw new AppError(404, "ບໍ່ພົບການຈອງດັ່ງກ່າວ");
  }

  if (!isStaff(req.user?.role)) {
    const ownStudentId = await getOwnStudentId(Number(req.user?.id));
    if (!ownStudentId || ownStudentId !== booking.student_id) {
      throw new AppError(403, "ທ່ານບໍ່ມີສິດເຂົ້າເຖິງການຈອງນີ້");
    }
  }

  return res.status(200).json({ data: booking });
});

/* ---------------------------------------------------------
   POST /api/bookings
   ແກ້ 4 ຈຸດຈາກຂອງເກົ່າ:
   1. ນັກສຶກສາຈອງແທນຄົນອື່ນໄດ້ (IDOR) → ບັງຄັບໃຊ້ id ຂອງຕົນເອງ
   2. ສົ່ງ studentId/roomId ທີ່ບໍ່ມີຢູ່ → ເຄີຍເປັນ 500, ດຽວນີ້ເປັນ 404
   3. ຈອງຊ້ອນກັນເກີນ capacity ໄດ້ → ກວດຈຳນວນຜູ້ຢູ່ກ່ອນ
   4. ຈອງແລ້ວ status ຂອງຫ້ອງບໍ່ປ່ຽນ → ອັບເດດເປັນ occupied ເມື່ອເຕັມ
   ໃຊ້ transaction + FOR UPDATE ກັນສອງຄົນຈອງບ່ອນສຸດທ້າຍພ້ອມກັນ
   --------------------------------------------------------- */
export const createBooking = asyncHandler(async (req: AuthRequest, res: Response) => {
  const studentId = await resolveStudentScope(req.user, req.body?.studentId);
  const roomId = requirePositiveInt(req.body?.roomId, "roomId");
  const checkInDate = parseDate(req.body?.checkInDate, "checkInDate");

  await ensureExists("students", studentId);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // ລັອກແຖວຫ້ອງໄວ້ ແລະ ກວດຄວາມຈຸພາຍໃນ transaction ດຽວກັນ
    // (ນັບຈາກ students.room_id ເຊິ່ງເປັນແຫຼ່ງຄວາມຈິງດຽວຂອງລະບົບ)
    const roomInfo = await assertRoomHasSpace(roomId, conn, { forUpdate: true });

    // ນັກສຶກສາຄົນນີ້ມີການຈອງທີ່ຍັງ active ຢູ່ແລ້ວບໍ່?
    const [dupRows] = await conn.query<RowDataPacket[]>(
      `SELECT id, room_id FROM bookings
        WHERE student_id = ? AND status IN ${OCCUPYING} LIMIT 1`,
      [studentId]
    );
    if (dupRows.length > 0) {
      throw new AppError(
        409,
        `ນັກສຶກສາຄົນນີ້ມີການຈອງທີ່ຍັງໃຊ້ງານຢູ່ແລ້ວ (booking id = ${dupRows[0].id})`
      );
    }

    const [result] = await conn.query<ResultSetHeader>(
      "INSERT INTO bookings (student_id, room_id, check_in_date, status) VALUES (?, ?, ?, 'pending')",
      [studentId, roomId, checkInDate]
    );

    // ຜູກນັກສຶກສາເຂົ້າຫ້ອງ — ນີ້ຄືການ "ເພີ່ມຄົນໜຶ່ງເຂົ້າຫ້ອງ" ທີ່ການນັບອີງໃສ່
    await conn.query("UPDATE students SET room_id = ? WHERE id = ?", [roomId, studentId]);

    // ຖ້າຄົນໃໝ່ນີ້ເຮັດໃຫ້ຫ້ອງເຕັມພໍດີ → ປ່ຽນ status ເປັນ occupied
    const occupiedAfter = roomInfo.occupants + 1;
    await conn.query("UPDATE rooms SET status = ? WHERE id = ? AND status <> 'maintenance'", [
      occupiedAfter >= roomInfo.capacity ? "occupied" : "available",
      roomId,
    ]);

    const [rows] = await conn.query<BookingRow[]>("SELECT * FROM bookings WHERE id = ?", [
      result.insertId,
    ]);

    await conn.commit();

    if (isStaff(req.user?.role)) {
      // admin/staff ຈອງແທນ → ແຈ້ງນັກສຶກສາ
      void notifyStudent(studentId, {
        title: "ມີການຈອງຫ້ອງໃຫ້ທ່ານ",
        message: `ທ່ານຖືກຈອງຫ້ອງ (booking #${rows[0].id}) ວັນເຂົ້າພັກ ${checkInDate}`,
        type: "info",
      });
    }

    const vacancyAfter = Math.max(0, roomInfo.capacity - occupiedAfter);
    return res.status(201).json({
      message: "ຈອງຫ້ອງສຳເລັດ",
      data: rows[0],
      // ບອກສະພາບຫ້ອງຫຼັງຈອງ ເພື່ອໃຫ້ frontend ອັບເດດໜ້າຈໍໄດ້ທັນທີ
      room: {
        id: roomId,
        capacity: roomInfo.capacity,
        occupants: occupiedAfter,
        vacancy: vacancyAfter,
        isFull: occupiedAfter >= roomInfo.capacity,
        label: `${occupiedAfter}/${roomInfo.capacity}`,
        statusText:
          occupiedAfter >= roomInfo.capacity
            ? "ເຕັມແລ້ວ"
            : `ຍັງຮັບໄດ້ອີກ ${vacancyAfter} ຄົນ`,
      },
    });
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
});

/* ---------------------------------------------------------
   ປົດນັກສຶກສາອອກຈາກຫ້ອງຂອງການຈອງນີ້ ແລ້ວຄຳນວນສະຖານະຫ້ອງໃໝ່
   (ໃຊ້ຮ່ວມກັນໃນ checkout / cancel / update)
   --------------------------------------------------------- */
const releaseRoom = async (booking: { student_id: number; room_id: number }) => {
  await pool.query("UPDATE students SET room_id = NULL WHERE id = ? AND room_id = ?", [
    booking.student_id,
    booking.room_id,
  ]);
  await syncRoomStatus(booking.room_id);
};

const roomView = async (roomId: number) => {
  const after = await getRoomOccupancy(roomId);
  return {
    id: after.roomId,
    capacity: after.capacity,
    occupants: after.occupants,
    vacancy: after.vacancy,
    isFull: after.isFull,
    label: after.label,
    statusText: after.isFull ? "ເຕັມແລ້ວ" : `ຍັງຮັບໄດ້ອີກ ${after.vacancy} ຄົນ`,
  };
};

/* ---------------------------------------------------------
   PUT /api/bookings/:id  (admin ເທົ່ານັ້ນ)
   ກົດເພື່ອຄວາມສອດຄ່ອງ ກັບ students.room_id (ແຫຼ່ງຄວາມຈິງຂອງການນັບຄົນໃນຫ້ອງ):
   - ການຈອງທີ່ຍັງໃຊ້ງານ (pending/active) ປ່ຽນ studentId ບໍ່ໄດ້ → ໃຫ້ຍົກເລີກແລ້ວຈອງໃໝ່
   - ປ່ຽນ roomId ຂອງການຈອງທີ່ຍັງໃຊ້ງານ → ກວດຄວາມຈຸຫ້ອງໃໝ່ ແລ້ວຍ້າຍນັກສຶກສາໄປນຳ
   - ຕັ້ງເປັນ checked_out / cancelled → ປົດນັກສຶກສາອອກຈາກຫ້ອງ
   - ເປີດການຈອງທີ່ປິດແລ້ວກັບມາໃໝ່ບໍ່ໄດ້ → ໃຫ້ສ້າງການຈອງໃໝ່
   --------------------------------------------------------- */
export const updateBooking = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = paramId(req.params.id);

  const [existingRows] = await pool.query<BookingRow[]>(
    "SELECT * FROM bookings WHERE id = ? LIMIT 1",
    [id]
  );
  const existing = existingRows[0];
  if (!existing) {
    throw new AppError(404, "ບໍ່ພົບການຈອງດັ່ງກ່າວ");
  }

  const { studentId, roomId, checkInDate, checkOutDate } = req.body ?? {};
  const status = optionalEnum(req.body?.status, BOOKING_STATUSES, "status");

  const nextStudentId =
    studentId !== undefined ? requirePositiveInt(studentId, "studentId") : existing.student_id;
  const nextRoomId =
    roomId !== undefined ? requirePositiveInt(roomId, "roomId") : existing.room_id;

  if (nextStudentId !== existing.student_id) await ensureExists("students", nextStudentId);
  if (nextRoomId !== existing.room_id) await ensureExists("rooms", nextRoomId);

  const nextCheckIn =
    checkInDate !== undefined ? parseDate(checkInDate, "checkInDate") : existing.check_in_date;
  const nextStatus = status ?? existing.status;

  // ຖ້າຍັງ active ຢູ່ ແຕ່ຕັ້ງ check_out_date ແລ້ວ ຈະຂັດກັນເອງ
  const nextCheckOut =
    checkOutDate !== undefined ? checkOutDate : existing.check_out_date;
  if (nextCheckOut && nextStatus !== "checked_out") {
    throw new AppError(400, "ຖ້າມີ checkOutDate ແລ້ວ status ຕ້ອງເປັນ checked_out");
  }

  const wasOccupying = existing.status === "pending" || existing.status === "active";
  const willOccupy = nextStatus === "pending" || nextStatus === "active";

  if (!wasOccupying && willOccupy) {
    throw new AppError(
      409,
      "ການຈອງທີ່ check-out/ຍົກເລີກແລ້ວ ເປີດກັບມາໃໝ່ບໍ່ໄດ້ ກະລຸນາສ້າງການຈອງໃໝ່",
      "BOOKING_CLOSED"
    );
  }
  if (wasOccupying && willOccupy && nextStudentId !== existing.student_id) {
    throw new AppError(
      409,
      "ການຈອງທີ່ຍັງໃຊ້ງານປ່ຽນນັກສຶກສາບໍ່ໄດ້ ກະລຸນາຍົກເລີກແລ້ວຈອງໃໝ່",
      "BOOKING_STUDENT_LOCKED"
    );
  }

  // ຍ້າຍຫ້ອງ: ກວດຄວາມຈຸຫ້ອງໃໝ່ກ່ອນ ແລ້ວຍ້າຍນັກສຶກສາຕາມ
  if (wasOccupying && willOccupy && nextRoomId !== existing.room_id) {
    await assertRoomHasSpace(nextRoomId, undefined, { excludeStudentId: existing.student_id });
    await pool.query("UPDATE students SET room_id = ? WHERE id = ?", [nextRoomId, existing.student_id]);
  }

  await pool.query(
    `UPDATE bookings SET student_id = ?, room_id = ?, check_in_date = ?, check_out_date = ?, status = ?
      WHERE id = ?`,
    [nextStudentId, nextRoomId, nextCheckIn, nextCheckOut, nextStatus, id]
  );

  if (wasOccupying && !willOccupy) {
    // ປິດການຈອງ → ປົດນັກສຶກສາອອກ (ຮັກສາ check_out_date ຖ້າເປັນ checked_out ແລະຍັງບໍ່ມີ)
    if (nextStatus === "checked_out" && !nextCheckOut) {
      await pool.query("UPDATE bookings SET check_out_date = NOW() WHERE id = ?", [id]);
    }
    await releaseRoom(existing);
  } else {
    await syncRoomStatus(nextRoomId);
    if (nextRoomId !== existing.room_id) await syncRoomStatus(existing.room_id);
  }

  const [rows] = await pool.query<BookingRow[]>("SELECT * FROM bookings WHERE id = ?", [id]);
  return res.status(200).json({ message: "ອັບເດດການຈອງສຳເລັດ", data: rows[0] });
});

/* ---------------------------------------------------------
   PATCH /api/bookings/:id/approve  (admin / staff)
   ອະນຸມັດການຈອງ: pending → active
   --------------------------------------------------------- */
export const approveBooking = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = paramId(req.params.id);

  const [rows] = await pool.query<BookingRow[]>("SELECT * FROM bookings WHERE id = ? LIMIT 1", [id]);
  const existing = rows[0];
  if (!existing) throw new AppError(404, "ບໍ່ພົບການຈອງດັ່ງກ່າວ");
  if (existing.status !== "pending") {
    throw new AppError(409, `ອະນຸມັດໄດ້ສະເພາະການຈອງທີ່ລໍຖ້າ (pending) — ສະຖານະປັດຈຸບັນ: ${existing.status}`);
  }

  await pool.query("UPDATE bookings SET status = 'active' WHERE id = ?", [id]);

  void notifyStudent(existing.student_id, {
    title: "ການຈອງຫ້ອງໄດ້ຮັບການອະນຸມັດ",
    message: `ການຈອງຂອງທ່ານ (#${id}) ຖືກອະນຸມັດແລ້ວ ວັນເຂົ້າພັກ ${existing.check_in_date}`,
    type: "info",
  });

  const [after] = await pool.query<BookingRow[]>("SELECT * FROM bookings WHERE id = ?", [id]);
  return res.status(200).json({ message: "ອະນຸມັດການຈອງສຳເລັດ", data: after[0] });
});

/* ---------------------------------------------------------
   PATCH /api/bookings/:id/cancel
   - ນັກສຶກສາ: ຍົກເລີກໄດ້ສະເພາະການຈອງຂອງຕົນທີ່ຍັງລໍຖ້າ (pending)
   - admin/staff: ຍົກເລີກໄດ້ທັງ pending ແລະ active
   ຍົກເລີກແລ້ວຫ້ອງຈະຫວ່າງຄືນທັນທີ
   --------------------------------------------------------- */
export const cancelBooking = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = paramId(req.params.id);

  const [rows] = await pool.query<BookingRow[]>("SELECT * FROM bookings WHERE id = ? LIMIT 1", [id]);
  const existing = rows[0];
  if (!existing) throw new AppError(404, "ບໍ່ພົບການຈອງດັ່ງກ່າວ");

  const staff = isStaff(req.user?.role);
  if (!staff) {
    const own = await getOwnStudentId(Number(req.user?.id));
    if (!own || own !== existing.student_id) {
      throw new AppError(403, "ທ່ານບໍ່ມີສິດເຂົ້າເຖິງການຈອງນີ້");
    }
    if (existing.status !== "pending") {
      throw new AppError(409, "ນັກສຶກສາຍົກເລີກໄດ້ສະເພາະການຈອງທີ່ຍັງລໍຖ້າອະນຸມັດ ກະລຸນາຕິດຕໍ່ພະນັກງານ");
    }
  }

  if (existing.status !== "pending" && existing.status !== "active") {
    throw new AppError(409, `ຍົກເລີກບໍ່ໄດ້ — ການຈອງນີ້ຢູ່ໃນສະຖານະ ${existing.status} ແລ້ວ`);
  }

  await pool.query("UPDATE bookings SET status = 'cancelled' WHERE id = ?", [id]);
  await releaseRoom(existing);

  if (staff) {
    void notifyStudent(existing.student_id, {
      title: "ການຈອງຫ້ອງຖືກຍົກເລີກ",
      message: `ການຈອງຂອງທ່ານ (#${id}) ຖືກຍົກເລີກໂດຍພະນັກງານ`,
      type: "warning",
    });
  }

  const [after] = await pool.query<BookingRow[]>("SELECT * FROM bookings WHERE id = ?", [id]);
  return res.status(200).json({
    message: "ຍົກເລີກການຈອງສຳເລັດ",
    data: after[0],
    room: await roomView(existing.room_id),
  });
});

/* ---------------------------------------------------------
   PATCH /api/bookings/:id/checkout  (admin / staff)
   ແກ້: ຂອງເກົ່າ checkout ແລ້ວຫ້ອງຍັງຄ້າງເປັນ occupied ຕະຫຼອດໄປ
   --------------------------------------------------------- */
export const checkoutBooking = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = paramId(req.params.id);

  const [existingRows] = await pool.query<BookingRow[]>(
    "SELECT * FROM bookings WHERE id = ? LIMIT 1",
    [id]
  );
  const existing = existingRows[0];
  if (!existing) {
    throw new AppError(404, "ບໍ່ພົບການຈອງດັ່ງກ່າວ");
  }
  if (existing.status === "checked_out") {
    throw new AppError(400, "ການຈອງນີ້ check-out ໄປແລ້ວ");
  }
  if (existing.status === "cancelled") {
    throw new AppError(400, "ການຈອງນີ້ຖືກຍົກເລີກແລ້ວ check-out ບໍ່ໄດ້");
  }

  await pool.query(
    "UPDATE bookings SET status = 'checked_out', check_out_date = NOW() WHERE id = ?",
    [id]
  );

  // ປົດນັກສຶກສາອອກຈາກຫ້ອງ ແລ້ວຄຳນວນ status ຫ້ອງໃໝ່
  await releaseRoom(existing);

  const [rows] = await pool.query<BookingRow[]>("SELECT * FROM bookings WHERE id = ?", [id]);

  return res.status(200).json({
    message: "Check-out ສຳເລັດ",
    data: rows[0],
    room: await roomView(existing.room_id),
  });
});

/* ---------------------------------------------------------
   DELETE /api/bookings/:id  (admin ເທົ່ານັ້ນ)
   --------------------------------------------------------- */
export const deleteBooking = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = paramId(req.params.id);

  const [rows] = await pool.query<BookingRow[]>(
    "SELECT * FROM bookings WHERE id = ? LIMIT 1",
    [id]
  );
  const deleted = rows[0];
  if (!deleted) {
    throw new AppError(404, "ບໍ່ພົບການຈອງດັ່ງກ່າວ");
  }

  await pool.query("DELETE FROM bookings WHERE id = ?", [id]);
  // ລຶບການຈອງທີ່ຍັງໃຊ້ງານ → ປົດນັກສຶກສາອອກຈາກຫ້ອງນຳ (ບໍ່ດັ່ງນັ້ນຫ້ອງຈະຄ້າງເປັນເຕັມ)
  if (deleted.status === "pending" || deleted.status === "active") {
    await releaseRoom(deleted);
  } else {
    await syncRoomStatus(deleted.room_id);
  }

  return res.status(200).json({ message: "ລຶບການຈອງສຳເລັດ", data: deleted });
});
