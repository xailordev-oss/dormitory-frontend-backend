"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, Search, ImageIcon } from "lucide-react";
import { api, qs, useApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useAction, useDelete, useFilters } from "@/lib/hooks";
import { L, opts } from "@/lib/labels";
import type { Paged, Student, User } from "@/lib/types";
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
  StatusBadge,
  Table,
  formValues,
} from "@/components/ui";
import { RoomSelect } from "@/components/pickers";
import { RoleGate } from "@/components/AppShell";
import { ImageGallery } from "@/components/ImageGallery";

/** GET /api/students (admin, staff) · POST/PUT/DELETE (admin) */
export default function StudentsPage() {
  return (
    <RoleGate roles={["admin", "staff"]}>
      <StudentsInner />
    </RoleGate>
  );
}

function StudentsInner() {
  const { isAdmin } = useAuth();
  const f = useFilters({ search: "", status: "", roomId: "", unlinked: "" });
  const [search, setSearch] = useState("");
  const { data, error, isLoading, mutate } = useApi<Paged<Student>>(`/students${qs({ ...f.filters, page: f.page, limit: 20 })}`);
  const [editing, setEditing] = useState<Student | "new" | null>(null);
  const [gallery, setGallery] = useState<Student | null>(null);
  const del = useDelete();

  return (
    <>
      <PageHeader
        title="ນັກສຶກສາ"
        description={data ? `ທັງໝົດ ${data.total} ຄົນ` : undefined}
        actions={
          isAdmin && (
            <Button onClick={() => setEditing("new")}>
              <Plus className="size-4" /> ເພີ່ມນັກສຶກສາ
            </Button>
          )
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
          <Input className="pl-9" placeholder="ຄົ້ນຫາ ຊື່ / ອີເມວ / ເບີໂທ (Enter)" value={search} onChange={(e) => setSearch(e.target.value)} />
        </form>
        <Select value={f.filters.status} onChange={(e) => f.set("status", e.target.value)} options={opts(L.student)} empty="ທຸກສະຖານະ" />
        <RoomSelect value={f.filters.roomId} onChange={(e) => f.set("roomId", e.target.value)} empty="ທຸກຫ້ອງ" />
        <Select value={f.filters.unlinked} onChange={(e) => f.set("unlinked", e.target.value)} options={[["true", "ຍັງບໍ່ຜູກບັນຊີ"]]} empty="ທັງໝົດ" />
      </FilterBar>

      {error && <ErrorBox error={error} onRetry={() => mutate()} />}
      <Card padded={false}>
        <Table
          loading={isLoading}
          rows={data?.data}
          columns={[
            {
              header: "ຊື່",
              cell: (s) => (
                <div className="flex items-center gap-3">
                  {s.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.avatar_url} alt="" className="size-8 rounded-full object-cover" />
                  ) : (
                    <span className="flex size-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold">{s.name.slice(0, 1)}</span>
                  )}
                  <div>
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs text-slate-500">{s.email}</p>
                  </div>
                </div>
              ),
            },
            { header: "ເບີໂທ", cell: (s) => s.phone ?? "—" },
            { header: "ຫ້ອງ", cell: (s) => (s.room_number ? `${s.room_number} · ${s.building_name ?? ""}` : "—") },
            { header: "ສະຖານະ", cell: (s) => <StatusBadge kind="student" value={s.status} /> },
            { header: "ບັນຊີ", cell: (s) => (s.user_id ? <Badge tone="green">ຜູກແລ້ວ</Badge> : <Badge tone="yellow">ຍັງບໍ່ຜູກ</Badge>) },
            {
              header: "",
              className: "text-right",
              cell: (s) => (
                <div className="flex justify-end gap-1">
                  <Link href={`/payments?studentId=${s.id}`}>
                    <Button size="sm" variant="secondary">
                      ບິນ
                    </Button>
                  </Link>
                  {isAdmin && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => setGallery(s)} title="ຮູບພາບ">
                        <ImageIcon className="size-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(s)} title="ແກ້ໄຂ">
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={del.busy === `/students/${s.id}`}
                        onClick={() => del.remove(`/students/${s.id}`, `ນັກສຶກສາ ${s.name}`, ["/students", "/rooms"])}
                        title="ລຶບ"
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

      {editing && <StudentForm student={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      <Modal open={!!gallery} title={`ຮູບພາບ · ${gallery?.name ?? ""}`} onClose={() => setGallery(null)} wide>
        {gallery && <ImageGallery entityType="students" entityId={gallery.id} />}
      </Modal>
    </>
  );
}

/** POST /api/students ຫຼື PUT /api/students/:id */
function StudentForm({ student, onClose }: { student: Student | null; onClose: () => void }) {
  const { busy, run } = useAction();
  // ບັນຊີ student ທີ່ຍັງບໍ່ໄດ້ຜູກກັບນັກສຶກສາຄົນໃດ (ໃຊ້ຜູກບັນຊີ)
  const users = useApi<Paged<User>>("/users?role=student&limit=200");
  const freeUsers = (users.data?.data ?? []).filter((u) => !u.student_id || u.id === student?.user_id);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const v = formValues(e.currentTarget);
    const body: Record<string, unknown> = {
      name: v.name,
      email: v.email,
      phone: v.phone || null,
      status: v.status,
      roomId: v.roomId ? Number(v.roomId) : null,
      userId: v.userId ? Number(v.userId) : null,
    };
    if (!student) {
      if (!body.phone) delete body.phone;
      if (!body.roomId) delete body.roomId;
      if (!body.userId) delete body.userId;
    }
    const r = await run("save", () => (student ? api.put(`/students/${student.id}`, body) : api.post("/students", body)), {
      refresh: ["/students", "/rooms", "/users"],
    });
    if (r) onClose();
  };

  return (
    <Modal open title={student ? `ແກ້ໄຂ: ${student.name}` : "ເພີ່ມນັກສຶກສາ"} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="ຊື່" required className="sm:col-span-2">
          <Input name="name" required maxLength={150} defaultValue={student?.name} />
        </Field>
        <Field label="ອີເມວ" required>
          <Input name="email" type="email" required defaultValue={student?.email} />
        </Field>
        <Field label="ເບີໂທ">
          <Input name="phone" maxLength={30} defaultValue={student?.phone ?? ""} />
        </Field>
        <Field label="ສະຖານະ">
          <Select name="status" options={opts(L.student)} defaultValue={student?.status ?? "active"} />
        </Field>
        <Field label="ຫ້ອງ" hint="ຫ້ອງຕ້ອງຍັງມີບ່ອນວ່າງ">
          <RoomSelect name="roomId" empty="— ບໍ່ມີຫ້ອງ —" defaultValue={student?.room_id ?? ""} />
        </Field>
        <Field label="ຜູກກັບບັນຊີຜູ້ໃຊ້" className="sm:col-span-2" hint="ໃຫ້ນັກສຶກສາ login ເບິ່ງບິນ/ຈອງຫ້ອງເອງໄດ້">
          <Select
            name="userId"
            empty="— ບໍ່ຜູກ —"
            defaultValue={student?.user_id ?? ""}
            options={freeUsers.map((u) => [u.id, `${u.name} (${u.email})`])}
          />
        </Field>
        <div className="sm:col-span-2">
          <FormActions onCancel={onClose} loading={busy === "save"} />
        </div>
      </form>
    </Modal>
  );
}
