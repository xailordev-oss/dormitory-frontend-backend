"use client";

import { useState } from "react";
import { Plus, Search, KeyRound, Trash2, Power } from "lucide-react";
import { api, qs, useApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useAction, useDelete, useFilters } from "@/lib/hooks";
import { L, date, opts } from "@/lib/labels";
import type { Paged, Role, User } from "@/lib/types";
import {
  Badge,
  Button,
  Card,
  ErrorBox,
  Field,
  FilterBar,
  FormActions,
  Input,
  Modal,
  PageHeader,
  Pagination,
  Select,
  Table,
  formValues,
} from "@/components/ui";
import { RoleGate } from "@/components/AppShell";

const REFRESH = ["/users", "/students"];

/** /api/users — admin ເທົ່ານັ້ນ */
export default function UsersPage() {
  return (
    <RoleGate roles={["admin"]}>
      <UsersInner />
    </RoleGate>
  );
}

function UsersInner() {
  const { user: me } = useAuth();
  const f = useFilters({ role: "", isActive: "", search: "" });
  const [search, setSearch] = useState("");
  const { data, error, isLoading, mutate } = useApi<Paged<User>>(`/users${qs({ ...f.filters, page: f.page, limit: 20 })}`);
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState<User | null>(null);
  const { busy, run } = useAction();
  const del = useDelete();

  const changeRole = (u: User, role: Role) => run(`r-${u.id}`, () => api.patch(`/users/${u.id}/role`, { role }), { refresh: REFRESH });
  const toggle = (u: User) =>
    run(`s-${u.id}`, () => api.patch(`/users/${u.id}/status`, { isActive: !Number(u.is_active) }), { refresh: REFRESH });

  return (
    <>
      <PageHeader
        title="ຜູ້ໃຊ້ລະບົບ"
        description="ສ້າງບັນຊີ, ປ່ຽນບົດບາດ, ເປີດ/ປິດ ແລະ ຕັ້ງລະຫັດຜ່ານໃໝ່"
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" /> ສ້າງບັນຊີ
          </Button>
        }
      />
      <FilterBar>
        <form
          className="relative sm:col-span-2"
          onSubmit={(e) => {
            e.preventDefault();
            f.set("search", search);
          }}
        >
          <Search className="absolute top-2.5 left-3 size-4 text-slate-400" />
          <Input className="pl-9" placeholder="ຄົ້ນຫາ ຊື່ / ອີເມວ (Enter)" value={search} onChange={(e) => setSearch(e.target.value)} />
        </form>
        <Select value={f.filters.role} onChange={(e) => f.set("role", e.target.value)} options={opts(L.role)} empty="ທຸກບົດບາດ" />
        <Select
          value={f.filters.isActive}
          onChange={(e) => f.set("isActive", e.target.value)}
          options={[
            ["true", "ເປີດໃຊ້ງານ"],
            ["false", "ປິດໃຊ້ງານ"],
          ]}
          empty="ທຸກສະຖານະ"
        />
      </FilterBar>

      {error && <ErrorBox error={error} onRetry={() => mutate()} />}
      <Card padded={false}>
        <Table
          loading={isLoading}
          rows={data?.data}
          columns={[
            {
              header: "ຜູ້ໃຊ້",
              cell: (u) => (
                <div>
                  <p className="font-medium">
                    {u.name} {u.id === me?.id && <Badge tone="blue">ທ່ານ</Badge>}
                  </p>
                  <p className="text-xs text-slate-500">{u.email}</p>
                </div>
              ),
            },
            {
              header: "ບົດບາດ",
              cell: (u) => (
                <Select
                  className="!w-36 !py-1 text-xs"
                  value={u.role}
                  disabled={u.id === me?.id || busy === `r-${u.id}`}
                  onChange={(e) => changeRole(u, e.target.value as Role)}
                  options={opts(L.role)}
                />
              ),
            },
            { header: "ນັກສຶກສາ", cell: (u) => (u.student_id ? <Badge tone="green">#{u.student_id}</Badge> : "—") },
            { header: "ສະຖານະ", cell: (u) => (Number(u.is_active) ? <Badge tone="green">ເປີດໃຊ້ງານ</Badge> : <Badge tone="red">ປິດໃຊ້ງານ</Badge>) },
            { header: "ສ້າງເມື່ອ", cell: (u) => <span className="text-xs text-slate-500">{date(u.created_at)}</span> },
            {
              header: "",
              className: "text-right",
              cell: (u) => (
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" title="ຕັ້ງລະຫັດຜ່ານໃໝ່" onClick={() => setResetting(u)}>
                    <KeyRound className="size-3.5" />
                  </Button>
                  {u.id !== me?.id && (
                    <>
                      <Button size="sm" variant="ghost" title={Number(u.is_active) ? "ປິດໃຊ້ງານ" : "ເປີດໃຊ້ງານ"} loading={busy === `s-${u.id}`} onClick={() => toggle(u)}>
                        <Power className={`size-3.5 ${Number(u.is_active) ? "text-amber-600" : "text-emerald-600"}`} />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        title="ລຶບ"
                        loading={del.busy === `/users/${u.id}`}
                        onClick={() => del.remove(`/users/${u.id}`, `ບັນຊີ ${u.email}`, REFRESH)}
                      >
                        <Trash2 className="size-3.5 text-red-600" />
                      </Button>
                    </>
                  )}
                </div>
              ),
            },
          ]}
        />
        {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={f.setPage} />}
      </Card>

      {creating && <UserForm onClose={() => setCreating(false)} />}
      {resetting && <ResetPasswordForm user={resetting} onClose={() => setResetting(null)} />}
    </>
  );
}

/** POST /api/users */
function UserForm({ onClose }: { onClose: () => void }) {
  const { busy, run } = useAction();
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const v = formValues(e.currentTarget);
    const body: Record<string, unknown> = { name: v.name, email: v.email, password: v.password, role: v.role };
    if (v.phone) body.phone = v.phone;
    const r = await run("save", () => api.post("/users", body), { refresh: REFRESH });
    if (r) onClose();
  };
  return (
    <Modal open title="ສ້າງບັນຊີຜູ້ໃຊ້" onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="ຊື່" required className="sm:col-span-2">
          <Input name="name" required maxLength={150} />
        </Field>
        <Field label="ອີເມວ" required>
          <Input name="email" type="email" required />
        </Field>
        <Field label="ເບີໂທ">
          <Input name="phone" maxLength={30} />
        </Field>
        <Field label="ລະຫັດຜ່ານ" required hint="ຢ່າງໜ້ອຍ 8 ຕົວ">
          <Input name="password" type="password" required minLength={8} autoComplete="new-password" />
        </Field>
        <Field label="ບົດບາດ" required hint="student = ສ້າງຂໍ້ມູນນັກສຶກສາໃຫ້ນຳ">
          <Select name="role" options={opts(L.role)} defaultValue="staff" />
        </Field>
        <div className="sm:col-span-2">
          <FormActions onCancel={onClose} loading={busy === "save"} />
        </div>
      </form>
    </Modal>
  );
}

/** PATCH /api/users/:id/password */
function ResetPasswordForm({ user, onClose }: { user: User; onClose: () => void }) {
  const { busy, run } = useAction();
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const r = await run("save", () => api.patch(`/users/${user.id}/password`, { newPassword: formValues(e.currentTarget).newPassword }));
    if (r) onClose();
  };
  return (
    <Modal open title={`ຕັ້ງລະຫັດຜ່ານໃໝ່: ${user.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="ລະຫັດຜ່ານໃໝ່" required hint="ຢ່າງໜ້ອຍ 8 ຕົວ · ຜູ້ໃຊ້ຕ້ອງ login ໃໝ່">
          <Input name="newPassword" type="password" required minLength={8} autoComplete="new-password" autoFocus />
        </Field>
        <FormActions onCancel={onClose} loading={busy === "save"} />
      </form>
    </Modal>
  );
}
