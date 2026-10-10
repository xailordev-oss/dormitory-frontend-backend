"use client";

import Link from "next/link";
import { BedDouble, CalendarCheck, GraduationCap, Wallet, Wrench, UserCheck, AlertTriangle, Home, Bell } from "lucide-react";
import { api, useApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useAction } from "@/lib/hooks";
import { date, money, num, timeAgo } from "@/lib/labels";
import type { Booking, Dashboard, Maintenance, NotificationList, Paged, Payment, PaymentTotals } from "@/lib/types";
import { Button, Card, Empty, ErrorBox, Loading, PageHeader, StatCard, StatusBadge } from "@/components/ui";
import { HeroSlider } from "@/components/HeroSlider";

/** ແຖບຮູບສະໄລ້ດ້ານເທິງ — ຖ້າໂຟນເດີ images ບໍ່ມີຮູບ ຈະເປັນຫົວຂໍ້ທຳມະດາ */
function DashboardHero({ title, description }: { title: string; description?: string }) {
  return (
    <HeroSlider className="mb-6 h-48 rounded-2xl sm:h-64" fallback={<PageHeader title={title} description={description} />}>
      <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
      {description && <p className="mt-1 text-sm text-white/80 sm:text-base">{description}</p>}
    </HeroSlider>
  );
}

export default function DashboardPage() {
  const { isStaff } = useAuth();
  return isStaff ? <StaffDashboard /> : <StudentDashboard />;
}

/* ============ Admin / Staff: GET /api/reports/dashboard ============ */
function StaffDashboard() {
  const { user } = useAuth();
  const { data, error, isLoading, mutate } = useApi<{ data: Dashboard }>("/reports/dashboard", { refreshInterval: 30000 });
  const pending = useApi<Paged<Booking>>("/bookings?status=pending&limit=5");
  const maint = useApi<Paged<Maintenance>>("/maintenance?status=pending&limit=5");
  const { busy, run } = useAction();

  if (error) return <ErrorBox error={error} onRetry={() => mutate()} />;
  if (isLoading || !data) return <Loading />;
  const d = data.data;

  const approve = (b: Booking) =>
    run(`approve-${b.id}`, () => api.patch(`/bookings/${b.id}/approve`), { refresh: ["/bookings", "/reports", "/rooms"] });

  return (
    <>
      <DashboardHero title={`ສະບາຍດີ, ${user?.name ?? ""}`} description="ພາບລວມຂອງຫໍພັກມື້ນີ້" />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="ອັດຕາເຂົ້າພັກ"
          value={`${d.rooms.occupancyRate}%`}
          sub={`${d.rooms.occupants}/${d.rooms.beds} ຕຽງ · ຫວ່າງ ${d.rooms.availableBeds}`}
          icon={<BedDouble className="size-5" />}
        />
        <StatCard
          label="ການຈອງລໍຖ້າອະນຸມັດ"
          value={d.bookings.pending}
          sub={`ກຳລັງພັກ ${d.bookings.active} ຄົນ`}
          tone={d.bookings.pending > 0 ? "yellow" : "green"}
          icon={<CalendarCheck className="size-5" />}
        />
        <StatCard
          label="ຄ້າງຊຳລະ"
          value={money(d.payments.pendingAmount)}
          sub={`${d.payments.pendingCount} ລາຍການ · ເກີນກຳນົດ ${d.payments.overdueCount}`}
          tone={d.payments.overdueCount > 0 ? "red" : "gray"}
          icon={<Wallet className="size-5" />}
        />
        <StatCard
          label="ລາຍຮັບເດືອນນີ້"
          value={money(d.payments.revenueThisMonth)}
          tone="green"
          icon={<Wallet className="size-5" />}
        />
        <StatCard
          label="ນັກສຶກສາທີ່ພັກຢູ່"
          value={num(d.students.active)}
          sub={d.students.unlinked > 0 ? `ຍັງບໍ່ຜູກບັນຊີ ${d.students.unlinked} ຄົນ` : undefined}
          tone="purple"
          icon={<GraduationCap className="size-5" />}
        />
        <StatCard label="ຫ້ອງທັງໝົດ" value={d.rooms.total} sub={`ກຳລັງສ້ອມແປງ ${d.rooms.maintenance} ຫ້ອງ`} tone="gray" icon={<Home className="size-5" />} />
        <StatCard
          label="ແຈ້ງສ້ອມແປງທີ່ຍັງເປີດ"
          value={d.maintenance.open}
          sub={d.maintenance.openUrgent > 0 ? `ດ່ວນ ${d.maintenance.openUrgent} ລາຍການ` : undefined}
          tone={d.maintenance.openUrgent > 0 ? "red" : "yellow"}
          icon={<Wrench className="size-5" />}
        />
        <StatCard label="ຜູ້ມາຢ້ຽມຢູ່ໃນຫໍ" value={d.visitors.inside} tone="blue" icon={<UserCheck className="size-5" />} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card
          title="ການຈອງລໍຖ້າອະນຸມັດ"
          actions={
            <Link href="/bookings?status=pending" className="text-sm text-brand-600 hover:underline">
              ເບິ່ງທັງໝົດ
            </Link>
          }
          padded={false}
        >
          {!pending.data ? (
            <Loading />
          ) : pending.data.data.length === 0 ? (
            <Empty text="ບໍ່ມີການຈອງທີ່ລໍຖ້າ" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {pending.data.data.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{b.student_name}</p>
                    <p className="text-xs text-slate-500">
                      ຫ້ອງ {b.room_number} · {b.building_name} · ເຂົ້າ {date(b.check_in_date)} · {timeAgo(b.created_at)}
                    </p>
                  </div>
                  <Button size="sm" variant="success" loading={busy === `approve-${b.id}`} onClick={() => approve(b)}>
                    ອະນຸມັດ
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="ແຈ້ງສ້ອມແປງໃໝ່"
          actions={
            <Link href="/maintenance?status=pending" className="text-sm text-brand-600 hover:underline">
              ເບິ່ງທັງໝົດ
            </Link>
          }
          padded={false}
        >
          {!maint.data ? (
            <Loading />
          ) : maint.data.data.length === 0 ? (
            <Empty text="ບໍ່ມີລາຍການແຈ້ງສ້ອມໃໝ່" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {maint.data.data.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{m.issue}</p>
                    <p className="text-xs text-slate-500">
                      ຫ້ອງ {m.room_number} {m.reporter_name && `· ${m.reporter_name}`} · {timeAgo(m.created_at)}
                    </p>
                  </div>
                  <StatusBadge kind="prio" value={m.priority} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

/* ============ Student ============ */
function StudentDashboard() {
  const { user } = useAuth();
  const sid = user?.student_id;
  const bookings = useApi<Paged<Booking>>("/bookings?limit=3");
  const payments = useApi<Paged<Payment> & PaymentTotals>(sid ? `/payments/student/${sid}?limit=5` : null);
  const notes = useApi<NotificationList>("/notifications?limit=5");

  if (!user) return null;
  const current = bookings.data?.data.find((b) => b.status === "active" || b.status === "pending");

  return (
    <>
      <DashboardHero title={`ສະບາຍດີ, ${user.name}`} description="ພາບລວມການພັກຂອງທ່ານ" />

      {!sid && (
        <div className="mb-6 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle className="size-5 shrink-0" />
          ບັນຊີຂອງທ່ານຍັງບໍ່ໄດ້ເຊື່ອມກັບຂໍ້ມູນນັກສຶກສາ ຈຶ່ງຍັງຈອງຫ້ອງ ຫຼື ແຈ້ງສ້ອມແປງບໍ່ໄດ້. ກະລຸນາຕິດຕໍ່ຜູ້ດູແລລະບົບ.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="ຫ້ອງຂອງຂ້ອຍ"
          value={user.room_number ?? "—"}
          sub={user.building_name ?? "ຍັງບໍ່ມີຫ້ອງ"}
          icon={<Home className="size-5" />}
        />
        <StatCard
          label="ຍອດຄ້າງຊຳລະ"
          value={money(payments.data?.totalPending)}
          sub={payments.data?.totalOverdue ? `ເກີນກຳນົດ ${money(payments.data.totalOverdue)}` : "ບໍ່ມີຍອດເກີນກຳນົດ"}
          tone={payments.data?.totalOverdue ? "red" : "green"}
          icon={<Wallet className="size-5" />}
        />
        <StatCard label="ແຈ້ງການທີ່ຍັງບໍ່ໄດ້ອ່ານ" value={notes.data?.unread ?? 0} tone="blue" icon={<Bell className="size-5" />} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="ການຈອງປັດຈຸບັນ">
          {!bookings.data ? (
            <Loading />
          ) : current ? (
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold">ຫ້ອງ {current.room_number}</span>
                <StatusBadge kind="booking" value={current.status} />
              </div>
              <p className="text-slate-500">{current.building_name}</p>
              <p>ວັນເຂົ້າພັກ: {date(current.check_in_date)}</p>
              {current.status === "pending" && <p className="text-amber-700">ກຳລັງລໍຖ້າພະນັກງານອະນຸມັດ — ທ່ານຈະໄດ້ຮັບແຈ້ງເຕືອນທັນທີເມື່ອອະນຸມັດ</p>}
            </div>
          ) : (
            <div className="text-center">
              <Empty text="ທ່ານຍັງບໍ່ມີການຈອງ" />
              <Link href="/rooms?hasVacancy=true">
                <Button>ເລືອກຫ້ອງ ແລະ ຈອງ</Button>
              </Link>
            </div>
          )}
        </Card>

        <Card
          title="ແຈ້ງການລ່າສຸດ"
          padded={false}
          actions={
            <Link href="/notifications" className="text-sm text-brand-600 hover:underline">
              ທັງໝົດ
            </Link>
          }
        >
          {!notes.data ? (
            <Loading />
          ) : notes.data.data.length === 0 ? (
            <Empty text="ບໍ່ມີແຈ້ງການ" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {notes.data.data.map((n) => (
                <li key={n.id} className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    {!Number(n.is_read) && <span className="size-2 rounded-full bg-brand-600" />}
                    <p className="font-medium text-slate-900">{n.title}</p>
                    <StatusBadge kind="ntype" value={n.type} />
                  </div>
                  <p className="text-sm text-slate-600">{n.message}</p>
                  <p className="text-xs text-slate-400">{timeAgo(n.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="ບິນລ່າສຸດ"
          padded={false}
          className="lg:col-span-2"
          actions={
            <Link href="/payments" className="text-sm text-brand-600 hover:underline">
              ທັງໝົດ
            </Link>
          }
        >
          {!sid ? (
            <Empty text="—" />
          ) : !payments.data ? (
            <Loading />
          ) : payments.data.data.length === 0 ? (
            <Empty text="ຍັງບໍ່ມີບິນ" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {payments.data.data.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div>
                    <p className="font-medium">{p.description || p.type}</p>
                    <p className="text-xs text-slate-500">ກຳນົດ {date(p.due_date)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{money(p.amount)}</span>
                    {Number(p.is_overdue) ? <StatusBadge kind="pay" value="overdue" /> : <StatusBadge kind="pay" value={p.status} />}
                    <Link href={`/payments/${p.id}`} className="text-brand-600 hover:underline">
                      ເບິ່ງ
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
