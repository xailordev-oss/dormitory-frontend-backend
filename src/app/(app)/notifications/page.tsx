"use client";

import { useState } from "react";
import { CheckCheck, Plus, Trash2 } from "lucide-react";
import { api, qs, useApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useAction, useDelete, useFilters } from "@/lib/hooks";
import { L, datetime, opts, timeAgo } from "@/lib/labels";
import { useNotifications } from "@/lib/notifications";
import type { AppNotification, NotificationList } from "@/lib/types";
import {
  Badge,
  Button,
  Card,
  Empty,
  ErrorBox,
  Field,
  FilterBar,
  FormActions,
  Input,
  Loading,
  Modal,
  PageHeader,
  Pagination,
  Select,
  StatusBadge,
  Textarea,
  formValues,
} from "@/components/ui";
import { StudentSelect } from "@/components/pickers";

/**
 * GET /api/notifications · PATCH /:id/read · /read-all
 * POST (admin, staff) · DELETE /:id (admin)
 */
export default function NotificationsPage() {
  const { isAdmin, isStaff, isStudent } = useAuth();
  const notif = useNotifications();
  const f = useFilters({ type: "", isRead: "", studentId: "" });
  const { data, error, isLoading, mutate } = useApi<NotificationList>(`/notifications${qs({ ...f.filters, page: f.page, limit: 20 })}`);
  const [creating, setCreating] = useState(false);
  const { busy, run } = useAction();
  const del = useDelete();

  const read = (n: AppNotification) => run(`r-${n.id}`, () => notif.markRead(n.id), { success: "" });

  return (
    <>
      <PageHeader
        title="ແຈ້ງການ"
        description={isStudent ? `ຍັງບໍ່ໄດ້ອ່ານ ${data?.unread ?? 0} ລາຍການ` : "ສົ່ງແຈ້ງການຫານັກສຶກສາຄົນດຽວ ຫຼື ທຸກຄົນ"}
        actions={
          <>
            {isStudent && (data?.unread ?? 0) > 0 && (
              <Button variant="secondary" loading={busy === "all"} onClick={() => run("all", () => notif.markAllRead(), { success: "ໝາຍວ່າອ່ານແລ້ວທັງໝົດ" })}>
                <CheckCheck className="size-4" /> ອ່ານທັງໝົດ
              </Button>
            )}
            {isStaff && (
              <Button onClick={() => setCreating(true)}>
                <Plus className="size-4" /> ສ້າງແຈ້ງການ
              </Button>
            )}
          </>
        }
      />
      <FilterBar>
        <Select value={f.filters.type} onChange={(e) => f.set("type", e.target.value)} options={opts(L.ntype)} empty="ທຸກປະເພດ" />
        <Select
          value={f.filters.isRead}
          onChange={(e) => f.set("isRead", e.target.value)}
          options={[
            ["false", "ຍັງບໍ່ໄດ້ອ່ານ"],
            ["true", "ອ່ານແລ້ວ"],
          ]}
          empty="ທັງໝົດ"
        />
        {isStaff && <StudentSelect value={f.filters.studentId} onChange={(e) => f.set("studentId", e.target.value)} empty="ທຸກຄົນ" />}
      </FilterBar>

      {error && <ErrorBox error={error} onRetry={() => mutate()} />}
      <Card padded={false}>
        {isLoading && !data ? (
          <Loading />
        ) : !data?.data.length ? (
          <Empty text="ບໍ່ມີແຈ້ງການ" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.data.map((n) => {
              const unread = !Number(n.is_read);
              return (
                <li key={n.id} className={`flex gap-4 px-5 py-4 ${unread && isStudent ? "bg-brand-50/40" : ""}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {unread && isStudent && <span className="size-2 rounded-full bg-brand-600" />}
                      <p className="font-semibold text-slate-900">{n.title}</p>
                      <StatusBadge kind="ntype" value={n.type} />
                      {isStaff && (n.student_id ? <Badge>ສົ່ງຫາ ນ.ສ. #{n.student_id}</Badge> : <Badge tone="purple">ທຸກຄົນ</Badge>)}
                    </div>
                    <p className="mt-1 text-sm whitespace-pre-line text-slate-600">{n.message}</p>
                    <p className="mt-1 text-xs text-slate-400" title={datetime(n.created_at)}>
                      {timeAgo(n.created_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-start gap-1">
                    {unread && isStudent && (
                      <Button size="sm" variant="secondary" loading={busy === `r-${n.id}`} onClick={() => read(n)}>
                        ອ່ານແລ້ວ
                      </Button>
                    )}
                    {isAdmin && (
                      <Button size="sm" variant="ghost" loading={del.busy === `/notifications/${n.id}`} onClick={() => del.remove(`/notifications/${n.id}`, `ແຈ້ງການ "${n.title}"`, ["/notifications"])}>
                        <Trash2 className="size-3.5 text-red-600" />
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={f.setPage} />}
      </Card>

      {creating && <NotificationForm onClose={() => setCreating(false)} />}
    </>
  );
}

/** POST /api/notifications */
function NotificationForm({ onClose }: { onClose: () => void }) {
  const { busy, run } = useAction();
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const v = formValues(form);
    const body: Record<string, unknown> = {
      title: v.title,
      message: v.message,
      type: v.type,
      studentId: v.studentId ? Number(v.studentId) : null,
      sendEmail: (form.elements.namedItem("sendEmail") as HTMLInputElement).checked,
    };
    const r = await run("save", () => api.post<{ emailQueued: boolean }>("/notifications", body), {
      success: (res) => `ສົ່ງແຈ້ງການແລ້ວ${res.emailQueued ? " (ກຳລັງສົ່ງອີເມວ)" : ""}`,
      refresh: ["/notifications"],
    });
    if (r) onClose();
  };
  return (
    <Modal open title="ສ້າງແຈ້ງການ" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="ຫົວຂໍ້" required>
          <Input name="title" required maxLength={200} />
        </Field>
        <Field label="ຂໍ້ຄວາມ" required>
          <Textarea name="message" required maxLength={1000} rows={4} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="ປະເພດ">
            <Select name="type" options={opts(L.ntype)} defaultValue="info" />
          </Field>
          <Field label="ສົ່ງຫາ">
            <StudentSelect name="studentId" empty="📢 ນັກສຶກສາທຸກຄົນ" />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="sendEmail" className="size-4" /> ສົ່ງອີເມວນຳ (ຕ້ອງຕັ້ງ SMTP ຢູ່ backend)
        </label>
        <FormActions onCancel={onClose} loading={busy === "save"} submitText="ສົ່ງແຈ້ງການ" />
      </form>
    </Modal>
  );
}

