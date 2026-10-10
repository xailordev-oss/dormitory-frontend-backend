import { describe, it, expect, afterAll } from "vitest";
import pool from "../src/config/db";
import { api, auth, makeUser, makeRoom, uniq } from "./helpers";

afterAll(async () => {
  await pool.end();
});

describe("ສິດຕາມ role: admin / staff / student", () => {
  it("ຕາຕະລາງສິດ", async () => {
    const admin = await makeUser("admin");
    const staff = await makeUser("staff");
    const student = await makeUser("student");
    const { roomId, buildingId } = await makeRoom(admin);

    // ນັກສຶກສາ: ເບິ່ງຫ້ອງໄດ້ ແຕ່ຈັດການຫຍັງບໍ່ໄດ້
    expect((await api().get("/api/rooms").set(auth(student))).status).toBe(200);
    expect((await api().get("/api/students").set(auth(student))).status).toBe(403);
    expect((await api().get("/api/visitors/logs").set(auth(student))).status).toBe(403);
    expect((await api().get("/api/payments").set(auth(student))).status).toBe(403);
    expect((await api().get("/api/reports/dashboard").set(auth(student))).status).toBe(403);
    expect((await api().get("/api/users").set(auth(student))).status).toBe(403);
    expect((await api().post("/api/rooms").set(auth(student)).send({})).status).toBe(403);

    // staff: ເບິ່ງນັກສຶກສາ, ຜູ້ມາຢ້ຽມ, ຊຳລະ, dashboard ໄດ້
    expect((await api().get("/api/students").set(auth(staff))).status).toBe(200);
    expect((await api().get("/api/visitors/logs").set(auth(staff))).status).toBe(200);
    expect((await api().get("/api/payments").set(auth(staff))).status).toBe(200);
    expect((await api().get("/api/reports/dashboard").set(auth(staff))).status).toBe(200);
    // staff: ແຕ່ບໍ່ໄດ້ສິດ admin
    expect((await api().post("/api/rooms").set(auth(staff)).send({ roomNumber: "X", buildingId, price: 1 })).status).toBe(403);
    expect((await api().delete(`/api/rooms/${roomId}`).set(auth(staff))).status).toBe(403);
    expect((await api().post("/api/students").set(auth(staff)).send({ name: "x", email: "x@x.la" })).status).toBe(403);
    expect((await api().get("/api/users").set(auth(staff))).status).toBe(403);
    expect((await api().get("/api/audit-logs").set(auth(staff))).status).toBe(403);
    expect((await api().get("/api/reports/revenue").set(auth(staff))).status).toBe(403);
    expect((await api().post("/api/payments/generate-monthly").set(auth(staff)).send({ month: "2030-01" })).status).toBe(403);

    // admin: ທຸກຢ່າງ
    expect((await api().get("/api/users").set(auth(admin))).status).toBe(200);
    expect((await api().get("/api/audit-logs").set(auth(admin))).status).toBe(200);
    expect((await api().get("/api/reports/revenue").set(auth(admin))).status).toBe(200);
    expect((await api().get("/api/reports/occupancy").set(auth(admin))).status).toBe(200);
  });

  it("ບໍ່ມີ token → 401 ທຸກ endpoint ທີ່ປ້ອງກັນ", async () => {
    for (const path of ["/api/rooms", "/api/students", "/api/payments", "/api/notifications", "/api/reports/dashboard"]) {
      expect((await api().get(path)).status).toBe(401);
    }
  });

  it("ການກະທຳຂອງ staff ຖືກບັນທຶກໃນ audit log ພ້ອມ role", async () => {
    const staff = await makeUser("staff");
    const admin = await makeUser("admin");
    const res = await api().post("/api/visitors/check-in").set(auth(staff)).send({ visitorName: uniq("V"), idCardNumber: uniq("ID") });
    expect(res.status).toBe(201);
    await new Promise((r) => setTimeout(r, 200)); // audit ບັນທຶກຫຼັງ response
    const logs = await api().get(`/api/audit-logs?adminId=${staff.id}`).set(auth(admin));
    expect(logs.status).toBe(200);
    expect(logs.body.data.length).toBeGreaterThan(0);
    expect(logs.body.data[0].role).toBe("staff");
    expect(logs.body.data[0].path).toBe("/api/visitors/check-in");
  });

  it("audit log ບໍ່ບັນທຶກ query string (ອາດມີ token) ແລະ ບໍ່ບັນທຶກການກະທຳຂອງນັກສຶກສາ", async () => {
    const student = await makeUser("student");
    const admin = await makeUser("admin");
    await api().patch("/api/notifications/read-all?secret=abc").set(auth(student));
    await new Promise((r) => setTimeout(r, 200));
    const logs = await api().get(`/api/audit-logs?adminId=${student.id}`).set(auth(admin));
    expect(logs.body.total).toBe(0);
  });
});

describe("ກົດກັນລະບົບພັງ", () => {
  it("admin ຫຼຸດ/ປິດ/ລຶບຕົນເອງບໍ່ໄດ້", async () => {
    const admin = await makeUser("admin");
    expect((await api().patch(`/api/users/${admin.id}/role`).set(auth(admin)).send({ role: "student" })).status).toBe(400);
    expect((await api().patch(`/api/users/${admin.id}/status`).set(auth(admin)).send({ isActive: false })).status).toBe(400);
    expect((await api().delete(`/api/users/${admin.id}`).set(auth(admin))).status).toBe(400);
  });
});
