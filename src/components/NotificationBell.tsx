"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, BellRing, CheckCheck, RefreshCw, Volume2, VolumeX, Wrench, CalendarCheck, Wallet, Info } from "lucide-react";
import { useNotifications, type AlertItem } from "@/lib/notifications";
import { useAuth } from "@/lib/auth";
import { timeAgo } from "@/lib/labels";

const ICON: Record<AlertItem["kind"], React.ReactNode> = {
  booking: <CalendarCheck className="size-4" />,
  maintenance: <Wrench className="size-4" />,
  overdue: <Wallet className="size-4" />,
  notification: <Info className="size-4" />,
};

const TONE_CLS: Record<AlertItem["tone"], string> = {
  info: "bg-blue-50 text-blue-600",
  warning: "bg-amber-50 text-amber-600",
  urgent: "bg-red-50 text-red-600",
  success: "bg-emerald-50 text-emerald-600",
};

export function NotificationBell() {
  const n = useNotifications();
  const { isStaff } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const go = async (it: AlertItem) => {
    setOpen(false);
    if (it.kind === "notification" && it.unread) {
      try {
        await n.markRead(it.id);
      } catch {
        /* ignore */
      }
    }
    router.push(it.href);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`relative rounded-full p-2 text-slate-600 hover:bg-slate-100 ${n.ringing ? "bell-ring" : ""}`}
        aria-label={`ແຈ້ງເຕືອນ (${n.count})`}
      >
        {n.count > 0 ? <BellRing className="size-5" /> : <Bell className="size-5" />}
        {n.count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] leading-5 font-bold text-white ring-2 ring-white">
            {n.count > 99 ? "99+" : n.count}
          </span>
        )}
      </button>

      {open && (
        <div className="animate-in absolute right-0 z-40 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <p className="font-semibold text-slate-900">ແຈ້ງເຕືອນ</p>
              {isStaff ? (
                <p className="text-xs text-slate-500">
                  ລໍຖ້າອະນຸມັດ {n.counts.bookings} · ແຈ້ງສ້ອມ {n.counts.maintenance}
                  {n.counts.overdue > 0 && ` · ຄ້າງຈ່າຍ ${n.counts.overdue}`}
                </p>
              ) : (
                <p className="text-xs text-slate-500">ຍັງບໍ່ໄດ້ອ່ານ {n.counts.unread} ລາຍການ</p>
              )}
            </div>
            <div className="flex gap-1">
              <button onClick={n.testSound} className="rounded p-1.5 text-slate-500 hover:bg-slate-100" title="ທົດສອບສຽງແຈ້ງເຕືອນ">
                {n.soundReady ? <Volume2 className="size-4" /> : <VolumeX className="size-4 text-red-500" />}
              </button>
              <button onClick={() => void n.refresh()} className="rounded p-1.5 text-slate-500 hover:bg-slate-100" title="ກວດໃໝ່">
                <RefreshCw className="size-4" />
              </button>
              {!isStaff && n.counts.unread > 0 && (
                <button onClick={() => void n.markAllRead()} className="rounded p-1.5 text-slate-500 hover:bg-slate-100" title="ອ່ານທັງໝົດ">
                  <CheckCheck className="size-4" />
                </button>
              )}
            </div>
          </div>

          {n.browserPermission === "default" && (
            <button
              onClick={() => void n.requestBrowserPermission()}
              className="w-full bg-brand-50 px-4 py-2 text-left text-xs text-brand-700 hover:bg-brand-100"
            >
              🔔 ເປີດແຈ້ງເຕືອນຂອງ browser (ແຈ້ງແມ້ຢູ່ tab ອື່ນ)
            </button>
          )}

          <ul className="max-h-[26rem] divide-y divide-slate-100 overflow-y-auto">
            {n.items.length === 0 && <li className="px-4 py-10 text-center text-sm text-slate-400">ບໍ່ມີແຈ້ງເຕືອນໃໝ່</li>}
            {n.items.map((it) => (
              <li key={it.key}>
                <button onClick={() => void go(it)} className={`flex w-full gap-3 px-4 py-3 text-left hover:bg-slate-50 ${it.unread && it.kind === "notification" ? "bg-brand-50/40" : ""}`}>
                  <span className={`mt-0.5 h-fit rounded-lg p-1.5 ${TONE_CLS[it.tone]}`}>{ICON[it.kind]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-slate-900">{it.title}</span>
                      {it.unread && it.kind === "notification" && <span className="size-2 shrink-0 rounded-full bg-brand-600" />}
                    </span>
                    <span className="line-clamp-2 text-xs text-slate-600">{it.message}</span>
                    {it.kind !== "overdue" && <span className="text-[11px] text-slate-400">{timeAgo(it.createdAt)}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-xs">
            <span className="text-slate-400">{n.lastChecked ? `ກວດລ່າສຸດ ${n.lastChecked.toLocaleTimeString()}` : "ກຳລັງກວດ..."}</span>
            <Link href={isStaff ? "/bookings?status=pending" : "/notifications"} onClick={() => setOpen(false)} className="font-medium text-brand-600 hover:underline">
              {isStaff ? "ໄປອະນຸມັດການຈອງ" : "ເບິ່ງທັງໝົດ"}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
