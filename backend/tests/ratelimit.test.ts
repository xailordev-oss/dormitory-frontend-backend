import { describe, it, expect, vi, afterAll } from "vitest";
import request from "supertest";

afterAll(async () => {
  const { default: pool } = await import("../src/config/db");
  await pool.end();
});

describe("rate limit", () => {
  it("login ລົ້ມເຫຼວເກີນກຳນົດ → 429 (login ສຳເລັດບໍ່ຖືກນັບ)", async () => {
    process.env.RATE_LIMIT_ENABLED = "true";
    process.env.AUTH_RATE_LIMIT_MAX = "3";
    vi.resetModules();
    const { default: app } = await import("../src/app");

    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) {
      const r = await request(app).post("/api/auth/login").send({ email: "nobody@test.la", password: "wrongpass1" });
      statuses.push(r.status);
    }
    expect(statuses.slice(0, 3)).toEqual([401, 401, 401]);
    expect(statuses.slice(3)).toEqual([429, 429]);

    process.env.RATE_LIMIT_ENABLED = "false";
    delete process.env.AUTH_RATE_LIMIT_MAX;
  });
});
