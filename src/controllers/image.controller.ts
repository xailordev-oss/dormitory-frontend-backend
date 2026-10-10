import fs from "fs";
import path from "path";
import { Request, Response } from "express";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import pool from "../config/db";
import { UPLOAD_ROOT } from "../middlewares/upload.middleware";

type EntityType = "room" | "building" | "student";

// ແປງ path ໃນ URL (rooms/buildings/students) ໃຫ້ກົງກັບຄ່າ enum ໃນ DB (room/building/student)
const ENTITY_MAP: Record<string, { type: EntityType; table: string; folder: string }> = {
  rooms: { type: "room", table: "rooms", folder: "rooms" },
  buildings: { type: "building", table: "buildings", folder: "buildings" },
  students: { type: "student", table: "students", folder: "students" },
};

interface ImageRow extends RowDataPacket {
  id: number;
  entity_type: EntityType;
  entity_id: number;
  image_url: string;
  is_cover: boolean;
  created_at: string;
}

const getEntityConfig = (entityTypeParam: string) => {
  const config = ENTITY_MAP[entityTypeParam.toLowerCase()];
  return config || null;
};

// POST /api/images/:entityType/:entityId  (multipart/form-data, field name = "image")
export const uploadImage = async (req: Request, res: Response) => {
  try {
    const config = getEntityConfig(String(req.params.entityType));
    if (!config) {
      return res.status(400).json({
        message: "entityType ບໍ່ຖືກຕ້ອງ (ຕ້ອງເປັນ rooms, buildings ຫຼື students)",
      });
    }

    const entityId = Number(req.params.entityId);
    if (!entityId) {
      return res.status(400).json({ message: "entityId ບໍ່ຖືກຕ້ອງ" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "ກະລຸນາເລືອກໄຟລ໌ຮູບພາບ (field: image)" });
    }

    // ກວດວ່າ entity (ຫ້ອງ/ຕຶກ/ນັກສຶກສາ) ນີ້ມີຢູ່ຈິງ
    const [entityRows] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM ${config.table} WHERE id = ? LIMIT 1`,
      [entityId]
    );
    if (entityRows.length === 0) {
      // ລຶບໄຟລ໌ທີ່ອັບໂຫລດຄ້າງໄວ້ ຖ້າ entity ບໍ່ມີຢູ່ຈິງ
      fs.unlink(req.file.path, () => {});
      return res.status(404).json({ message: `ບໍ່ພົບ ${config.type} ດັ່ງກ່າວ` });
    }

    const imageUrl = `/uploads/${config.folder}/${req.file.filename}`;

    const [existingImages] = await pool.query<ImageRow[]>(
      "SELECT id FROM images WHERE entity_type = ? AND entity_id = ?",
      [config.type, entityId]
    );
    const isFirstImage = existingImages.length === 0;

    const [result] = await pool.query<ResultSetHeader>(
      "INSERT INTO images (entity_type, entity_id, image_url, is_cover) VALUES (?, ?, ?, ?)",
      [config.type, entityId, imageUrl, isFirstImage]
    );

    const [rows] = await pool.query<ImageRow[]>("SELECT * FROM images WHERE id = ?", [
      result.insertId,
    ]);

    return res.status(201).json({
      message: "ອັບໂຫລດຮູບພາບສຳເລັດ",
      image: rows[0],
    });
  } catch (error) {
    return res.status(500).json({ message: "ເກີດຂໍ້ຜິດພາດ", error: String(error) });
  }
};

// GET /api/images/:entityType/:entityId
export const getImages = async (req: Request, res: Response) => {
  try {
    const config = getEntityConfig(String(req.params.entityType));
    if (!config) {
      return res.status(400).json({
        message: "entityType ບໍ່ຖືກຕ້ອງ (ຕ້ອງເປັນ rooms, buildings ຫຼື students)",
      });
    }

    const entityId = Number(req.params.entityId);

    const [images] = await pool.query<ImageRow[]>(
      "SELECT * FROM images WHERE entity_type = ? AND entity_id = ? ORDER BY is_cover DESC, id DESC",
      [config.type, entityId]
    );

    return res.status(200).json({ total: images.length, images });
  } catch (error) {
    return res.status(500).json({ message: "ເກີດຂໍ້ຜິດພາດ", error: String(error) });
  }
};

// PATCH /api/images/:id/cover  → ຕັ້ງເປັນຮູບປົກ (cover) ຂອງ entity ນັ້ນ
export const setCoverImage = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    const [rows] = await pool.query<ImageRow[]>("SELECT * FROM images WHERE id = ? LIMIT 1", [id]);
    const image = rows[0];
    if (!image) {
      return res.status(404).json({ message: "ບໍ່ພົບຮູບພາບ" });
    }

    await pool.query(
      "UPDATE images SET is_cover = FALSE WHERE entity_type = ? AND entity_id = ?",
      [image.entity_type, image.entity_id]
    );
    await pool.query("UPDATE images SET is_cover = TRUE WHERE id = ?", [id]);

    const [updated] = await pool.query<ImageRow[]>("SELECT * FROM images WHERE id = ?", [id]);

    return res.status(200).json({ message: "ຕັ້ງເປັນຮູບປົກສຳເລັດ", image: updated[0] });
  } catch (error) {
    return res.status(500).json({ message: "ເກີດຂໍ້ຜິດພາດ", error: String(error) });
  }
};

// DELETE /api/images/:id
export const deleteImage = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    const [rows] = await pool.query<ImageRow[]>("SELECT * FROM images WHERE id = ? LIMIT 1", [id]);
    const image = rows[0];
    if (!image) {
      return res.status(404).json({ message: "ບໍ່ພົບຮູບພາບ" });
    }

    await pool.query<ResultSetHeader>("DELETE FROM images WHERE id = ?", [id]);

    // ລຶບໄຟລ໌ຈິງອອກຈາກ disk ນຳ
    const filePath = path.join(UPLOAD_ROOT, image.image_url.replace("/uploads/", ""));
    fs.unlink(filePath, () => {});

    // ຖ້າຮູບທີ່ລຶບເປັນຮູບປົກ ໃຫ້ຕັ້ງຮູບອື່ນທີ່ຍັງເຫຼືອເປັນຮູບປົກແທນ
    if (image.is_cover) {
      const [remaining] = await pool.query<ImageRow[]>(
        "SELECT * FROM images WHERE entity_type = ? AND entity_id = ? ORDER BY id DESC LIMIT 1",
        [image.entity_type, image.entity_id]
      );
      if (remaining[0]) {
        await pool.query("UPDATE images SET is_cover = TRUE WHERE id = ?", [remaining[0].id]);
      }
    }

    return res.status(200).json({ message: "ລຶບຮູບພາບສຳເລັດ" });
  } catch (error) {
    return res.status(500).json({ message: "ເກີດຂໍ້ຜິດພາດ", error: String(error) });
  }
};
