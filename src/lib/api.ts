"use client";

import useSWR, { mutate, type SWRConfiguration } from "swr";

/**
 * ຕົວເອີ້ນ API ກາງ
 * - ແນບ Bearer token ອັດຕະໂນມັດ
 * - ເມື່ອ token ໝົດອາຍຸ (401 TOKEN_EXPIRED) → ຂໍ token ໃໝ່ດ້ວຍ refresh token ແລ້ວຍິງຊ້ຳ 1 ເທື່ອ
 * - ຖ້າ refresh ບໍ່ໄດ້ / ບັນຊີຖືກປິດ → ແຈ້ງ AuthProvider ໃຫ້ logout
 */

const API_PREFIX = "/api";
const KEY_ACCESS = "dorm_access";
const KEY_REFRESH = "dorm_refresh";

/**
 * ບ່ອນເກັບ token
 * - sessionStorage: ແຍກຕາມແຕ່ລະ tab → tab ໜຶ່ງ login admin, ອີກ tab login ນັກສຶກສາ ໄດ້ພ້ອມກັນ
 *   ໂດຍບໍ່ທັບກັນ (ເມື່ອກ່ອນໃຊ້ localStorage ຢ່າງດຽວ: login ໃນ tab ໃໝ່ຈະທັບ token ຂອງ tab ເກົ່າ
 *   ເຮັດໃຫ້ tab ເກົ່າສະແດງເປັນນັກສຶກສາ ແຕ່ສົ່ງ token ຂອງ admin ໄປ)
 * - localStorage: ເກັບບັນຊີທີ່ login ລ່າສຸດ ເພື່ອໃຫ້ tab ໃໝ່ / ເປີດ browser ຄືນ ບໍ່ຕ້ອງ login ໃໝ່
 */
const store = (kind: "session" | "local") => {
  try {
    return typeof window === "undefined" ? null : kind === "session" ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
};
const read = (kind: "session" | "local", key: string) => {
  try {
    return store(kind)?.getItem(key) ?? null;
  } catch {
    return null;
  }
};
const write = (kind: "session" | "local", key: string, value: string | null) => {
  try {
    const s = store(kind);
    if (!s) return;
    if (value === null) s.removeItem(key);
    else s.setItem(key, value);
  } catch {
    /* private mode */
  }
};

/** tab ນີ້ຍັງບໍ່ມີ session → ຮັບ token ຂອງບັນຊີລ່າສຸດມາໃຊ້ (ຄັ້ງດຽວ) */
function tabToken(key: string) {
  const own = read("session", key);
  if (own !== null) return own;
  if (read("session", "dorm_tab_init") === null) {
    write("session", "dorm_tab_init", "1");
    for (const k of [KEY_ACCESS, KEY_REFRESH]) {
      const v = read("local", k);
      if (v) write("session", k, v);
    }
    return read("session", key);
  }
  return null;
}

export const tokens = {
  get access() {
    return tabToken(KEY_ACCESS);
  },
  get refresh() {
    return tabToken(KEY_REFRESH);
  },
  set(access?: string | null, refresh?: string | null) {
    write("session", "dorm_tab_init", "1");
    if (access) {
      write("session", KEY_ACCESS, access);
      write("local", KEY_ACCESS, access);
    }
    if (refresh) {
      write("session", KEY_REFRESH, refresh);
      write("local", KEY_REFRESH, refresh);
    }
  },
  clear() {
    write("session", "dorm_tab_init", "1");
    // ລຶບ "ບັນຊີລ່າສຸດ" ສະເພາະເມື່ອມັນແມ່ນບັນຊີຂອງ tab ນີ້ (ບໍ່ໄປລົບ session ຂອງ tab ອື່ນ)
    if (read("local", KEY_REFRESH) === read("session", KEY_REFRESH)) {
      write("local", KEY_ACCESS, null);
      write("local", KEY_REFRESH, null);
    }
    write("session", KEY_ACCESS, null);
    write("session", KEY_REFRESH, null);
  },
};

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** AuthProvider ລົງທະບຽນ callback ນີ້ ເພື່ອ logout ເມື່ອ session ໃຊ້ບໍ່ໄດ້ແລ້ວ */
let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: (() => void) | null) => {
  onUnauthorized = fn;
};

type Body = Record<string, unknown> | FormData | undefined;

async function rawRequest(method: string, path: string, body?: Body) {
  const headers: Record<string, string> = {};
  const access = tokens.access;
  if (access) headers.Authorization = `Bearer ${access}`;

  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  let res: Response;
  try {
    res = await fetch(API_PREFIX + path, { method, headers, body: payload, cache: "no-store" });
  } catch {
    throw new ApiError("ເຊື່ອມຕໍ່ server ບໍ່ໄດ້ ກະລຸນາກວດວ່າ backend ເປີດຢູ່", 0, "NETWORK_ERROR");
  }

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* response ບໍ່ແມ່ນ JSON */
  }
  return { res, data };
}

let refreshing: Promise<boolean> | null = null;
function refreshAccessToken(): Promise<boolean> {
  if (!refreshing) {
    refreshing = (async () => {
      const refresh = tokens.refresh;
      if (!refresh) return false;
      try {
        const { res, data } = await rawRequest("POST", "/auth/refresh-token", { refreshToken: refresh });
        if (res.ok && data?.accessToken) {
          tokens.set(data.accessToken);
          return true;
        }
      } catch {
        /* ignore */
      }
      return false;
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

export async function request<T = any>(method: string, path: string, body?: Body): Promise<T> {
  let { res, data } = await rawRequest(method, path, body);

  if (res.status === 401 && data?.code === "TOKEN_EXPIRED") {
    if (await refreshAccessToken()) {
      ({ res, data } = await rawRequest(method, path, body));
    }
  }

  if (!res.ok) {
    const err = new ApiError(data?.message || `ເກີດຂໍ້ຜິດພາດ (${res.status})`, res.status, data?.code);
    const isAuthCall = path.startsWith("/auth/login") || path.startsWith("/auth/register");
    if (!isAuthCall && (res.status === 401 || err.code === "ACCOUNT_DISABLED")) {
      onUnauthorized?.();
    }
    throw err;
  }
  return data as T;
}

export const api = {
  get: <T = any>(path: string) => request<T>("GET", path),
  post: <T = any>(path: string, body?: Body) => request<T>("POST", path, body ?? {}),
  put: <T = any>(path: string, body?: Body) => request<T>("PUT", path, body ?? {}),
  patch: <T = any>(path: string, body?: Body) => request<T>("PATCH", path, body ?? {}),
  del: <T = any>(path: string) => request<T>("DELETE", path),
};

/** ສ້າງ query string ໂດຍຕັດຄ່າວ່າງອອກ */
export function qs(params: Record<string, unknown>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "" || v === false) continue;
    p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** ຕັດ field ວ່າງອອກກ່ອນສົ່ງໄປ API */
export function clean<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== "" && v !== undefined && v !== null)
  ) as Partial<T>;
}

/** ດຶງຂໍ້ມູນດ້ວຍ SWR — key = path (ເຊັ່ນ "/rooms?page=1"), null = ຍັງບໍ່ດຶງ */
export function useApi<T = any>(path: string | null, config?: SWRConfiguration<T, ApiError>) {
  return useSWR<T, ApiError>(path, (p: string) => api.get<T>(p), {
    revalidateOnFocus: true,
    keepPreviousData: true,
    ...config,
  });
}

/** ໃຫ້ທຸກໜ້າທີ່ໃຊ້ຂໍ້ມູນກຸ່ມນີ້ໂຫຼດໃໝ່ ເຊັ່ນ revalidate("/bookings", "/rooms") */
export function revalidate(...prefixes: string[]) {
  // ບອກລະບົບແຈ້ງເຕືອນວ່າຜູ້ໃຊ້ຫາກໍ່ປ່ຽນຂໍ້ມູນເອງ → ອັບເດດ bell ທັນທີ (ບໍ່ເດັ້ງແຈ້ງເຕືອນຊ້ຳ)
  if (typeof window !== "undefined") window.dispatchEvent(new Event(DATA_CHANGED_EVENT));
  return refreshCache(...prefixes);
}

/** ໂຫຼດ cache ຂອງ SWR ໃໝ່ ໂດຍບໍ່ແຈ້ງລະບົບແຈ້ງເຕືອນ */
export function refreshCache(...prefixes: string[]) {
  return mutate((key) => typeof key === "string" && prefixes.some((p) => key.startsWith(p)));
}

export const DATA_CHANGED_EVENT = "dorm:data-changed";

/** ຂໍ້ຄວາມ error ທີ່ອ່ານງ່າຍ */
export function errorMessage(err: unknown) {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "ເກີດຂໍ້ຜິດພາດ";
}
