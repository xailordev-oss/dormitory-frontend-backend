import request from "supertest";
import bcrypt from "bcrypt";
import pool from "../src/config/db";
import app from "../src/app";

export const api = () => request(app);

let counter = 0;
export const uniq = (prefix = "u") => `${prefix}${Date.now().toString(36)}${(counter++).toString(36)}`;

export const PASSWORD = "pass1234";

export interface TestUser {
  id: number;
  email: string;
  token: string;
  refreshToken: string;
  studentId: number | null;
}

/** ສ້າງບັນຊີ role ທີ່ຕ້ອງການໂດຍກົງໃນ DB ແລ້ວ login ຜ່ານ API ຈິງ */
export const makeUser = async (role: "admin" | "staff" | "student", name = uniq(role)): Promise<TestUser> => {
  const email = `${name}@test.la`;
  if (role === "student") {
    const reg = await api().post("/api/auth/register").send({ name, email, password: PASSWORD });
    if (reg.status !== 201) throw new Error("register failed: " + JSON.stringify(reg.body));
  } else {
    const hash = await bcrypt.hash(PASSWORD, 4);
    await pool.query("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)", [
      name,
      email,
      hash,
      role,
    ]);
  }
  const login = await api().post("/api/auth/login").send({ email, password: PASSWORD });
  if (login.status !== 200) throw new Error("login failed: " + JSON.stringify(login.body));
  return {
    id: login.body.user.id,
    email,
    token: login.body.accessToken,
    refreshToken: login.body.refreshToken,
    studentId: login.body.user.role === "student" ? await studentIdOf(login.body.user.id) : null,
  };
};

export const studentIdOf = async (userId: number): Promise<number | null> => {
  const [rows] = await pool.query<any[]>("SELECT id FROM students WHERE user_id = ?", [userId]);
  return rows[0]?.id ?? null;
};

export const auth = (u: { token: string }) => ({ Authorization: `Bearer ${u.token}` });

/** ສ້າງຕຶກ + ຫ້ອງ ຜ່ານ API ດ້ວຍ admin */
export const makeRoom = async (
  admin: TestUser,
  opts: { capacity?: number; price?: number; roomNumber?: string } = {}
) => {
  const b = await api()
    .post("/api/buildings")
    .set(auth(admin))
    .send({ name: uniq("B"), address: "test", totalFloors: 3 });
  if (b.status !== 201) throw new Error("building failed: " + JSON.stringify(b.body));
  const buildingId = b.body.data.id;
  const r = await api()
    .post("/api/rooms")
    .set(auth(admin))
    .send({
      roomNumber: opts.roomNumber ?? uniq("R"),
      buildingId,
      capacity: opts.capacity ?? 2,
      price: opts.price ?? 500000,
    });
  if (r.status !== 201) throw new Error("room failed: " + JSON.stringify(r.body));
  return { buildingId, roomId: r.body.data.id as number };
};
