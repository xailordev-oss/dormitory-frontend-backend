import { describe, it, expect, afterAll } from "vitest";
import pool from "../src/config/db";
import { api, auth, makeUser, makeRoom } from "./helpers";

afterAll(async () => {
  await pool.end();
});

const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms));

describe("ໃບແຈ້ງໜີ້ / ໃບຮັບເງິນ", () => {
  it("ອອກບິນ → ເກີນກຳນົດ → ຮັບຊຳລະ (ໄດ້ໃບຮັບເງິນ) → ຄືນເງິນ (ສະເພາະ admin)", async () => {
    const admin = await makeUser("admin");
    const staff = await makeUser("staff");
    const s = await makeUser("student");
    const other = await makeUser("student");

    const created = await api().post("/api/payments").set(auth(staff)).send({
      studentId: s.studentId, amount: 500000, method: "cash", type: "rent",
      billingMonth: "2026-01", dueDate: "2026-01-05", description: "ຄ່າເຊົ່າ ມ.ກ.",
    });
    expect(created.status).toBe(201);
    const p = created.body.data;
    expect(p.invoice_no).toMatch(/^INV-\d{6}-\d{6}$/);
    expect(p.receipt_no).toBeNull();
    expect(p.status).toBe("pending");
    expect(p.is_overdue).toBeTruthy();

    // ອອກບິນເດືອນ/ປະເພດດຽວກັນຊ້ຳບໍ່ໄດ້
    const dup = await api().post("/api/payments").set(auth(admin)).send({
      studentId: s.studentId, amount: 1, method: "cash", type: "rent", billingMonth: "2026-01",
    });
    expect(dup.status).toBe(409);
    // ສ້າງໃໝ່ດ້ວຍ status refunded/failed ບໍ່ໄດ້
    expect((await api().post("/api/payments").set(auth(admin)).send({ studentId: s.studentId, amount: 1, method: "cash", status: "refunded" })).status).toBe(400);
    expect((await api().post("/api/payments").set(auth(admin)).send({ studentId: s.studentId, amount: -5, method: "cash" })).status).toBe(400);
    expect((await api().post("/api/payments").set(auth(admin)).send({ studentId: s.studentId, amount: 5, method: "bitcoin" })).status).toBe(400);
    expect((await api().post("/api/payments").set(auth(s)).send({ studentId: s.studentId, amount: 5, method: "cash" })).status).toBe(403);

    // ນັກສຶກສາເຫັນຂອງຕົນ + ຍອດເກີນກຳນົດ; ຂອງຄົນອື່ນບໍ່ໄດ້
    const mine = await api().get(`/api/payments/student/${s.studentId}`).set(auth(s));
    expect(mine.status).toBe(200);
    expect(mine.body.totalPending).toBe(500000);
    expect(mine.body.totalOverdue).toBe(500000);
    expect(mine.body.totalPaid).toBe(0);
    expect((await api().get(`/api/payments/student/${s.studentId}`).set(auth(other))).status).toBe(403);
    expect((await api().get(`/api/payments/${p.id}`).set(auth(other))).status).toBe(403);
    expect((await api().get(`/api/payments/${p.id}/invoice`).set(auth(s))).status).toBe(200);
    expect((await api().get(`/api/payments/${p.id}/receipt`).set(auth(s))).status).toBe(409); // ຍັງບໍ່ຈ່າຍ

    const overdue = await api().get(`/api/payments?overdue=true&studentId=${s.studentId}`).set(auth(admin));
    expect(overdue.body.total).toBe(1);
    expect(overdue.body.summary.totalOverdue).toBe(500000);

    // ຮັບຊຳລະ
    const paid = await api().put(`/api/payments/${p.id}/status`).set(auth(staff)).send({ status: "paid", method: "bank_transfer" });
    expect(paid.status).toBe(200);
    expect(paid.body.data.receipt_no).toMatch(/^RC-\d{6}-\d{6}$/);
    expect(paid.body.data.paid_at).toBeTruthy();
    expect(paid.body.data.method).toBe("bank_transfer");
    expect(Boolean(paid.body.data.is_overdue)).toBe(false);

    const receipt = await api().get(`/api/payments/${p.id}/receipt`).set(auth(s));
    expect(receipt.status).toBe(200);
    expect(receipt.body.data.documentNo).toBe(paid.body.data.receipt_no);
    expect(receipt.body.data.amount).toBe(500000);
    expect(receipt.body.data.student.id).toBe(s.studentId);

    await wait();
    const notes = await api().get("/api/notifications").set(auth(s));
    expect(notes.body.data.some((n: any) => n.type === "payment" && n.title.includes("ຮັບຊຳລະ"))).toBe(true);

    // ຄືນເງິນ: staff ບໍ່ໄດ້, admin ໄດ້; ຫຼັງຄືນເງິນປ່ຽນຕໍ່ບໍ່ໄດ້
    expect((await api().put(`/api/payments/${p.id}/status`).set(auth(staff)).send({ status: "refunded" })).status).toBe(403);
    expect((await api().put(`/api/payments/${p.id}/status`).set(auth(admin)).send({ status: "refunded" })).status).toBe(200);
    expect((await api().put(`/api/payments/${p.id}/status`).set(auth(admin)).send({ status: "pending" })).status).toBe(409);
    // ຈ່າຍແລ້ວກັບໄປ pending ບໍ່ໄດ້
    const p2 = (await api().post("/api/payments").set(auth(admin)).send({ studentId: s.studentId, amount: 10, method: "cash", status: "paid" })).body.data;
    expect(p2.receipt_no).toBeTruthy();
    expect((await api().put(`/api/payments/${p2.id}/status`).set(auth(admin)).send({ status: "pending" })).status).toBe(409);
  });

  it("ອອກບິນລາຍເດືອນ: dry-run, ອອກຈິງ, ແລ່ນຊ້ຳບໍ່ອອກຊ້ຳ, ແບ່ງຄ່າຫ້ອງຕາມຈຳນວນຄົນ", async () => {
    const admin = await makeUser("admin");
    const staff = await makeUser("staff");
    const { roomId } = await makeRoom(admin, { capacity: 2, price: 800000 });
    const a = await makeUser("student");
    const b = await makeUser("student");
    const nobody = await makeUser("student"); // ບໍ່ມີຫ້ອງ → ບໍ່ຖືກອອກບິນ
    for (const s of [a, b]) {
      await api().post("/api/bookings").set(auth(s)).send({ roomId, checkInDate: "2026-10-01" });
    }

    expect((await api().post("/api/payments/generate-monthly").set(auth(admin)).send({ month: "2031-13" })).status).toBe(400);
    expect((await api().post("/api/payments/generate-monthly").set(auth(admin)).send({ month: "2031-03", dueDay: 40 })).status).toBe(400);

    const dry = await api().post("/api/payments/generate-monthly").set(auth(admin)).send({ month: "2031-03", dryRun: true });
    expect(dry.status).toBe(200);
    const ids = dry.body.data.map((x: any) => x.studentId);
    expect(ids).toContain(a.studentId);
    expect(ids).toContain(b.studentId);
    expect(ids).not.toContain(nobody.studentId);
    const [cnt] = await pool.query<any[]>("SELECT COUNT(*) n FROM payments WHERE billing_month = '2031-03'");
    expect(cnt[0].n).toBe(0); // dry-run ບໍ່ບັນທຶກ

    const real = await api().post("/api/payments/generate-monthly").set(auth(admin)).send({ month: "2031-03", dueDay: 10 });
    expect(real.status).toBe(201);
    expect(real.body.dueDate).toBe("2031-03-10");
    const mine = await api().get(`/api/payments/student/${a.studentId}`).set(auth(a));
    expect(mine.body.data).toHaveLength(1);
    expect(Number(mine.body.data[0].amount)).toBe(800000);
    expect(mine.body.data[0].billing_month).toBe("2031-03");
    expect(mine.body.data[0].due_date).toBe("2031-03-10");
    expect(mine.body.data[0].invoice_no).toBeTruthy();

    const again = await api().post("/api/payments/generate-monthly").set(auth(admin)).send({ month: "2031-03" });
    expect(again.body.created).toBe(0);
    expect(again.body.skipped).toBeGreaterThanOrEqual(2);

    await wait(400);
    const n = await api().get("/api/notifications").set(auth(a));
    expect(n.body.data.some((x: any) => x.type === "payment" && x.title.includes("2031-03"))).toBe(true);

    const split = await api().post("/api/payments/generate-monthly").set(auth(admin)).send({ month: "2031-04", splitRoom: true });
    expect(split.status).toBe(201);
    const row = split.body.data.find((x: any) => x.studentId === a.studentId);
    expect(row.amount).toBe(400000); // 800000 / 2 ຄົນ

    expect((await api().post("/api/payments/generate-monthly").set(auth(staff)).send({ month: "2031-05" })).status).toBe(403);
  });

  it("ສົ່ງແຈ້ງເຕືອນຄົນທີ່ເກີນກຳນົດ", async () => {
    const admin = await makeUser("admin");
    const s = await makeUser("student");
    await api().post("/api/payments").set(auth(admin)).send({
      studentId: s.studentId, amount: 1000, method: "cash", dueDate: "2020-01-01", description: "old",
    });
    const r = await api().post("/api/payments/send-reminders").set(auth(admin));
    expect(r.status).toBe(200);
    expect(r.body.students).toBeGreaterThanOrEqual(1);
    await wait(300);
    const n = await api().get("/api/notifications?type=warning").set(auth(s));
    expect(n.body.data.some((x: any) => x.title.includes("ຄ້າງຊຳລະ"))).toBe(true);
  });
});
