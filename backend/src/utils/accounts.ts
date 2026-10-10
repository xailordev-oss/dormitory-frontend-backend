import bcrypt from "bcrypt";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import pool from "../config/db";
import { AppError, Role } from "./helpers";

export interface CreatedAccount {
  userId: number;
  role: Role;
  studentId: number | null;
  /**
   * true = ມີນັກສຶກສາທີ່ໃຊ້ອີເມວນີ້ຢູ່ແລ້ວ (admin ສ້າງໄວ້ກ່ອນ) ແຕ່ຍັງບໍ່ໄດ້ຜູກກັບບັນຊີ
   * ເຮົາ "ບໍ່ຜູກໃຫ້ອັດຕະໂນມັດ" ເພາະບໍ່ໄດ້ຢືນຢັນເຈົ້າຂອງອີເມວ — ຖ້າຜູກໃຫ້, ຄົນທີ່ຮູ້ອີເມວຂອງ
   * ນັກສຶກສາຈະສະໝັກກ່ອນແລ້ວເຂົ້າເຖິງຫ້ອງ/ການຊຳລະຂອງເຂົາໄດ້. admin ຕ້ອງຜູກເອງ.
   */
  needsLinking: boolean;
}

const isRetryable = (error: any) => error?.code === "ER_LOCK_DEADLOCK" || error?.code === "ER_LOCK_WAIT_TIMEOUT";

/**
 * ສ້າງບັນຊີ + (ຖ້າເປັນ student) ສ້າງຂໍ້ມູນນັກສຶກສາໃຫ້ພ້ອມກັນໃນ transaction ດຽວ
 * ໃຊ້ຮ່ວມກັນລະຫວ່າງ POST /api/auth/register ແລະ POST /api/users (admin)
 *
 * ຫມາຍເຫດ: ບໍ່ໃຊ້ SELECT ... FOR UPDATE ກັບແຖວທີ່ຍັງບໍ່ມີ — ເພາະຈະເກີດ gap lock ແລະ deadlock ເມື່ອມີຄົນສະໝັກ
 * ພ້ອມກັນຫຼາຍຄົນ (ຈັບໄດ້ຈາກ test). ໃຊ້ unique constraint ຂອງຖານຂໍ້ມູນເປັນຕົວຕັດສິນແທນ ແລະ retry ຖ້າຊົນກັນ
 */
export const createAccount = async (input: {
  name: string;
  email: string;
  password: string;
  role: Role;
  phone?: string | null;
}): Promise<CreatedAccount> => {
  const passwordHash = await bcrypt.hash(input.password, 10);

  for (let attempt = 1; ; attempt++) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [userResult] = await conn.query<ResultSetHeader>(
        "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
        [input.name, input.email, passwordHash, input.role]
      );
      const userId = userResult.insertId;

      let studentId: number | null = null;
      let needsLinking = false;

      if (input.role === "student") {
        const [stuRows] = await conn.query<RowDataPacket[]>(
          "SELECT id, user_id FROM students WHERE email = ? LIMIT 1",
          [input.email]
        );
        if (stuRows.length === 0) {
          try {
            const [stuResult] = await conn.query<ResultSetHeader>(
              "INSERT INTO students (user_id, name, email, phone, status) VALUES (?, ?, ?, ?, 'active')",
              [userId, input.name, input.email, input.phone ?? null]
            );
            studentId = stuResult.insertId;
          } catch (error: any) {
            // admin ເພີ່ງສ້າງນັກສຶກສາອີເມວນີ້ພໍດີ → ປະຕິບັດຄືກໍລະນີ "ມີຢູ່ແລ້ວ"
            if (error?.code !== "ER_DUP_ENTRY") throw error;
            needsLinking = true;
          }
        } else {
          needsLinking = stuRows[0].user_id === null;
        }
      }

      await conn.commit();
      return { userId, role: input.role, studentId, needsLinking };
    } catch (error: any) {
      await conn.rollback().catch(() => {});
      if (isRetryable(error) && attempt < 3) continue;
      if (error?.code === "ER_DUP_ENTRY") throw new AppError(409, "ອີເມວນີ້ຖືກໃຊ້ແລ້ວ");
      throw error;
    } finally {
      conn.release();
    }
  }
};
