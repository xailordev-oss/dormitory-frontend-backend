"use client";

import { useState } from "react";
import { api, useApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useAction } from "@/lib/hooks";
import { money, today } from "@/lib/labels";
import type { Building, Paged, Room, Student } from "@/lib/types";
import { Field, FormActions, Input, Modal, Select, formValues } from "./ui";

/* ຕົວເລືອກທີ່ດຶງຂໍ້ມູນຈາກ API ມາສະແດງເປັນ <select> */

export function BuildingSelect(props: React.SelectHTMLAttributes<HTMLSelectElement> & { empty?: string }) {
  const { data } = useApi<{ data: Building[] }>("/buildings");
  return <Select {...props} options={(data?.data ?? []).map((b) => [b.id, b.name])} />;
}

export function RoomSelect({ onlyAvailable, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { empty?: string; onlyAvailable?: boolean }) {
  const { data } = useApi<Paged<Room>>(onlyAvailable ? "/rooms/available?limit=500" : "/rooms?limit=500");
  return (
    <Select
      {...props}
      options={(data?.data ?? []).map((r) => [r.id, `${r.room_number} · ${r.building_name ?? ""} (${r.label}) ${money(r.price)}`])}
    />
  );
}

export function StudentSelect(props: React.SelectHTMLAttributes<HTMLSelectElement> & { empty?: string }) {
  const { data } = useApi<Paged<Student>>("/students?status=active&limit=200");
  return (
    <Select
      {...props}
      options={(data?.data ?? []).map((s) => [s.id, `${s.name} (${s.email})${s.room_number ? ` · ຫ້ອງ ${s.room_number}` : ""}`])}
    />
  );
}

/**
 * ຟອມຈອງຫ້ອງ — POST /api/bookings
 * student: ຈອງໃຫ້ຕົນເອງ | admin/staff: ຕ້ອງເລືອກນັກສຶກສາ (ຈອງແທນ)
 */
export function BookingModal({ open, onClose, room }: { open: boolean; onClose: () => void; room?: Room | null }) {
  const { isStaff, reload } = useAuth();
  const { busy, run } = useAction();
  const [roomId, setRoomId] = useState<string>("");

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const v = formValues(e.currentTarget);
    const body: Record<string, unknown> = {
      roomId: Number(room?.id ?? v.roomId),
      checkInDate: v.checkInDate,
    };
    if (isStaff) body.studentId = Number(v.studentId);
    const r = await run("book", () => api.post("/bookings", body), {
      success: isStaff ? "ຈອງແທນນັກສຶກສາສຳເລັດ (ນັກສຶກສາໄດ້ຮັບແຈ້ງເຕືອນແລ້ວ)" : "ສົ່ງຄຳຂໍຈອງແລ້ວ — ລໍຖ້າພະນັກງານອະນຸມັດ",
      refresh: ["/bookings", "/rooms", "/reports", "/students"],
    });
    if (r) {
      if (!isStaff) await reload(); // ຫ້ອງຂອງນັກສຶກສາປ່ຽນ
      onClose();
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={room ? `ຈອງຫ້ອງ ${room.room_number}` : "ຈອງຫ້ອງ"}>
      <form onSubmit={submit} className="space-y-4">
        {room ? (
          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            <p className="font-medium">
              ຫ້ອງ {room.room_number} · {room.building_name}
            </p>
            <p className="text-slate-500">
              {money(room.price)} / ເດືອນ · {room.statusText}
            </p>
          </div>
        ) : (
          <Field label="ຫ້ອງ" required>
            <RoomSelect name="roomId" required empty="-- ເລືອກຫ້ອງທີ່ວ່າງ --" onlyAvailable value={roomId} onChange={(e) => setRoomId(e.target.value)} />
          </Field>
        )}
        {isStaff && (
          <Field label="ນັກສຶກສາ" required>
            <StudentSelect name="studentId" required empty="-- ເລືອກນັກສຶກສາ --" />
          </Field>
        )}
        <Field label="ວັນເຂົ້າພັກ" required>
          <Input type="date" name="checkInDate" required defaultValue={today()} />
        </Field>
        <FormActions onCancel={onClose} loading={busy === "book"} submitText="ຢືນຢັນການຈອງ" />
      </form>
    </Modal>
  );
}
