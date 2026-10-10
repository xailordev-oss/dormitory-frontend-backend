import { describe, it, expect, afterAll } from "vitest";
import pool from "../src/config/db";
import { api, auth, makeUser, makeRoom, TestUser } from "./helpers";

afterAll(async () => {
  await pool.end();
});

const room = async (admin: TestUser, id: number) => (await api().get(`/api/rooms/${id}`).set(auth(admin))).body.data;
const book = (u: TestUser, roomId: number, extra: object = {}) =>
  api().post("/api/bookings").set(auth(u)).send({ roomId, checkInDate: "2026-10-01", ...extra });

describe("ຈອງຫ້ອງ ແລະ ຄວາມຈຸ", () => {
  it("ຍິງຈອງພ້ອມກັນ 5 ຄົນ ໃສ່ຫ້ອງ 2 ຄົນ → ສຳເລັດພຽງ 2, ຫ້ອງເຕັມ (occupied)", async () => {
    const admin = await makeUser("admin");
    const { roomId } = await makeRoom(admin, { capacity: 2 });
    const students = await Promise.all([1, 2, 3, 4, 5].map(() => makeUser("student")));

    const results = await Promise.all(students.map((s) => book(s, roomId)));
    const ok = results.filter((r) => r.status === 201).length;
    const full = results.filter((r) => r.status === 409).length;
    expect(ok).toBe(2);
    expect(full).toBe(3);

    const r = await room(admin, roomId);
    expect(r.occupants).toBe(2);
    expect(r.status).toBe("occupied");
    expect(r.isFull).toBe(true);
  });

  it("ຈອງຊ້ຳ, ຈອງແທນຄົນອື່ນ ບໍ່ໄດ້", async () => {
    const admin = await makeUser("admin");
    const { roomId } = await makeRoom(admin, { capacity: 4 });
    const a = await makeUser("student");
    const b = await makeUser("student");

    expect((await book(a, roomId)).status).toBe(201);
    expect((await book(a, roomId)).status).toBe(409); // ມີການຈອງຢູ່ແລ້ວ
    expect((await book(b, roomId, { studentId: a.studentId })).status).toBe(403); // ຈອງແທນ a ບໍ່ໄດ້
    expect((await api().post("/api/bookings").set(auth(b)).send({ roomId, checkInDate: "01/10/2026" })).status).toBe(400);
    expect((await book(b, 999999)).status).toBe(404);
  });

  it("ອະນຸມັດ: staff ອະນຸມັດໄດ້ 1 ເທື່ອ, ນັກສຶກສາອະນຸມັດເອງບໍ່ໄດ້, ນັກສຶກສາໄດ້ຮັບແຈ້ງການ", async () => {
    const admin = await makeUser("admin");
    const staff = await makeUser("staff");
    const { roomId } = await makeRoom(admin);
    const s = await makeUser("student");
    const bk = (await book(s, roomId)).body.data;
    expect(bk.status).toBe("pending");

    expect((await api().patch(`/api/bookings/${bk.id}/approve`).set(auth(s))).status).toBe(403);
    const ok = await api().patch(`/api/bookings/${bk.id}/approve`).set(auth(staff));
    expect(ok.status).toBe(200);
    expect(ok.body.data.status).toBe("active");
    expect((await api().patch(`/api/bookings/${bk.id}/approve`).set(auth(staff))).status).toBe(409);

    await new Promise((r) => setTimeout(r, 200));
    const n = await api().get("/api/notifications").set(auth(s));
    expect(n.body.data.some((x: any) => x.title.includes("ອະນຸມັດ"))).toBe(true);
  });

  it("ຍົກເລີກ: ນັກສຶກສາຍົກເລີກ pending ຂອງຕົນໄດ້ (ຫ້ອງວ່າງຄືນ), ຍົກເລີກ active ເອງບໍ່ໄດ້, staff ຍົກເລີກ active ໄດ້", async () => {
    const admin = await makeUser("admin");
    const staff = await makeUser("staff");
    const { roomId } = await makeRoom(admin, { capacity: 1 });
    const a = await makeUser("student");
    const b = await makeUser("student");

    const bk = (await book(a, roomId)).body.data;
    expect((await room(admin, roomId)).status).toBe("occupied");
    expect((await api().patch(`/api/bookings/${bk.id}/cancel`).set(auth(b))).status).toBe(403); // ຂອງຄົນອື່ນ
    const c = await api().patch(`/api/bookings/${bk.id}/cancel`).set(auth(a));
    expect(c.status).toBe(200);
    expect(c.body.data.status).toBe("cancelled");
    const after = await room(admin, roomId);
    expect(after.occupants).toBe(0);
    expect(after.status).toBe("available");
    expect((await api().patch(`/api/bookings/${bk.id}/cancel`).set(auth(a))).status).toBe(409); // ຍົກເລີກແລ້ວ

    // ຈອງໃໝ່ → staff approve → ນັກສຶກສາຍົກເລີກເອງບໍ່ໄດ້ ແຕ່ staff ໄດ້
    const bk2 = (await book(b, roomId)).body.data;
    await api().patch(`/api/bookings/${bk2.id}/approve`).set(auth(staff));
    expect((await api().patch(`/api/bookings/${bk2.id}/cancel`).set(auth(b))).status).toBe(409);
    expect((await api().patch(`/api/bookings/${bk2.id}/cancel`).set(auth(staff))).status).toBe(200);
    expect((await room(admin, roomId)).occupants).toBe(0);
  });

  it("check-out (staff) ປົດຫ້ອງ, ແລະ admin ແກ້/ລຶບການຈອງແລ້ວຫ້ອງຍັງສອດຄ່ອງ", async () => {
    const admin = await makeUser("admin");
    const staff = await makeUser("staff");
    const { roomId } = await makeRoom(admin, { capacity: 2 });
    const a = await makeUser("student");
    const b = await makeUser("student");
    const c = await makeUser("student");

    const bkA = (await book(a, roomId)).body.data;
    await api().patch(`/api/bookings/${bkA.id}/approve`).set(auth(staff));
    expect((await api().patch(`/api/bookings/${bkA.id}/checkout`).set(auth(a))).status).toBe(403);
    const co = await api().patch(`/api/bookings/${bkA.id}/checkout`).set(auth(staff));
    expect(co.status).toBe(200);
    expect(co.body.data.check_out_date).toBeTruthy();
    expect((await room(admin, roomId)).occupants).toBe(0);
    const [srow] = await pool.query<any[]>("SELECT room_id FROM students WHERE id = ?", [a.studentId]);
    expect(srow[0].room_id).toBeNull();

    // admin ຕັ້ງ cancelled ຜ່ານ PUT → ປົດຫ້ອງ; ເປີດກັບມາບໍ່ໄດ້
    const bkB = (await book(b, roomId)).body.data;
    expect((await room(admin, roomId)).occupants).toBe(1);
    expect((await api().put(`/api/bookings/${bkB.id}`).set(auth(admin)).send({ status: "cancelled" })).status).toBe(200);
    expect((await room(admin, roomId)).occupants).toBe(0);
    expect((await api().put(`/api/bookings/${bkB.id}`).set(auth(admin)).send({ status: "active" })).status).toBe(409);

    // ລຶບການຈອງທີ່ຍັງ pending → ປົດຫ້ອງ
    const bkC = (await book(c, roomId)).body.data;
    expect((await room(admin, roomId)).occupants).toBe(1);
    expect((await api().delete(`/api/bookings/${bkC.id}`).set(auth(admin))).status).toBe(200);
    expect((await room(admin, roomId)).occupants).toBe(0);
  });

  it("admin ຍ້າຍຫ້ອງຂອງການຈອງ: ກວດຄວາມຈຸຫ້ອງໃໝ່ ແລະຍ້າຍນັກສຶກສາໄປນຳ; ປ່ຽນນັກສຶກສາບໍ່ໄດ້", async () => {
    const admin = await makeUser("admin");
    const r1 = await makeRoom(admin, { capacity: 2 });
    const r2 = await makeRoom(admin, { capacity: 1 });
    const a = await makeUser("student");
    const b = await makeUser("student");
    const other = await makeUser("student");

    const bk = (await book(a, r1.roomId)).body.data;
    await book(b, r2.roomId); // r2 ເຕັມ
    expect((await api().put(`/api/bookings/${bk.id}`).set(auth(admin)).send({ roomId: r2.roomId })).status).toBe(409);
    expect((await api().put(`/api/bookings/${bk.id}`).set(auth(admin)).send({ studentId: other.studentId })).status).toBe(409);

    const r3 = await makeRoom(admin, { capacity: 2 });
    expect((await api().put(`/api/bookings/${bk.id}`).set(auth(admin)).send({ roomId: r3.roomId })).status).toBe(200);
    const [srow] = await pool.query<any[]>("SELECT room_id FROM students WHERE id = ?", [a.studentId]);
    expect(srow[0].room_id).toBe(r3.roomId);
    expect((await room(admin, r1.roomId)).occupants).toBe(0);
    expect((await room(admin, r3.roomId)).occupants).toBe(1);
  });

  it("ນັກສຶກສາເຫັນສະເພາະການຈອງຂອງຕົນ; ລາຍການແບ່ງໜ້າ", async () => {
    const admin = await makeUser("admin");
    const { roomId } = await makeRoom(admin, { capacity: 4 });
    const a = await makeUser("student");
    const b = await makeUser("student");
    await book(a, roomId);
    await book(b, roomId);

    const mine = await api().get("/api/bookings").set(auth(a));
    expect(mine.body.total).toBe(1);
    expect(mine.body.data[0].student_id).toBe(a.studentId);

    const page = await api().get("/api/bookings?limit=1&page=2").set(auth(admin));
    expect(page.status).toBe(200);
    expect(page.body.data).toHaveLength(1);
    expect(page.body.page).toBe(2);
    expect(page.body.limit).toBe(1);
    expect(page.body.totalPages).toBe(page.body.total);
    expect((await api().get("/api/bookings?page=0").set(auth(admin))).status).toBe(400);
    expect((await api().get("/api/bookings?limit=abc").set(auth(admin))).status).toBe(400);
  });
});
