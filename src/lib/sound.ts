"use client";

/**
 * ສຽງແຈ້ງເຕືອນ (ສ້າງດ້ວຍ Web Audio — ບໍ່ຕ້ອງມີໄຟລ໌ສຽງ)
 *
 * Browser ທຸກຕົວບລັອກສຽງຈົນກວ່າຜູ້ໃຊ້ຈະກົດ/ພິມຫຍັງໃນໜ້າເວັບ 1 ເທື່ອ (autoplay policy).
 * ໂມດູນນີ້ຈຶ່ງ "ປົດລັອກ" ສຽງທັນທີທີ່ຜູ້ໃຊ້ກົດຄັ້ງທຳອິດ (ເຊັ່ນ ກົດປຸ່ມ login)
 * ແລ້ວຫຼັງຈາກນັ້ນສຽງຈະດັງທຸກຄັ້ງທີ່ມີການຈອງ ຫຼື ແຈ້ງເຕືອນໃໝ່
 */

export type SoundKind = "booking" | "notify" | "urgent" | "success";

let ctx: AudioContext | null = null;
let ready = false;
const listeners = new Set<(ready: boolean) => void>();

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) return null;
  ctx ??= new AC();
  return ctx;
}

function setReady(v: boolean) {
  if (ready === v) return;
  ready = v;
  listeners.forEach((fn) => fn(v));
}

export const isSoundReady = () => ready;

export function onSoundReadyChange(fn: (ready: boolean) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** ປົດລັອກສຽງ — ຕ້ອງເອີ້ນຈາກ event ທີ່ຜູ້ໃຊ້ກົດເອງ */
export async function unlockSound() {
  const c = getCtx();
  if (!c) return false;
  try {
    if (c.state === "suspended") await c.resume();
    // ຫຼິ້ນສຽງງຽບ 1 ເທື່ອ (iOS Safari ຕ້ອງການ)
    const buf = c.createBuffer(1, 1, 22050);
    const src = c.createBufferSource();
    src.buffer = buf;
    src.connect(c.destination);
    src.start(0);
  } catch {
    /* ignore */
  }
  setReady(c.state === "running");
  return ready;
}

/** ຕິດຕັ້ງຕົວຟັງ: ກົດ/ພິມ/ແຕະ ຄັ້ງທຳອິດ → ປົດລັອກສຽງ */
export function installSoundUnlock() {
  if (typeof window === "undefined") return () => {};
  const events = ["pointerdown", "keydown", "touchstart"] as const;
  const handler = () => {
    void unlockSound().then((ok) => {
      if (ok) events.forEach((e) => window.removeEventListener(e, handler, true));
    });
  };
  events.forEach((e) => window.addEventListener(e, handler, true));
  // ບາງ browser ອະນຸຍາດໃຫ້ຫຼິ້ນໄດ້ເລີຍ (ເຄີຍໃຊ້ເວັບນີ້ມາກ່ອນ)
  const c = getCtx();
  if (c) {
    void c.resume().then(() => setReady(c.state === "running")).catch(() => {});
  }
  return () => events.forEach((e) => window.removeEventListener(e, handler, true));
}

/* ລຳດັບໂນດຂອງແຕ່ລະປະເພດ: [ຄວາມຖີ່ Hz, ເວລາເລີ່ມ (ວິນາທີ), ຍາວ (ວິນາທີ)] */
const PATTERNS: Record<SoundKind, { type: OscillatorType; gain: number; notes: [number, number, number][] }> = {
  // ການຈອງໃໝ່: ດີງ-ດອງ-ດີງ 3 ໂນດ ຊັດເຈນ
  booking: { type: "sine", gain: 0.45, notes: [[784, 0, 0.35], [1047, 0.18, 0.35], [1319, 0.36, 0.6]] },
  // ແຈ້ງເຕືອນທົ່ວໄປ: ດີງ-ດອງ
  notify: { type: "sine", gain: 0.4, notes: [[880, 0, 0.35], [1319, 0.16, 0.5]] },
  // ດ່ວນ: ບີບ ສາມເທື່ອ ດັງກວ່າ
  urgent: { type: "square", gain: 0.18, notes: [[988, 0, 0.14], [988, 0.2, 0.14], [988, 0.4, 0.14], [1319, 0.6, 0.35]] },
  // ສຳເລັດ (ການກະທຳຂອງຕົນເອງ): ສັ້ນ ແລະ ເບົາ
  success: { type: "sine", gain: 0.3, notes: [[1047, 0, 0.18], [1568, 0.1, 0.3]] },
};

export function playSound(kind: SoundKind = "notify") {
  const c = getCtx();
  if (!c) return;
  const run = () => {
    const p = PATTERNS[kind];
    const t0 = c.currentTime + 0.02;
    for (const [freq, start, dur] of p.notes) {
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = p.type;
      osc.frequency.value = freq;
      const t = t0 + start;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(p.gain, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g).connect(c.destination);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    }
  };
  try {
    if (c.state === "suspended") {
      void c.resume().then(() => {
        setReady(c.state === "running");
        if (c.state === "running") run();
      });
    } else {
      run();
    }
  } catch {
    /* ignore */
  }
}
