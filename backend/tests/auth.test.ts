import { describe, it, expect, afterAll } from "vitest";
import pool from "../src/config/db";
import { api, auth, makeUser, uniq, PASSWORD } from "./helpers";

afterAll(async () => {
  await pool.end();
});

describe("ສະໝັກ / ເຂົ້າສູ່ລະບົບ", () => {
  it("ສະໝັກແລ້ວໄດ້ role student ແລະ ມີຂໍ້ມູນນັກສຶກສາຜູກໃຫ້ອັດຕະໂນມັດ", async () => {
    const name = uniq("reg");
    const res = await api()
      .post("/api/auth/register")
      .send({ name, email: `${name}@test.la`, password: PASSWORD, phone: "02055551234" });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("student");
    expect(res.body.user.studentId).toBeGreaterThan(0);
    expect(res.body.needsLinking).toBe(false);

    const [rows] = await pool.query<any[]>("SELECT * FROM students WHERE user_id = ?", [res.body.user.id]);
    expect(rows).toHaveLength(1);
    expect(rows[0].phone).toBe("02055551234");
  });

  it("ບໍ່ຮັບ role ຈາກ client (ສົ່ງ admin ມາກໍຍັງເປັນ student)", async () => {
    const name = uniq("sneaky");
    const res = await api()
      .post("/api/auth/register")
      .send({ name, email: `${name}@test.la`, password: PASSWORD, role: "admin" });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("student");
  });

  it("ກວດຂໍ້ມູນ: ອີເມວຜິດ, ລະຫັດສັ້ນ, ອີເມວຊ້ຳ", async () => {
    expect((await api().post("/api/auth/register").send({ name: "x", email: "bad", password: PASSWORD })).status).toBe(400);
    expect((await api().post("/api/auth/register").send({ name: "x", email: "a@b.co", password: "123" })).status).toBe(400);
    const name = uniq("dup");
    const body = { name, email: `${name}@test.la`, password: PASSWORD };
    expect((await api().post("/api/auth/register").send(body)).status).toBe(201);
    expect((await api().post("/api/auth/register").send({ ...body, email: body.email.toUpperCase() })).status).toBe(409);
  });

  it("ອີເມວທີ່ admin ສ້າງນັກສຶກສາໄວ້ກ່ອນ → ບໍ່ຜູກໃຫ້ອັດຕະໂນມັດ (ກັນສະໝັກແທນ) ແລະ admin ຜູກເອງໄດ້", async () => {
    const admin = await makeUser("admin");
    const name = uniq("pre");
    const email = `${name}@test.la`;
    const stu = await api().post("/api/students").set(auth(admin)).send({ name, email });
    expect(stu.status).toBe(201);

    const reg = await api().post("/api/auth/register").send({ name, email, password: PASSWORD });
    expect(reg.status).toBe(201);
    expect(reg.body.needsLinking).toBe(true);
    expect(reg.body.user.studentId).toBeNull();

    const login = await api().post("/api/auth/login").send({ email, password: PASSWORD });
    const token = login.body.accessToken;
    // ຍັງຈອງ/ແຈ້ງບໍ່ໄດ້ ຈົນກວ່າ admin ຈະຜູກ
    const blocked = await api().post("/api/maintenance").set({ Authorization: `Bearer ${token}` }).send({ roomId: 1, issue: "x" });
    expect(blocked.status).toBeGreaterThanOrEqual(400);

    const link = await api().put(`/api/students/${stu.body.data.id}`).set(auth(admin)).send({ userId: reg.body.user.id });
    expect(link.status).toBe(200);
    const me = await api().get("/api/auth/me").set({ Authorization: `Bearer ${token}` });
    expect(me.body.data.student_id).toBe(stu.body.data.id);
  });

  it("login ຖືກ/ຜິດ ແລະ /me", async () => {
    const u = await makeUser("student");
    const bad = await api().post("/api/auth/login").send({ email: u.email, password: "wrongpass" });
    expect(bad.status).toBe(401);
    const none = await api().post("/api/auth/login").send({ email: "nobody@test.la", password: PASSWORD });
    expect(none.status).toBe(401);
    expect(none.body.message).toBe(bad.body.message); // ບໍ່ບອກວ່າອີເມວມີຫຼືບໍ່

    const me = await api().get("/api/auth/me").set(auth(u));
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe(u.email);
    expect(me.body.data.password).toBeUndefined();

    expect((await api().get("/api/auth/me")).status).toBe(401);
    expect((await api().get("/api/auth/me").set({ Authorization: "Bearer garbage" })).body.code).toBe("TOKEN_INVALID");
  });

  it("refresh-token ແລະ logout (token ຖືກຖອນ)", async () => {
    const u = await makeUser("student");
    const r = await api().post("/api/auth/refresh-token").send({ refreshToken: u.refreshToken });
    expect(r.status).toBe(200);
    expect(r.body.accessToken).toBeTruthy();

    expect((await api().post("/api/auth/logout").send({ refreshToken: u.refreshToken })).status).toBe(200);
    const again = await api().post("/api/auth/refresh-token").send({ refreshToken: u.refreshToken });
    expect(again.status).toBe(403);
  });

  it("ບັນຊີທີ່ຖືກປິດ ໃຊ້ token ເກົ່າບໍ່ໄດ້ທັນທີ", async () => {
    const admin = await makeUser("admin");
    const u = await makeUser("student");
    expect((await api().get("/api/auth/me").set(auth(u))).status).toBe(200);

    const off = await api().patch(`/api/users/${u.id}/status`).set(auth(admin)).send({ isActive: false });
    expect(off.status).toBe(200);
    const res = await api().get("/api/auth/me").set(auth(u));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("ACCOUNT_DISABLED");
    expect((await api().post("/api/auth/login").send({ email: u.email, password: PASSWORD })).status).toBe(403);
  });

  it("ປ່ຽນ role ມີຜົນທັນທີ (ບໍ່ຕ້ອງລໍ token ໝົດອາຍຸ)", async () => {
    const admin = await makeUser("admin");
    const u = await makeUser("student");
    expect((await api().get("/api/students").set(auth(u))).status).toBe(403);
    await api().patch(`/api/users/${u.id}/role`).set(auth(admin)).send({ role: "staff" });
    expect((await api().get("/api/students").set(auth(u))).status).toBe(200);
  });
});

describe("ລະຫັດຜ່ານ", () => {
  it("change-password: ລະຫັດເກົ່າຜິດ → 400, ຖືກ → ໃຊ້ລະຫັດໃໝ່ໄດ້ ແລະ refresh token ເກົ່າຖືກຖອນ", async () => {
    const u = await makeUser("student");
    const wrong = await api().put("/api/auth/change-password").set(auth(u)).send({ currentPassword: "nope", newPassword: "newpass99" });
    expect(wrong.status).toBe(400);
    const short = await api().put("/api/auth/change-password").set(auth(u)).send({ currentPassword: PASSWORD, newPassword: "123" });
    expect(short.status).toBe(400);
    const same = await api().put("/api/auth/change-password").set(auth(u)).send({ currentPassword: PASSWORD, newPassword: PASSWORD });
    expect(same.status).toBe(400);

    const ok = await api().put("/api/auth/change-password").set(auth(u)).send({ currentPassword: PASSWORD, newPassword: "newpass99" });
    expect(ok.status).toBe(200);

    expect((await api().post("/api/auth/refresh-token").send({ refreshToken: u.refreshToken })).status).toBe(403);
    expect((await api().post("/api/auth/login").send({ email: u.email, password: PASSWORD })).status).toBe(401);
    expect((await api().post("/api/auth/login").send({ email: u.email, password: "newpass99" })).status).toBe(200);
  });

  it("forgot-password → reset-password (token ໃຊ້ໄດ້ເທື່ອດຽວ, ບໍ່ບອກວ່າອີເມວມີຫຼືບໍ່)", async () => {
    const u = await makeUser("student");

    const unknown = await api().post("/api/auth/forgot-password").send({ email: "ghost@test.la" });
    const known = await api().post("/api/auth/forgot-password").send({ email: u.email });
    expect(unknown.status).toBe(200);
    expect(known.status).toBe(200);
    expect(unknown.body.message).toBe(known.body.message);
    expect(unknown.body.resetToken).toBeUndefined();
    const token = known.body.resetToken; // ສົ່ງກັບມາສະເພາະ dev/test ທີ່ບໍ່ມີ SMTP
    expect(token).toMatch(/^[a-f0-9]{64}$/);

    // ໃນ DB ເກັບແຕ່ hash ບໍ່ແມ່ນ token ຈິງ
    const [rows] = await pool.query<any[]>("SELECT token_hash FROM password_resets WHERE user_id = ?", [u.id]);
    expect(rows[0].token_hash).not.toBe(token);

    expect((await api().post("/api/auth/reset-password").send({ token: "abc", newPassword: "resetpass1" })).status).toBe(400);
    expect((await api().post("/api/auth/reset-password").send({ token, newPassword: "123" })).status).toBe(400);

    const ok = await api().post("/api/auth/reset-password").send({ token, newPassword: "resetpass1" });
    expect(ok.status).toBe(200);
    expect((await api().post("/api/auth/login").send({ email: u.email, password: "resetpass1" })).status).toBe(200);
    // ໃຊ້ຊ້ຳບໍ່ໄດ້
    expect((await api().post("/api/auth/reset-password").send({ token, newPassword: "another123" })).status).toBe(400);
  });

  it("token reset ທີ່ໝົດອາຍຸໃຊ້ບໍ່ໄດ້", async () => {
    const u = await makeUser("student");
    const res = await api().post("/api/auth/forgot-password").send({ email: u.email });
    await pool.query("UPDATE password_resets SET expires_at = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE user_id = ?", [u.id]);
    const r = await api().post("/api/auth/reset-password").send({ token: res.body.resetToken, newPassword: "resetpass1" });
    expect(r.status).toBe(400);
  });

  it("admin ຕັ້ງລະຫັດຜ່ານໃຫ້ຜູ້ໃຊ້ໄດ້ ແລະ ສ້າງບັນຊີ staff ໃຫ້ໄດ້", async () => {
    const admin = await makeUser("admin");
    const u = await makeUser("student");
    const r = await api().patch(`/api/users/${u.id}/password`).set(auth(admin)).send({ newPassword: "adminset99" });
    expect(r.status).toBe(200);
    expect((await api().post("/api/auth/login").send({ email: u.email, password: "adminset99" })).status).toBe(200);
    expect((await api().patch(`/api/users/${u.id}/password`).set(auth(u)).send({ newPassword: "hackhack99" })).status).toBe(403);

    const email = `${uniq("newstaff")}@test.la`;
    const created = await api().post("/api/users").set(auth(admin)).send({ name: "Desk", email, password: PASSWORD, role: "staff" });
    expect(created.status).toBe(201);
    expect(created.body.data.role).toBe("staff");
    expect((await api().post("/api/auth/login").send({ email, password: PASSWORD })).status).toBe(200);
  });
});
