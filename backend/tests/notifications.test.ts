import { describe, it, expect, afterAll } from "vitest";
import pool from "../src/config/db";
import { api, auth, makeUser, uniq } from "./helpers";

afterAll(async () => {
  await pool.end();
});

describe("ແຈ້ງການ", () => {
  it("ແຈ້ງລວມ: ອ່ານແລ້ວແຍກຕາມນັກສຶກສາ (ຄົນໜຶ່ງອ່ານ ບໍ່ກະທົບຄົນອື່ນ)", async () => {
    const staff = await makeUser("staff");
    const a = await makeUser("student");
    const b = await makeUser("student");
    const title = uniq("ປະກາດ");

    const c = await api().post("/api/notifications").set(auth(staff)).send({ title, message: "ປິດນ້ຳວັນອາທິດ", type: "warning" });
    expect(c.status).toBe(201);
    const id = c.body.data.id;

    const before = await api().get("/api/notifications").set(auth(a));
    expect(before.body.unread).toBeGreaterThanOrEqual(1);
    const unreadA = before.body.unread;

    expect((await api().patch(`/api/notifications/${id}/read`).set(auth(a))).status).toBe(200);

    const aList = await api().get("/api/notifications").set(auth(a));
    const bList = await api().get("/api/notifications").set(auth(b));
    expect(aList.body.data.find((n: any) => n.id === id).is_read).toBeTruthy();
    expect(bList.body.data.find((n: any) => n.id === id).is_read).toBeFalsy();
    expect(aList.body.unread).toBe(unreadA - 1);

    const unreadOnly = await api().get("/api/notifications?isRead=false").set(auth(b));
    expect(unreadOnly.body.data.some((n: any) => n.id === id)).toBe(true);
    const readOnly = await api().get("/api/notifications?isRead=true").set(auth(a));
    expect(readOnly.body.data.some((n: any) => n.id === id)).toBe(true);
  });

  it("ແຈ້ງສ່ວນຕົວ: ຄົນອື່ນບໍ່ເຫັນ ແລະ ໝາຍອ່ານບໍ່ໄດ້", async () => {
    const admin = await makeUser("admin");
    const a = await makeUser("student");
    const b = await makeUser("student");
    const c = await api().post("/api/notifications").set(auth(admin)).send({ title: uniq("ສ່ວນຕົວ"), message: "ສະເພາະ a", studentId: a.studentId });
    const id = c.body.data.id;

    expect((await api().get("/api/notifications").set(auth(a))).body.data.some((n: any) => n.id === id)).toBe(true);
    expect((await api().get("/api/notifications").set(auth(b))).body.data.some((n: any) => n.id === id)).toBe(false);
    expect((await api().patch(`/api/notifications/${id}/read`).set(auth(b))).status).toBe(403);
    expect((await api().patch(`/api/notifications/${id}/read`).set(auth(a))).status).toBe(200);
  });

  it("read-all, ສິດສ້າງ/ລຶບ, ແລະ ກວດຂໍ້ມູນ", async () => {
    const admin = await makeUser("admin");
    const staff = await makeUser("staff");
    const a = await makeUser("student");
    await api().post("/api/notifications").set(auth(admin)).send({ title: "1", message: "x", studentId: a.studentId });
    await api().post("/api/notifications").set(auth(admin)).send({ title: "2", message: "y" });

    expect((await api().get("/api/notifications").set(auth(a))).body.unread).toBeGreaterThanOrEqual(2);
    expect((await api().patch("/api/notifications/read-all").set(auth(a))).status).toBe(200);
    expect((await api().get("/api/notifications").set(auth(a))).body.unread).toBe(0);

    expect((await api().post("/api/notifications").set(auth(a)).send({ title: "h", message: "h" })).status).toBe(403);
    expect((await api().post("/api/notifications").set(auth(staff)).send({ title: "", message: "h" })).status).toBe(400);
    expect((await api().post("/api/notifications").set(auth(staff)).send({ title: "h", message: "h", studentId: 999999 })).status).toBe(404);
    const c = await api().post("/api/notifications").set(auth(staff)).send({ title: "h", message: "h" });
    expect((await api().delete(`/api/notifications/${c.body.data.id}`).set(auth(staff))).status).toBe(403);
    expect((await api().delete(`/api/notifications/${c.body.data.id}`).set(auth(admin))).status).toBe(200);
  });
});
