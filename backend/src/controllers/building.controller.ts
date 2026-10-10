import { Request, Response } from "express";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import pool from "../config/db";
import {
  AppError,
  asyncHandler,
  optionalText,
  paramId,
  requireText,
} from "../utils/helpers";

interface BuildingRow extends RowDataPacket {
  id: number;
  name: string;
  address: string | null;
  total_floors: number | null;
}

// ຕິດຈຳນວນຫ້ອງມານຳ ເພື່ອໃຫ້ frontend ສະແດງໄດ້ເລີຍ
const BUILDING_SELECT = `
  SELECT b.*,
         (SELECT COUNT(*) FROM rooms r WHERE r.building_id = b.id) AS room_count
    FROM buildings b`;

const parseFloors = (value: unknown): number | null => {
  if (value === undefined || value === null || value === "") return null;
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0 || num > 100) {
    throw new AppError(400, "totalFloors ຕ້ອງເປັນຈຳນວນເຕັມ 1–100");
  }
  return num;
};

/* GET /api/buildings */
export const getAllBuildings = asyncHandler(async (req: Request, res: Response) => {
  const [buildings] = await pool.query<BuildingRow[]>(`${BUILDING_SELECT} ORDER BY b.id DESC`);
  return res.status(200).json({ data: buildings, total: buildings.length, buildings });
});

/* GET /api/buildings/:id */
export const getBuildingById = asyncHandler(async (req: Request, res: Response) => {
  const id = paramId(req.params.id);

  const [rows] = await pool.query<BuildingRow[]>(`${BUILDING_SELECT} WHERE b.id = ? LIMIT 1`, [id]);
  const building = rows[0];
  if (!building) {
    throw new AppError(404, "ບໍ່ພົບຕຶກດັ່ງກ່າວ");
  }

  return res.status(200).json({ data: building, building });
});

/* POST /api/buildings  (admin ເທົ່ານັ້ນ) */
export const createBuilding = asyncHandler(async (req: Request, res: Response) => {
  const name = requireText(req.body?.name, "ຊື່ຕຶກ", 150);
  const address = optionalText(req.body?.address, 255);
  const totalFloors = parseFloors(req.body?.totalFloors);

  // ກັນສ້າງຕຶກຊື່ຊ້ຳ — ເຮັດໃຫ້ admin ສັບສົນຕອນເລືອກຕຶກໃນ dropdown
  const [dupRows] = await pool.query<BuildingRow[]>(
    "SELECT id FROM buildings WHERE name = ? LIMIT 1",
    [name]
  );
  if (dupRows.length > 0) {
    throw new AppError(409, "ມີຕຶກຊື່ນີ້ຢູ່ແລ້ວ");
  }

  const [result] = await pool.query<ResultSetHeader>(
    "INSERT INTO buildings (name, address, total_floors) VALUES (?, ?, ?)",
    [name, address, totalFloors]
  );

  const [rows] = await pool.query<BuildingRow[]>("SELECT * FROM buildings WHERE id = ?", [
    result.insertId,
  ]);

  return res.status(201).json({ message: "ເພີ່ມຕຶກສຳເລັດ", data: rows[0], building: rows[0] });
});

/* PUT /api/buildings/:id  (admin ເທົ່ານັ້ນ) */
export const updateBuilding = asyncHandler(async (req: Request, res: Response) => {
  const id = paramId(req.params.id);

  const [existingRows] = await pool.query<BuildingRow[]>(
    "SELECT * FROM buildings WHERE id = ? LIMIT 1",
    [id]
  );
  const existing = existingRows[0];
  if (!existing) {
    throw new AppError(404, "ບໍ່ພົບຕຶກດັ່ງກ່າວ");
  }

  const name =
    req.body?.name !== undefined ? requireText(req.body.name, "ຊື່ຕຶກ", 150) : existing.name;
  const address =
    req.body?.address !== undefined ? optionalText(req.body.address, 255) : existing.address;
  const totalFloors =
    req.body?.totalFloors !== undefined ? parseFloors(req.body.totalFloors) : existing.total_floors;

  if (name !== existing.name) {
    const [dupRows] = await pool.query<BuildingRow[]>(
      "SELECT id FROM buildings WHERE name = ? AND id <> ? LIMIT 1",
      [name, id]
    );
    if (dupRows.length > 0) {
      throw new AppError(409, "ມີຕຶກຊື່ນີ້ຢູ່ແລ້ວ");
    }
  }

  await pool.query(
    "UPDATE buildings SET name = ?, address = ?, total_floors = ? WHERE id = ?",
    [name, address, totalFloors, id]
  );

  const [rows] = await pool.query<BuildingRow[]>("SELECT * FROM buildings WHERE id = ?", [id]);
  return res.status(200).json({ message: "ແກ້ໄຂຕຶກສຳເລັດ", data: rows[0], building: rows[0] });
});

/* DELETE /api/buildings/:id  (admin ເທົ່ານັ້ນ) */
export const deleteBuilding = asyncHandler(async (req: Request, res: Response) => {
  const id = paramId(req.params.id);

  const [existingRows] = await pool.query<BuildingRow[]>(
    "SELECT * FROM buildings WHERE id = ? LIMIT 1",
    [id]
  );
  const existing = existingRows[0];
  if (!existing) {
    throw new AppError(404, "ບໍ່ພົບຕຶກດັ່ງກ່າວ");
  }

  // rooms ອີງໃສ່ buildings ດ້ວຍ FK ON DELETE CASCADE
  // ຖ້າລຶບໄປ ຫ້ອງ + ການຈອງໃນຫ້ອງນັ້ນຈະຫາຍໄປນຳ ຈຶ່ງບລັອກໄວ້
  const [roomRows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS total FROM rooms WHERE building_id = ?",
    [id]
  );
  const roomCount = Number(roomRows[0]?.total ?? 0);
  if (roomCount > 0) {
    throw new AppError(
      409,
      `ລຶບຕຶກນີ້ບໍ່ໄດ້ ຍ້ອນຍັງມີ ${roomCount} ຫ້ອງອີງໃສ່ຕຶກນີ້ຢູ່ ກະລຸນາລຶບ/ຍ້າຍຫ້ອງອອກກ່ອນ`
    );
  }

  await pool.query("DELETE FROM buildings WHERE id = ?", [id]);
  await pool.query("DELETE FROM images WHERE entity_type = 'building' AND entity_id = ?", [id]);

  return res.status(200).json({ message: "ລຶບຕຶກສຳເລັດ", data: existing, building: existing });
});
