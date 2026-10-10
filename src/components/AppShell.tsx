"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  DoorOpen,
  Users,
  GraduationCap,
  CalendarCheck,
  Wallet,
  Wrench,
  UserCheck,
  Bell,
  BarChart3,
  ScrollText,
  UserCircle,
  LogOut,
  Menu,
  X,
  Home,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { L } from "@/lib/labels";
import type { Role } from "@/lib/types";
import { NotificationBell } from "./NotificationBell";
import { Loading } from "./ui";
import { useNotifications } from "@/lib/notifications";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  roles: Role[];
  badge?: "bookings" | "maintenance" | "unread";
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "ໜ້າຫຼັກ", icon: <LayoutDashboard className="size-4" />, roles: ["admin", "staff", "student"] },
  { href: "/rooms", label: "ຫ້ອງພັກ", icon: <DoorOpen className="size-4" />, roles: ["admin", "staff", "student"] },
  { href: "/bookings", label: "ການຈອງ", icon: <CalendarCheck className="size-4" />, roles: ["admin", "staff", "student"], badge: "bookings" },
  { href: "/payments", label: "ການຊຳລະ", icon: <Wallet className="size-4" />, roles: ["admin", "staff", "student"] },
  { href: "/maintenance", label: "ແຈ້ງສ້ອມແປງ", icon: <Wrench className="size-4" />, roles: ["admin", "staff", "student"], badge: "maintenance" },
  { href: "/notifications", label: "ແຈ້ງການ", icon: <Bell className="size-4" />, roles: ["admin", "staff", "student"], badge: "unread" },
  { href: "/students", label: "ນັກສຶກສາ", icon: <GraduationCap className="size-4" />, roles: ["admin", "staff"] },
  { href: "/visitors", label: "ຜູ້ມາຢ້ຽມ", icon: <UserCheck className="size-4" />, roles: ["admin", "staff"] },
  { href: "/buildings", label: "ຕຶກ", icon: <Building2 className="size-4" />, roles: ["admin", "staff", "student"] },
  { href: "/reports", label: "ລາຍງານ", icon: <BarChart3 className="size-4" />, roles: ["admin"] },
  { href: "/users", label: "ຜູ້ໃຊ້ລະບົບ", icon: <Users className="size-4" />, roles: ["admin"] },
  { href: "/audit-logs", label: "ປະຫວັດການແກ້ໄຂ", icon: <ScrollText className="size-4" />, roles: ["admin"] },
  { href: "/profile", label: "ໂປຣໄຟລ໌", icon: <UserCircle className="size-4" />, roles: ["admin", "staff", "student"] },
];

/** ຈຸດສະຖານະ backend (GET /health) */
function HealthDot() {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    const check = () =>
      fetch("/backend-health", { cache: "no-store" })
        .then((r) => alive && setOk(r.ok))
        .catch(() => alive && setOk(false));
    check();
    const t = setInterval(check, 60000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  const cls = ok === null ? "bg-slate-300" : ok ? "bg-emerald-500" : "bg-red-500";
  return (
    <span className="flex items-center gap-1.5 text-xs text-slate-500" title="ສະຖານະ server ແລະ ຖານຂໍ້ມູນ">
      <span className={`size-2 rounded-full ${cls}`} />
      {ok === null ? "ກຳລັງກວດ" : ok ? "Server ປົກກະຕິ" : "Server ຂັດຂ້ອງ"}
    </span>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const { counts, soundReady, testSound } = useNotifications();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [loading, user, router, pathname]);

  useEffect(() => setMobileOpen(false), [pathname]);

  if (loading || !user) return <Loading text="ກຳລັງກວດສອບການເຂົ້າສູ່ລະບົບ..." />;

  const items = NAV.filter((n) => n.roles.includes(user.role));
  const badgeOf = (b?: NavItem["badge"]) => {
    if (!b) return 0;
    if (user.role === "student") return b === "unread" ? counts.unread : 0;
    return b === "bookings" ? counts.bookings : b === "maintenance" ? counts.maintenance : 0;
  };

  const sidebar = (
    <nav className="flex h-full flex-col">
      <Link href="/dashboard" className="flex items-center gap-2 px-5 py-5">
        <span className="rounded-lg bg-brand-600 p-1.5 text-white">
          <Home className="size-5" />
        </span>
        <span className="font-bold text-slate-900">ລະບົບຈັດການຫໍພັກ</span>
      </Link>
      <ul className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {items.map((n) => {
          const active = pathname === n.href || pathname.startsWith(n.href + "/");
          const badge = badgeOf(n.badge);
          return (
            <li key={n.href}>
              <Link
                href={n.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                  active ? "bg-brand-50 font-semibold text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {n.icon}
                <span className="flex-1">{n.label}</span>
                {badge > 0 && <span className="rounded-full bg-red-500 px-1.5 text-[11px] leading-5 font-bold text-white">{badge}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="border-t border-slate-100 p-4">
        <HealthDot />
      </div>
    </nav>
  );

  return (
    <div className="app-root min-h-screen lg:pl-64">
      {/* sidebar desktop */}
      <aside className="no-print fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white lg:block">{sidebar}</aside>

      {/* sidebar mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMobileOpen(false)} />
          <aside className="animate-in absolute inset-y-0 left-0 w-64 bg-white shadow-xl">
            <button className="absolute top-4 right-3 p-1 text-slate-400" onClick={() => setMobileOpen(false)} aria-label="ປິດເມນູ">
              <X className="size-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <header className="no-print sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
        <button className="rounded p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="ເປີດເມນູ">
          <Menu className="size-5" />
        </button>
        <div className="flex-1" />
        <NotificationBell />
        <Link href="/profile" className="flex items-center gap-2 rounded-full py-1 pr-3 pl-1 hover:bg-slate-100">
          {user.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatar_url} alt="" className="size-8 rounded-full object-cover" />
          ) : (
            <span className="flex size-8 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
              {user.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="hidden text-left sm:block">
            <span className="block text-sm leading-tight font-medium text-slate-900">{user.name}</span>
            <span className="block text-xs text-slate-500">{L.role[user.role]}</span>
          </span>
        </Link>
        <button onClick={() => void logout()} className="rounded-full p-2 text-slate-500 hover:bg-red-50 hover:text-red-600" title="ອອກຈາກລະບົບ">
          <LogOut className="size-5" />
        </button>
      </header>

      {!soundReady && (
        <button
          onClick={testSound}
          className="no-print flex w-full items-center justify-center gap-2 bg-amber-50 px-4 py-2 text-sm text-amber-800 hover:bg-amber-100"
        >
          🔇 Browser ຍັງປິດສຽງຢູ່ — ກົດບ່ອນໃດກໍໄດ້ໃນໜ້ານີ້ ເພື່ອເປີດສຽງແຈ້ງເຕືອນ
        </button>
      )}
      <main className="mx-auto max-w-7xl p-4 sm:p-6">{children}</main>
    </div>
  );
}

/** ກັນໜ້າທີ່ role ນີ້ບໍ່ມີສິດ (backend ກໍກວດຊ້ຳອີກຊັ້ນ) */
export function RoleGate({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return null;
  if (!roles.includes(user.role)) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 text-center">
        <p className="text-lg font-semibold text-amber-800">ທ່ານບໍ່ມີສິດເຂົ້າໜ້ານີ້</p>
        <p className="mt-1 text-sm text-amber-700">ໜ້ານີ້ສະເພາະ: {roles.map((r) => L.role[r]).join(", ")}</p>
      </div>
    );
  }
  return <>{children}</>;
}
