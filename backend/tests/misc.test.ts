import { describe, it, expect, afterAll } from "vitest";
import path from "path";
import pool from "../src/config/db";
import { api, auth, makeUser, makeRoom, uniq } from "./helpers";

afterAll(async () => {
  await pool.end();
});
const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms));

describe("ສ້ອມແປງ ↔ ສະຖານະຫ້ອງ", () => {
  it("in_progress → ຫ້ອງ maintenance (ຈອງບໍ່ໄດ້); resolved → ກັບເປັນ occupied ຖ້າຫ້ອງຍັງເຕັມ (ບັກເກົ່າຕັ້ງເປັນ available)", async () => {
    const admin = await makeUser("admin");
    const staff = await makeUser("staff");
    const { roomId } = await makeRoom(admin, { capacity: 1 });
    const a = await makeUser("student");
    const b = await makeUser("student");
    const outsider = await makeUser("student");
    await api().post("/api/bookings").set(auth(a)).send({ roomId, checkInDate: "2026-10-01" });

    const m = await api().post("/api/maintenance").set(auth(a)).send({ roomId, issue: "ກອກນ້ຳຮົ່ວ", priority: "urgent" });
    expect(m.status).toBe(201);
    expect(m.body.data.reported_by).toBe(a.studentId);
    // ນັກສຶກສາແຈ້ງແທນຄົນອື່ນບໍ່ໄດ້
    expect((await api().post("/api/maintenance").set(auth(a)).send({ roomId, issue: "x", reportedBy: b.studentId })).status).toBe(403);

    expect((await api().put(`/api/maintenance/${m.body.data.id}/status`).set(auth(a)).send({ status: "in_progress" })).status).toBe(403);
    expect((await api().put(`/api/maintenance/${m.body.data.id}/status`).set(auth(staff)).send({ status: "in_progress" })).status).toBe(200);
    expect((await api().get(`/api/rooms/${roomId}`).set(auth(admin))).body.data.status).toBe("maintenance");
    expect((await api().post("/api/bookings").set(auth(b)).send({ roomId, checkInDate: "2026-10-01" })).status).toBe(409);

    expect((await api().put(`/api/maintenance/${m.body.data.id}/status`).set(auth(staff)).send({ status: "resolved" })).status).toBe(200);
    expect((await api().get(`/api/rooms/${roomId}`).set(auth(admin))).body.data.status).toBe("occupied");

    await wait();
    const notes = await api().get("/api/notifications?type=maintenance").set(auth(a));
    expect(notes.body.data.length).toBeGreaterThanOrEqual(2);

    // ຄົນນອກຫ້ອງບໍ່ເຫັນລາຍການ; ຄົນໃນຫ້ອງ/ຜູ້ແຈ້ງເຫັນ
    expect((await api().get("/api/maintenance").set(auth(outsider))).body.total).toBe(0);
    expect((await api().get("/api/maintenance").set(auth(a))).body.total).toBe(1);
    expect((await api().get("/api/maintenance?status=resolved").set(auth(staff))).body.data.some((x: any) => x.id === m.body.data.id)).toBe(true);
    expect((await api().delete(`/api/maintenance/${m.body.data.id}`).set(auth(staff))).status).toBe(403);
    expect((await api().delete(`/api/maintenance/${m.body.data.id}`).set(auth(admin))).status).toBe(200);
  });
});

describe("ຜູ້ມາຢ້ຽມ", () => {
  it("check-in / ຊ້ຳ / check-out / ກັ່ນຕອງ (staff)", async () => {
    const staff = await makeUser("staff");
    const idCard = uniq("ID");
    const ci = await api().post("/api/visitors/check-in").set(auth(staff)).send({ visitorName: "ແຂກ", idCardNumber: idCard, purpose: "ຢ້ຽມ" });
    expect(ci.status).toBe(201);
    expect((await api().post("/api/visitors/check-in").set(auth(staff)).send({ visitorName: "ແຂກ", idCardNumber: idCard })).status).toBe(409);
    expect((await api().post("/api/visitors/check-in").set(auth(staff)).send({ idCardNumber: "x" })).status).toBe(400);
    expect((await api().post("/api/visitors/check-out").set(auth(staff)).send({ id: ci.body.data.id })).status).toBe(200);
    expect((await api().post("/api/visitors/check-out").set(auth(staff)).send({ id: ci.body.data.id })).status).toBe(400);
    expect((await api().post("/api/visitors/check-out").set(auth(staff)).send({ id: 999999 })).status).toBe(404);
    const logs = await api().get("/api/visitors/logs?status=checked_out&limit=5").set(auth(staff));
    expect(logs.status).toBe(200);
    expect(logs.body.data.some((v: any) => v.id === ci.body.data.id)).toBe(true);
  });
});

describe("ນັກສຶກສາ / ໂປຣໄຟລ໌ / ຮູບ", () => {
  it("ຄົ້ນຫາ, ກັ່ນ unlinked, ແກ້ໂປຣໄຟລ໌ຕົນເອງ, ອັບໂຫຼດ avatar (ຮັບສະເພາະຮູບ)", async () => {
    const admin = await makeUser("admin");
    const s = await makeUser("student");
    const found = await api().get(`/api/students?search=${encodeURIComponent(s.email.split("@")[0])}`).set(auth(admin));
    expect(found.body.total).toBe(1);

    const manual = uniq("manual");
    await api().post("/api/students").set(auth(admin)).send({ name: manual, email: `${manual}@test.la` });
    const unlinked = await api().get("/api/students?unlinked=true&limit=200").set(auth(admin));
    expect(unlinked.body.data.some((x: any) => x.email === `${manual}@test.la`)).toBe(true);
    expect(unlinked.body.data.every((x: any) => x.user_id === null)).toBe(true);

    const upd = await api().put("/api/students/me/profile").set(auth(s)).send({ name: "ຊື່ໃໝ່", phone: "02099999999" });
    expect(upd.status).toBe(200);
    const prof = await api().get("/api/students/me/profile").set(auth(s));
    expect(prof.body.data.phone).toBe("02099999999");

    const img = path.join(process.cwd(), "sample-images", "avatar.jpg");
    const up = await api().post("/api/students/me/avatar").set(auth(s)).attach("avatar", img);
    expect(up.status).toBeLessThan(300);
    const bad = await api().post("/api/students/me/avatar").set(auth(s)).attach("avatar", Buffer.from("hello"), { filename: "x.txt", contentType: "text/plain" });
    expect(bad.status).toBe(400);
  });

  it("ຫ້ອງ: ລາຍການ + summary + ຫ້ອງຫວ່າງ; dashboard ໃຫ້ຕົວເລກ", async () => {
    const admin = await makeUser("admin");
    const { roomId } = await makeRoom(admin, { capacity: 3 });
    const list = await api().get("/api/rooms?hasVacancy=true&limit=500").set(auth(admin));
    expect(list.body.summary.totalBeds).toBeGreaterThanOrEqual(3);
    expect(list.body.data.some((r: any) => r.id === roomId)).toBe(true);
    const avail = await api().get("/api/rooms/available").set(auth(admin));
    expect(avail.body.data.some((r: any) => r.id === roomId)).toBe(true);
    expect((await api().post("/api/rooms").set(auth(admin)).send({ roomNumber: "Z", buildingId: 1, capacity: 5, price: 1 })).status).toBe(400);

    const dash = await api().get("/api/reports/dashboard").set(auth(admin));
    expect(dash.status).toBe(200);
    for (const k of ["students", "rooms", "bookings", "payments", "maintenance", "visitors"]) {
      expect(dash.body.data[k]).toBeTruthy();
    }
    expect(typeof dash.body.data.rooms.occupancyRate).toBe("number");
  });

  it("health check", async () => {
    const r = await api().get("/health");
    expect(r.status).toBe(200);
    expect(r.body.database).toBe("connected");
    expect((await api().get("/api/nope")).status).toBe(404);
  });
});
