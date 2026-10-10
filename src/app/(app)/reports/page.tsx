"use client";

import { useState } from "react";
import { qs, useApi } from "@/lib/api";
import { L, money, num } from "@/lib/labels";
import type { MaintenanceSummary, OccupancyReport, RevenueReport } from "@/lib/types";
import { Card, ErrorBox, Input, Loading, PageHeader, StatCard, Table } from "@/components/ui";
import { RoleGate } from "@/components/AppShell";
import { BarList, ColumnChart } from "@/components/charts";

/** GET /api/reports/occupancy · /revenue · /maintenance-summary — admin ເທົ່ານັ້ນ */
export default function ReportsPage() {
  return (
    <RoleGate roles={["admin"]}>
      <ReportsInner />
    </RoleGate>
  );
}

type Tab = "occupancy" | "revenue" | "maintenance";

function ReportsInner() {
  const [tab, setTab] = useState<Tab>("occupancy");
  const tabs: [Tab, string][] = [
    ["occupancy", "ການເຂົ້າພັກ"],
    ["revenue", "ລາຍຮັບ"],
    ["maintenance", "ການສ້ອມແປງ"],
  ];
  return (
    <>
      <PageHeader title="ລາຍງານ" description="ສະຖິຕິສຳລັບຜູ້ບໍລິຫານ" />
      <div className="mb-6 inline-flex rounded-lg border border-slate-200 bg-white p-1">
        {tabs.map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium ${tab === k ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "occupancy" && <Occupancy />}
      {tab === "revenue" && <Revenue />}
      {tab === "maintenance" && <MaintenanceReport />}
    </>
  );
}

function Occupancy() {
  const { data, error } = useApi<{ data: OccupancyReport }>("/reports/occupancy");
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading />;
  const d = data.data;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="ອັດຕາເຂົ້າພັກ" value={`${d.occupancyRate}%`} sub={`${d.totalOccupants}/${d.totalBeds} ຕຽງ`} />
        <StatCard label="ຕຽງວ່າງ" value={num(d.availableBeds)} tone="green" />
        <StatCard label="ຫ້ອງມີຄົນພັກ / ເຕັມ" value={`${d.occupiedRooms} / ${d.fullRooms}`} sub={`ຈາກທັງໝົດ ${d.totalRooms} ຫ້ອງ`} tone="purple" />
        <StatCard label="ຫ້ອງສ້ອມແປງ" value={d.maintenanceRooms} tone="yellow" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="ອັດຕາເຂົ້າພັກແຍກຕາມຕຶກ (%)">
          <BarList
            max={100}
            unit="%"
            items={d.byBuilding.map((b) => ({ label: b.buildingName, value: b.occupancyRate, detail: `${b.occupants}/${b.beds} ຕຽງ · ${b.rooms} ຫ້ອງ` }))}
          />
        </Card>
        <Card title="ການຈອງແຍກຕາມສະຖານະ">
          <BarList
            items={Object.entries(d.bookingsByStatus).map(([k, v]) => ({ label: (L.booking as Record<string, string>)[k] ?? k, value: v }))}
          />
        </Card>
      </div>
      <Card title="ຕາຕະລາງແຍກຕາມຕຶກ" padded={false}>
        <Table
          rows={d.byBuilding.map((b) => ({ ...b, id: b.buildingId }))}
          columns={[
            { header: "ຕຶກ", cell: (b) => b.buildingName },
            { header: "ຫ້ອງ", className: "text-right", cell: (b) => b.rooms },
            { header: "ຕຽງ", className: "text-right", cell: (b) => b.beds },
            { header: "ຜູ້ພັກ", className: "text-right", cell: (b) => b.occupants },
            { header: "ອັດຕາ", className: "text-right", cell: (b) => `${b.occupancyRate}%` },
          ]}
        />
      </Card>
    </div>
  );
}

function Revenue() {
  const year = new Date().getFullYear();
  const [from, setFrom] = useState(`${year}-01-01`);
  const [to, setTo] = useState(`${year}-12-31`);
  const { data, error } = useApi<{ data: RevenueReport }>(`/reports/revenue${qs({ from, to })}`);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-500">ຊ່ວງວັນທີ</span>
        <Input type="date" className="!w-44" value={from} onChange={(e) => setFrom(e.target.value)} />
        <span>–</span>
        <Input type="date" className="!w-44" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      {error ? (
        <ErrorBox error={error} />
      ) : !data ? (
        <Loading />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="ລາຍຮັບລວມ" value={money(data.data.totalRevenue)} sub={`${data.data.totalPaidTransactions} ລາຍການ`} tone="green" />
            <StatCard label="ຍອດຄ້າງຮັບ" value={money(data.data.outstandingAmount)} sub={`${data.data.outstandingCount} ລາຍການ`} tone="yellow" />
            <StatCard
              label="ສະເລ່ຍຕໍ່ລາຍການ"
              value={money(data.data.totalPaidTransactions ? Math.round(data.data.totalRevenue / data.data.totalPaidTransactions) : 0)}
              tone="gray"
            />
          </div>
          <Card title="ລາຍຮັບລາຍເດືອນ (ກີບ)">
            <ColumnChart items={data.data.monthlyRevenue.map((m) => ({ label: m.month, value: m.total }))} format={money} />
          </Card>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="ລາຍຮັບແຍກຕາມວິທີຊຳລະ">
              <BarList
                format={money}
                items={Object.entries(data.data.revenueByMethod).map(([k, v]) => ({ label: (L.method as Record<string, string>)[k] ?? k, value: v }))}
              />
            </Card>
            <Card title="ຈຳນວນລາຍການແຍກຕາມສະຖານະ">
              <BarList
                items={Object.entries(data.data.transactionCountByStatus).map(([k, v]) => ({ label: (L.pay as Record<string, string>)[k] ?? k, value: v }))}
              />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function MaintenanceReport() {
  const { data, error } = useApi<{ data: MaintenanceSummary }>("/reports/maintenance-summary");
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading />;
  const d = data.data;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="ແຈ້ງທັງໝົດ" value={d.totalRequests} />
        <StatCard label="ຍັງເປີດຢູ່" value={d.openCount} tone="yellow" />
        <StatCard label="ດ່ວນ ແລະ ຍັງເປີດ" value={d.openUrgentCount} tone={d.openUrgentCount ? "red" : "gray"} />
        <StatCard label="ເວລາແກ້ໄຂສະເລ່ຍ" value={d.avgResolutionHours === null ? "—" : `${d.avgResolutionHours} ຊມ`} tone="green" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="ແຍກຕາມສະຖານະ">
          <BarList items={Object.entries(d.byStatus).map(([k, v]) => ({ label: (L.maint as Record<string, string>)[k] ?? k, value: v }))} />
        </Card>
        <Card title="ແຍກຕາມລະດັບ">
          <BarList items={Object.entries(d.byPriority).map(([k, v]) => ({ label: (L.prio as Record<string, string>)[k] ?? k, value: v }))} />
        </Card>
        <Card title="ຫ້ອງທີ່ແຈ້ງຫຼາຍສຸດ">
          <BarList items={d.topRooms.map((r) => ({ label: `ຫ້ອງ ${r.roomNumber}`, value: r.count }))} />
        </Card>
      </div>
    </div>
  );
}
