"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/labels";
import type { Occupants, Room } from "@/lib/types";
import { Button, Card, Empty, ErrorBox, Loading, PageHeader, StatusBadge } from "@/components/ui";
import { BookingModal } from "@/components/pickers";
import { ImageGallery } from "@/components/ImageGallery";
import { EntityCover } from "@/components/RoomCover";

/** GET /api/rooms/:id + /occupants + /api/images/rooms/:id */
export default function RoomDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isStaff, isStudent, user } = useAuth();
  const { data, error, mutate } = useApi<{ data: Room }>(`/rooms/${id}`);
  const canSeeOccupants = isStaff || (isStudent && user?.room_id === Number(id));
  const occ = useApi<Occupants>(canSeeOccupants ? `/rooms/${id}/occupants` : null);
  const [booking, setBooking] = useState(false);

  if (error) return <ErrorBox error={error} onRetry={() => mutate()} />;
  if (!data) return <Loading />;
  const r = data.data;

  return (
    <>
      <Link href="/rooms" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" /> ກັບໄປລາຍການຫ້ອງ
      </Link>
      <PageHeader
        title={`ຫ້ອງ ${r.room_number}`}
        description={r.building_name ?? undefined}
        actions={
          r.isAvailable &&
          (isStaff || (isStudent && !user?.room_id)) && <Button onClick={() => setBooking(true)}>{isStaff ? "ຈອງແທນນັກສຶກສາ" : "ຈອງຫ້ອງນີ້"}</Button>
        }
      />

      <EntityCover entityType="rooms" entityId={r.id} className="mb-6 h-56 w-full rounded-xl border border-slate-200 sm:h-72" />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="ຂໍ້ມູນຫ້ອງ">
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">ສະຖານະ</dt>
              <dd>
                <StatusBadge kind="room" value={r.status} />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">ລາຄາ / ເດືອນ</dt>
              <dd className="font-semibold">{money(r.price)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">ຜູ້ພັກ / ຄວາມຈຸ</dt>
              <dd>{r.label}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">ບ່ອນວ່າງ</dt>
              <dd>{r.statusText}</dd>
            </div>
          </dl>
        </Card>

        <Card title="ຜູ້ພັກໃນຫ້ອງ" className="lg:col-span-2" padded={false}>
          {!canSeeOccupants ? (
            <p className="p-5 text-sm text-slate-500">ນັກສຶກສາເບິ່ງລາຍຊື່ຜູ້ພັກໄດ້ສະເພາະຫ້ອງຂອງຕົນເອງ</p>
          ) : !occ.data ? (
            occ.error ? <div className="p-5"><ErrorBox error={occ.error} /></div> : <Loading />
          ) : occ.data.data.length === 0 ? (
            <Empty text="ຍັງບໍ່ມີຜູ້ພັກ" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {occ.data.data.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-5 py-3">
                  {s.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.avatar_url} alt="" className="size-9 rounded-full object-cover" />
                  ) : (
                    <span className="flex size-9 items-center justify-center rounded-full bg-slate-100 font-semibold text-slate-600">{s.name.slice(0, 1)}</span>
                  )}
                  <div className="text-sm">
                    <p className="font-medium">{s.name}</p>
                    <p className="text-slate-500">
                      {s.email} {s.phone && `· ${s.phone}`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="lg:col-span-3">
          <ImageGallery entityType="rooms" entityId={r.id} />
        </div>
      </div>

      <BookingModal open={booking} room={r} onClose={() => setBooking(false)} />
    </>
  );
}
