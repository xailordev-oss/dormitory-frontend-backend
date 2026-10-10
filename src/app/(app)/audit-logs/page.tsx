"use client";

import { qs, useApi } from "@/lib/api";
import { useFilters } from "@/lib/hooks";
import { datetime } from "@/lib/labels";
import type { AuditLog, Paged } from "@/lib/types";
import { Badge, Card, ErrorBox, FilterBar, Input, PageHeader, Pagination, Select, Table } from "@/components/ui";
import { RoleGate } from "@/components/AppShell";

const METHOD_TONE = { POST: "green", PUT: "blue", PATCH: "yellow", DELETE: "red" } as const;

/** GET /api/audit-logs — ປະຫວັດການເພີ່ມ/ແກ້/ລຶບ ຂອງ admin ແລະ staff (admin ເທົ່ານັ້ນ) */
export default function AuditLogsPage() {
  return (
    <RoleGate roles={["admin"]}>
      <Inner />
    </RoleGate>
  );
}

function Inner() {
  const f = useFilters({ method: "", adminId: "", from: "", to: "" });
  const { data, error, isLoading, mutate } = useApi<Paged<AuditLog>>(`/audit-logs${qs({ ...f.filters, page: f.page, limit: 50 })}`);
  return (
    <>
      <PageHeader title="ປະຫວັດການແກ້ໄຂ (Audit log)" description="ໃຜເຮັດຫຍັງ ເມື່ອໃດ ຈາກ IP ໃດ" />
      <FilterBar>
        <Select
          value={f.filters.method}
          onChange={(e) => f.set("method", e.target.value)}
          options={["POST", "PUT", "PATCH", "DELETE"].map((m) => [m, m])}
          empty="ທຸກ method"
        />
        <Input type="number" placeholder="User ID" value={f.filters.adminId} onChange={(e) => f.set("adminId", e.target.value)} />
        <Input type="date" value={f.filters.from} onChange={(e) => f.set("from", e.target.value)} title="ຈາກວັນທີ" />
        <Input type="date" value={f.filters.to} onChange={(e) => f.set("to", e.target.value)} title="ຮອດວັນທີ" />
      </FilterBar>
      {error && <ErrorBox error={error} onRetry={() => mutate()} />}
      <Card padded={false}>
        <Table
          loading={isLoading}
          rows={data?.data}
          columns={[
            { header: "ເວລາ", cell: (l) => <span className="text-xs whitespace-nowrap">{datetime(l.created_at)}</span> },
            {
              header: "ຜູ້ໃຊ້",
              cell: (l) => (
                <div>
                  <p>{l.admin_email ?? `#${l.admin_id}`}</p>
                  <p className="text-xs text-slate-500">{l.role}</p>
                </div>
              ),
            },
            { header: "Method", cell: (l) => <Badge tone={METHOD_TONE[l.method as keyof typeof METHOD_TONE] ?? "gray"}>{l.method}</Badge> },
            { header: "Path", cell: (l) => <code className="text-xs">{l.path}</code> },
            {
              header: "ຜົນ",
              cell: (l) => <Badge tone={l.status_code && l.status_code < 400 ? "green" : "red"}>{l.status_code ?? "—"}</Badge>,
            },
            { header: "IP", cell: (l) => <span className="text-xs text-slate-500">{l.ip_address}</span> },
          ]}
        />
        {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={f.setPage} />}
      </Card>
    </>
  );
}
