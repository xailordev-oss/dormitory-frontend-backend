"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { api, DATA_CHANGED_EVENT, refreshCache } from "./api";
import { useAuth } from "./auth";
import { L } from "./labels";
import { installSoundUnlock, isSoundReady, onSoundReadyChange, playSound, unlockSound, type SoundKind } from "./sound";
import type { AppNotification, Booking, Maintenance, NotificationList, Paged, Payment } from "./types";

/**
 * ລະບົບແຈ້ງເຕືອນແບບ real-time (ກວດທຸກໆ POLL_MS ມິນລິວິນາທີ)
 *
 * ນັກສຶກສາ: ດຶງ /api/notifications ທີ່ backend ສ້າງໃຫ້ອັດຕະໂນມັດ ເມື່ອ:
 *   - ການຈອງຖືກອະນຸມັດ / ຍົກເລີກ / ພະນັກງານຈອງແທນ
 *   - ມີໃບແຈ້ງໜີ້ໃໝ່, ຮັບເງິນແລ້ວ, ເຕືອນຄ້າງຈ່າຍ
 *   - ສະຖານະແຈ້ງສ້ອມແປງປ່ຽນ, ແຈ້ງການຈາກຫໍພັກ
 *
 * Admin / Staff: ກວດວຽກທີ່ລໍຖ້າ ຈາກ API ທີ່ມີຢູ່ແລ້ວ:
 *   - ການຈອງໃໝ່ທີ່ລໍຖ້າອະນຸມັດ      GET /api/bookings?status=pending
 *   - ແຈ້ງສ້ອມແປງໃໝ່                GET /api/maintenance?status=pending
 *   - ບິນຄ້າງຈ່າຍເກີນກຳນົດ            GET /api/payments?overdue=true
 *
 * ເມື່ອພົບລາຍການໃໝ່ (id ໃຫຍ່ກວ່າທີ່ເຄີຍເຫັນ): ເດັ້ງ toast + ສຽງ + browser notification (ຖ້າອະນຸຍາດ)
 * + ໂຫຼດຂໍ້ມູນໜ້າທີ່ກ່ຽວຂ້ອງໃໝ່ + ສະແດງຈຳນວນໃນ title ຂອງ tab
 */

const POLL_MS = Math.max(5000, Number(process.env.NEXT_PUBLIC_POLL_INTERVAL) || 15000);

export interface AlertItem {
  key: string;
  kind: "booking" | "maintenance" | "overdue" | "notification";
  id: number;
  title: string;
  message: string;
  href: string;
  createdAt: string;
  unread: boolean;
  tone: "info" | "warning" | "urgent" | "success";
}

interface NotificationState {
  items: AlertItem[];
  count: number; // ຕົວເລກເທິງກະດິ່ງ
  counts: { bookings: number; maintenance: number; overdue: number; unread: number };
  lastChecked: Date | null;
  ringing: boolean;
  refresh: () => Promise<void>;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
  soundReady: boolean; // browser ອະນຸຍາດໃຫ້ຫຼິ້ນສຽງແລ້ວ
  testSound: () => void;
  browserPermission: NotificationPermission | "unsupported";
  requestBrowserPermission: () => Promise<void>;
}

const Ctx = createContext<NotificationState | null>(null);

/* ---------- localStorage ປອດໄພ ---------- */
const store = {
  get(k: string) {
    try {
      return window.localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string) {
    try {
      window.localStorage.setItem(k, v);
    } catch {
      /* ignore */
    }
  },
};

/** ຄັ້ງທຳອິດຂອງບັນຊີນີ້ໃນ tab ນີ້ບໍ? (ໃຊ້ເຕືອນວຽກຄ້າງຕອນເປີດເວັບ) */
function firstInTab(uid: number) {
  try {
    const k = `dorm_greeted_${uid}`;
    if (window.sessionStorage.getItem(k)) return false;
    window.sessionStorage.setItem(k, "1");
    return true;
  } catch {
    return false;
  }
}

const notifTone = (t: AppNotification["type"]): AlertItem["tone"] =>
  t === "urgent" ? "urgent" : t === "warning" ? "warning" : t === "payment" ? "success" : "info";

const notifHref = (n: AppNotification) =>
  n.type === "payment" ? "/payments" : n.type === "maintenance" ? "/maintenance" : /ຈອງ/.test(n.title) ? "/bookings" : "/notifications";

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user, isStaff } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [items, setItems] = useState<AlertItem[]>([]);
  const [counts, setCounts] = useState({ bookings: 0, maintenance: 0, overdue: 0, unread: 0 });
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [ringing, setRinging] = useState(false);
  const [soundReady, setSoundReady] = useState(false);
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission | "unsupported">("default");

  const polling = useRef(false);
  const uid = user?.id;

  // ສຽງເປີດສະເໝີ: ປົດລັອກສຽງຕັ້ງແຕ່ຜູ້ໃຊ້ກົດໜ້າເວັບຄັ້ງທຳອິດ
  useEffect(() => {
    const off1 = installSoundUnlock();
    const off2 = onSoundReadyChange(setSoundReady);
    setSoundReady(isSoundReady());
    return () => {
      off1();
      off2();
    };
  }, []);

  useEffect(() => {
    setBrowserPermission(typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported");
  }, []);

  const testSound = useCallback(() => {
    void unlockSound().then(() => playSound("booking"));
  }, []);

  const requestBrowserPermission = useCallback(async () => {
    if (!("Notification" in window)) return;
    const p = await Notification.requestPermission();
    setBrowserPermission(p);
    if (p === "granted") toast.success("ເປີດການແຈ້ງເຕືອນຂອງ browser ແລ້ວ");
  }, []);

  /** ແຈ້ງເຕືອນລາຍການໃໝ່: toast (ຕອນເປີດ tab ຢູ່) ຫຼື browser notification (ຕອນຢູ່ tab ອື່ນ) */
  const announce = useCallback(
    (fresh: AlertItem[]) => {
      if (fresh.length === 0) return;
      setRinging(true);
      setTimeout(() => setRinging(false), 1000);
      // ເລືອກສຽງຕາມຄວາມສຳຄັນ: ດ່ວນ > ການຈອງ > ທົ່ວໄປ
      const kind: SoundKind = fresh.some((i) => i.tone === "urgent")
        ? "urgent"
        : fresh.some((i) => i.kind === "booking" || /ຈອງ/.test(i.title))
          ? "booking"
          : "notify";
      playSound(kind);

      const hidden = document.visibilityState === "hidden";
      const canBrowser = "Notification" in window && Notification.permission === "granted";

      const show = fresh.length > 3 ? fresh.slice(0, 2) : fresh;
      for (const it of show) {
        const fn = it.tone === "urgent" ? toast.error : it.tone === "warning" ? toast.warning : it.tone === "success" ? toast.success : toast.info;
        fn(it.title, {
          description: it.message,
          duration: 8000,
          action: { label: "ເບິ່ງ", onClick: () => router.push(it.href) },
        });
        if (hidden && canBrowser) {
          try {
            const n = new Notification(it.title, { body: it.message, tag: it.key, icon: "/icon.svg", silent: false, requireInteraction: it.tone === "urgent" });
            n.onclick = () => {
              window.focus();
              router.push(it.href);
            };
          } catch {
            /* ignore */
          }
        }
      }
      if (fresh.length > 3) {
        toast.info(`ແລະ ອີກ ${fresh.length - 2} ລາຍການໃໝ່`, { action: { label: "ເບິ່ງທັງໝົດ", onClick: () => router.push(fresh[0].href) } });
      }
    },
    [router]
  );

  /** ໝາຍ id ທີ່ເຫັນແລ້ວ ແລະ ຄືນລາຍການທີ່ໃໝ່ກວ່າ (ເທື່ອທຳອິດ: ບໍ່ນັບເປັນໃໝ່) */
  const detectNew = useCallback(
    (kind: string, list: AlertItem[], silent: boolean) => {
      const key = `dorm_seen_${uid}_${kind}`;
      const stored = store.get(key);
      const maxId = list.reduce((m, it) => Math.max(m, it.id), 0);
      if (stored === null) {
        store.set(key, String(maxId));
        return [];
      }
      const seen = Number(stored) || 0;
      if (maxId > seen) store.set(key, String(maxId));
      // ບໍ່ວ່າກໍລະນີໃດ ລາຍການໃໝ່ຕ້ອງມີສຽງ + toast ສະເໝີ (ລວມທັງກວດທັນທີຫຼັງຜູ້ໃຊ້ປ່ຽນຂໍ້ມູນເອງ)
      void silent;
      return list.filter((it) => it.id > seen);
    },
    [uid]
  );

  const poll = useCallback(
    async (silent = false) => {
      if (!uid || polling.current) return;
      polling.current = true;
      try {
        if (isStaff) {
          const [bk, mt, od] = await Promise.all([
            api.get<Paged<Booking>>("/bookings?status=pending&limit=10"),
            api.get<Paged<Maintenance>>("/maintenance?status=pending&limit=10"),
            api.get<Paged<Payment>>("/payments?status=pending&overdue=true&limit=1").catch(() => null),
          ]);

          const bookingItems: AlertItem[] = bk.data.map((b) => ({
            key: `booking-${b.id}`,
            kind: "booking",
            id: b.id,
            title: "ມີການຈອງຫ້ອງໃໝ່",
            message: `${b.student_name ?? "ນັກສຶກສາ"} ຈອງຫ້ອງ ${b.room_number ?? b.room_id}${b.building_name ? ` (${b.building_name})` : ""} · ເຂົ້າພັກ ${String(b.check_in_date).slice(0, 10)}`,
            href: "/bookings?status=pending",
            createdAt: b.created_at,
            unread: true,
            tone: "info",
          }));
          const maintItems: AlertItem[] = mt.data.map((m) => ({
            key: `maint-${m.id}`,
            kind: "maintenance",
            id: m.id,
            title: `ແຈ້ງສ້ອມແປງໃໝ່ · ${L.prio[m.priority]}`,
            message: `ຫ້ອງ ${m.room_number ?? m.room_id}: ${m.issue}${m.reporter_name ? ` (ໂດຍ ${m.reporter_name})` : ""}`,
            href: "/maintenance?status=pending",
            createdAt: m.created_at,
            unread: true,
            tone: m.priority === "urgent" ? "urgent" : m.priority === "high" ? "warning" : "info",
          }));

          const overdue = od?.total ?? 0;
          const all = [...bookingItems, ...maintItems].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          if (overdue > 0) {
            all.push({
              key: "overdue",
              kind: "overdue",
              id: 0,
              title: "ມີບິນຄ້າງຈ່າຍເກີນກຳນົດ",
              message: `${overdue} ລາຍການ · ກົດເພື່ອເບິ່ງ ແລະ ສົ່ງແຈ້ງເຕືອນ`,
              href: "/payments?overdue=true",
              createdAt: new Date().toISOString(),
              unread: false,
              tone: "warning",
            });
          }

          const first = firstInTab(uid);
          const fresh = [...detectNew("booking", bookingItems, silent), ...detectNew("maintenance", maintItems, silent)];
          setItems(all);
          setCounts({ bookings: bk.total, maintenance: mt.total, overdue, unread: 0 });
          // ເປີດເວັບ/login ໃໝ່ ແລະ ມີວຽກຄ້າງ → ເຕືອນ 1 ເທື່ອພ້ອມສຽງ
          if (!fresh.length && first && bk.total + mt.total > 0) {
            playSound(mt.data.some((m) => m.priority === "urgent") ? "urgent" : "booking");
            toast.info(`ມີວຽກລໍຖ້າ: ການຈອງ ${bk.total} ລາຍການ · ແຈ້ງສ້ອມ ${mt.total} ລາຍການ`, {
              duration: 8000,
              action: { label: "ເບິ່ງ", onClick: () => router.push(bk.total ? "/bookings?status=pending" : "/maintenance?status=pending") },
            });
          }
          if (fresh.length) {
            announce(fresh);
            void refreshCache("/bookings", "/maintenance", "/reports", "/rooms");
          }
        } else {
          const res = await api.get<NotificationList>("/notifications?limit=15");
          const list: AlertItem[] = res.data.map((n) => ({
            key: `notif-${n.id}`,
            kind: "notification",
            id: n.id,
            title: n.title,
            message: n.message,
            href: notifHref(n),
            createdAt: n.created_at,
            unread: !Number(n.is_read),
            tone: notifTone(n.type),
          }));
          const firstLoad = firstInTab(uid);
          const fresh = detectNew("notification", list, silent);
          setItems(list);
          const unread = res.unread ?? list.filter((i) => i.unread).length;
          setCounts({ bookings: 0, maintenance: 0, overdue: 0, unread });
          if (firstLoad && unread > 0 && !fresh.length) {
            playSound("notify");
            toast.info(`ທ່ານມີ ${unread} ແຈ້ງການທີ່ຍັງບໍ່ໄດ້ອ່ານ`, {
              action: { label: "ເບິ່ງ", onClick: () => router.push("/notifications") },
            });
          }
          if (fresh.length) {
            announce(fresh);
            // ແຈ້ງການໃໝ່ມັກມາພ້ອມການປ່ຽນແປງຂໍ້ມູນ (ອະນຸມັດການຈອງ, ບິນໃໝ່...) → ໂຫຼດໜ້າກ່ຽວຂ້ອງໃໝ່
            void refreshCache("/bookings", "/payments", "/maintenance", "/notifications", "/students/me");
          }
        }
        setLastChecked(new Date());
      } catch {
        /* ເຄືອຂ່າຍຂາດຊົ່ວຄາວ — ລອງໃໝ່ຮອບໜ້າ */
      } finally {
        polling.current = false;
      }
    },
    [uid, isStaff, detectNew, announce, router]
  );

  // ກວດທັນທີເມື່ອ login ແລ້ວ ແລະ ທຸກໆ POLL_MS
  useEffect(() => {
    if (!uid) {
      setItems([]);
      setCounts({ bookings: 0, maintenance: 0, overdue: 0, unread: 0 });
      return;
    }
    void poll();
    const t = setInterval(() => void poll(), POLL_MS);
    const onFocus = () => void poll();
    const onChanged = () => setTimeout(() => void poll(true), 300);
    window.addEventListener("focus", onFocus);
    window.addEventListener(DATA_CHANGED_EVENT, onChanged);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(DATA_CHANGED_EVENT, onChanged);
    };
  }, [uid, poll]);

  const count = isStaff ? counts.bookings + counts.maintenance : counts.unread;

  // ສະແດງຈຳນວນໃນ title ຂອງ tab ເຊັ່ນ "(3) ລະບົບຫໍພັກ"
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\)\s*/, "");
    document.title = count > 0 ? `(${count}) ${base}` : base;
  }, [count, pathname]);

  const markRead = useCallback(async (id: number) => {
    await api.patch(`/notifications/${id}/read`);
    setItems((prev) => prev.map((i) => (i.kind === "notification" && i.id === id ? { ...i, unread: false } : i)));
    setCounts((c) => ({ ...c, unread: Math.max(0, c.unread - 1) }));
    void refreshCache("/notifications");
  }, []);

  const markAllRead = useCallback(async () => {
    await api.patch("/notifications/read-all");
    setItems((prev) => prev.map((i) => ({ ...i, unread: false })));
    setCounts((c) => ({ ...c, unread: 0 }));
    void refreshCache("/notifications");
  }, []);

  const value = useMemo<NotificationState>(
    () => ({
      items,
      count,
      counts,
      lastChecked,
      ringing,
      refresh: () => poll(),
      markRead,
      markAllRead,
      soundReady,
      testSound,
      browserPermission,
      requestBrowserPermission,
    }),
    [items, count, counts, lastChecked, ringing, poll, markRead, markAllRead, soundReady, testSound, browserPermission, requestBrowserPermission]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNotifications() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useNotifications ຕ້ອງໃຊ້ພາຍໃນ <NotificationProvider>");
  return ctx;
}

