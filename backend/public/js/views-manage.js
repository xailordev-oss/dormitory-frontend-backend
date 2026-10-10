/* ໜ້າສຳລັບ admin / staff: ນັກສຶກສາ, ການຈອງ, ການຊຳລະ, ຜູ້ມາຢ້ຽມ */
(function () {
  "use strict";
  const { html, raw, route, api, get, L, badge, table, pager, money, kip, date, field, options, qs, clean } = App;
  const STAFF = ["admin", "staff"];
  const roomLabel = (r) => `${r.building_name || ""} ${r.room_number} (${r.occupants}/${r.capacity})`;

  /* =============== ນັກສຶກສາ =============== */
  const stuCache = {};
  route("/students", STAFF, "ນັກສຶກສາ", async (q) => {
    const r = await get("/students" + qs({ search: q.search, status: q.status, unlinked: q.unlinked, page: q.page, limit: 25 }));
    r.data.forEach((s) => (stuCache[s.id] = s));
    const admin = App.isAdmin();
    const cols = [
      { h: "ຊື່", f: (s) => html`<b>${s.name}</b><br><span class="muted small">${s.email}</span>` },
      { h: "ເບີໂທ", f: (s) => s.phone || "—" },
      { h: "ຫ້ອງ", f: (s) => (s.room_number ? html`${s.building_name || ""} <b>${s.room_number}</b>` : html`<span class="muted">—</span>`) },
      { h: "ສະຖານະ", f: (s) => badge(L.student[s.status], s.status === "active" ? "active" : "inactive") },
      { h: "ບັນຊີເຂົ້າສູ່ລະບົບ", f: (s) => (s.user_id ? badge("ຜູກແລ້ວ", "active") : badge("ຍັງບໍ່ຜູກ", "pending")) },
    ];
    if (admin) cols.push({ h: "", f: (s) => html`<div class="row-actions"><button class="btn ghost sm" data-act="stu-edit" data-id="${s.id}">ແກ້ໄຂ</button><button class="btn ghost sm" data-act="stu-del" data-id="${s.id}">ລຶບ</button></div>` });
    return html`<div class="page-head"><div><h1>ນັກສຶກສາ</h1><p>ທັງໝົດ ${r.total} ຄົນ</p></div>
        ${admin ? html`<button class="btn" data-act="stu-add">+ ເພີ່ມນັກສຶກສາ</button>` : ""}</div>
      <form class="filters" data-form="filter" data-path="/students">
        <div><label>ຄົ້ນຫາ</label><input name="search" value="${q.search || ""}" placeholder="ຊື່ / ອີເມວ / ເບີໂທ"></div>
        <div><label>ສະຖານະ</label><select name="status">${options(Object.entries(L.student), q.status, "ທັງໝົດ")}</select></div>
        <label class="check"><input type="checkbox" name="unlinked" value="true" ${q.unlinked ? raw("checked") : ""}> ສະເພາະທີ່ຍັງບໍ່ຜູກບັນຊີ</label>
        <button class="btn ghost" type="submit">ຄົ້ນຫາ</button></form>
      ${table(cols, r.data, "ບໍ່ພົບນັກສຶກສາ")}${pager(r, "/students", q)}`;
  });
  const stuForm = async (s = {}) => {
    const [rooms, users] = await Promise.all([get("/rooms?limit=500"), get("/users?role=student&limit=200")]);
    const freeUsers = users.data.filter((u) => !u.student_id || u.student_id === s.id);
    return html`<form data-form="stu-save"><div class="form-error" role="alert"></div>
      <input type="hidden" name="id" value="${s.id || ""}">
      <div class="form-grid">
        ${field("ຊື່", html`<input name="name" value="${s.name || ""}" required maxlength="150">`)}
        ${field("ອີເມວ", html`<input name="email" type="email" value="${s.email || ""}" required>`)}
        ${field("ເບີໂທ", html`<input name="phone" value="${s.phone || ""}" maxlength="30">`)}
        ${field("ສະຖານະ", html`<select name="status">${options(Object.entries(L.student), s.status || "active")}</select>`)}
        ${field("ຫ້ອງພັກ", html`<select name="roomId">${options(rooms.data.map((r) => [r.id, roomLabel(r)]), s.room_id, "— ບໍ່ມີຫ້ອງ —")}</select>`, "ຖ້າຈະຈອງຫ້ອງ ໃຫ້ໃຊ້ໜ້າ 'ການຈອງ' (ມີອະນຸມັດ/ປະຫວັດ)")}
        ${field("ບັນຊີເຂົ້າສູ່ລະບົບ", html`<select name="userId">${options(freeUsers.map((u) => [u.id, `${u.name} (${u.email})`]), s.user_id, "— ບໍ່ຜູກ —")}</select>`, "ເລືອກບັນຊີຂອງນັກສຶກສາຄົນນີ້ ເພື່ອໃຫ້ເຂົາຈອງຫ້ອງ/ເບິ່ງບິນໄດ້")}
      </div>
      <div class="modal-foot"><button type="button" class="btn ghost" data-act="close-modal">ຍົກເລີກ</button><button class="btn" type="submit">ບັນທຶກ</button></div></form>`;
  };
  App.actions["stu-add"] = async () => App.modal("ເພີ່ມນັກສຶກສາ", await stuForm());
  App.actions["stu-edit"] = async (el) => App.modal("ແກ້ໄຂນັກສຶກສາ", await stuForm(stuCache[el.dataset.id]));
  App.forms["stu-save"] = async (d) => {
    const body = { name: d.name, email: d.email, phone: d.phone || null, status: d.status, roomId: d.roomId || null, userId: d.userId || null };
    if (d.id) await App.do("PUT", "/students/" + d.id, body, "ບັນທຶກຂໍ້ມູນນັກສຶກສາສຳເລັດ"); else await App.do("POST", "/students", body, "ເພີ່ມນັກສຶກສາສຳເລັດ");
  };
  App.actions["stu-del"] = async (el) => {
    const s = stuCache[el.dataset.id];
    if (!App.confirm(`ລຶບນັກສຶກສາ ${s.name} ?`)) return;
    try { await App.do("DELETE", "/students/" + s.id, undefined, "ລຶບນັກສຶກສາສຳເລັດ"); }
    catch (err) {
      if (err.status === 409 && /force/.test(err.message) && App.confirm(err.message + "\n\nຕ້ອງການລຶບແທ້ໆບໍ?")) await App.do("DELETE", `/students/${s.id}?force=true`, undefined, "ລຶບນັກສຶກສາສຳເລັດ");
      else throw err;
    }
  };

  /* =============== ການຈອງ =============== */
  route("/bookings", STAFF, "ການຈອງ", async (q) => {
    const r = await get("/bookings" + qs({ status: q.status, page: q.page, limit: 25 }));
    const cols = [
      { h: "#", f: (b) => b.id },
      { h: "ນັກສຶກສາ", f: (b) => html`<b>${b.student_name || b.student_id}</b>` },
      { h: "ຫ້ອງ", f: (b) => html`${b.building_name || ""} <b>${b.room_number}</b>` },
      { h: "ວັນເຂົ້າພັກ", f: (b) => date(b.check_in_date) },
      { h: "ວັນອອກ", f: (b) => date(b.check_out_date) },
      { h: "ສະຖານະ", f: (b) => badge(L.booking[b.status], b.status) },
      { h: "", f: (b) => html`<div class="row-actions">
        ${b.status === "pending" ? html`<button class="btn sm" data-act="bk-approve" data-id="${b.id}">ອະນຸມັດ</button>` : ""}
        ${b.status === "active" ? html`<button class="btn sm" data-act="bk-checkout" data-id="${b.id}">Check-out</button>` : ""}
        ${b.status === "pending" || b.status === "active" ? html`<button class="btn ghost sm" data-act="bk-cancel" data-id="${b.id}">ຍົກເລີກ</button>` : ""}
        ${App.isAdmin() ? html`<button class="btn ghost sm" data-act="bk-del" data-id="${b.id}">ລຶບ</button>` : ""}</div>` },
    ];
    return html`<div class="page-head"><div><h1>ການຈອງ</h1><p>ການຈອງໃໝ່ຈະເປັນ "ລໍຖ້າອະນຸມັດ" ຈົນກວ່າພະນັກງານຈະກົດອະນຸມັດ</p></div><button class="btn" data-act="bk-new">+ ຈອງແທນນັກສຶກສາ</button></div>
      <form class="filters" data-form="filter" data-path="/bookings">
        <div><label>ສະຖານະ</label><select name="status">${options(Object.entries(L.booking), q.status, "ທັງໝົດ")}</select></div>
        <button class="btn ghost" type="submit">ຄົ້ນຫາ</button></form>
      ${table(cols, r.data, "ຍັງບໍ່ມີການຈອງ")}${pager(r, "/bookings", q)}`;
  });
  App.actions["bk-approve"] = (el) => App.do("PATCH", `/bookings/${el.dataset.id}/approve`);
  App.actions["bk-checkout"] = async (el) => { if (App.confirm("ຢືນຢັນ check-out? ນັກສຶກສາຈະຖືກປົດອອກຈາກຫ້ອງ")) await App.do("PATCH", `/bookings/${el.dataset.id}/checkout`); };
  App.actions["bk-del"] = async (el) => { if (App.confirm("ລຶບການຈອງນີ້ຖາວອນ?")) await App.do("DELETE", "/bookings/" + el.dataset.id); };
  App.actions["bk-new"] = async () => {
    const [stu, rooms] = await Promise.all([get("/students?status=active&limit=200"), get("/rooms/available?limit=500")]);
    App.modal("ຈອງຫ້ອງແທນນັກສຶກສາ", html`<form data-form="bk-create"><div class="form-error" role="alert"></div>
      ${field("ນັກສຶກສາ", html`<select name="studentId" required>${options(stu.data.map((s) => [s.id, `${s.name} (${s.email})`]), "", "— ເລືອກນັກສຶກສາ —")}</select>`)}
      ${field("ຫ້ອງ (ສະເພາະຫ້ອງທີ່ຍັງຫວ່າງ)", html`<select name="roomId" required>${options(rooms.data.map((r) => [r.id, roomLabel(r)]), "", "— ເລືອກຫ້ອງ —")}</select>`)}
      ${field("ວັນທີເຂົ້າພັກ", html`<input type="date" name="checkInDate" value="${App.today()}" required>`)}
      <div class="modal-foot"><button type="button" class="btn ghost" data-act="close-modal">ຍົກເລີກ</button><button class="btn" type="submit">ຈອງຫ້ອງ</button></div></form>`);
  };
  App.forms["bk-create"] = (d) => App.do("POST", "/bookings", { studentId: d.studentId, roomId: d.roomId, checkInDate: d.checkInDate });

  /* =============== ການຊຳລະ =============== */
  route("/payments", STAFF, "ການຊຳລະ", async (q) => {
    const r = await get("/payments" + qs({ status: q.status, overdue: q.overdue, billingMonth: q.billingMonth, page: q.page, limit: 25 }));
    const admin = App.isAdmin();
    const cols = [...App.payCols(true),
      { h: "ວິທີ", f: (p) => (p.status === "paid" || p.status === "refunded" ? L.method[p.method] : "—") },
      { h: "", f: (p) => html`<div class="row-actions">
        ${p.status === "pending" || p.status === "failed" ? html`<button class="btn sm" data-act="pay-mark" data-id="${p.id}">ຮັບຊຳລະ</button>` : ""}
        <button class="btn ghost sm" data-act="doc" data-kind="invoice" data-id="${p.id}">ໃບແຈ້ງໜີ້</button>
        ${p.receipt_no ? html`<button class="btn ghost sm" data-act="doc" data-kind="receipt" data-id="${p.id}">ໃບຮັບເງິນ</button>` : ""}
        ${admin && p.status === "paid" ? html`<button class="btn ghost sm" data-act="pay-refund" data-id="${p.id}">ຄືນເງິນ</button>` : ""}</div>` },
    ];
    return html`<div class="page-head"><div><h1>ການຊຳລະ</h1></div>
        <div class="actions"><button class="btn" data-act="pay-new">+ ອອກບິນ / ບັນທຶກຮັບເງິນ</button>
        ${admin ? html`<button class="btn ghost" data-act="pay-monthly">ອອກບິນລາຍເດືອນ</button><button class="btn ghost" data-act="pay-remind">ແຈ້ງເຕືອນຄ້າງຊຳລະ</button>` : ""}</div></div>
      <div class="stats"><div class="stat good"><b>${kip(r.summary.totalPaid)}</b><span>ຊຳລະແລ້ວ (ກີບ) ຕາມເງື່ອນໄຂທີ່ເລືອກ</span></div>
        <div class="stat warn"><b>${kip(r.summary.totalPending)}</b><span>ຄ້າງຊຳລະ (ກີບ)</span></div>
        <div class="stat bad"><b>${kip(r.summary.totalOverdue)}</b><span>ເກີນກຳນົດ (ກີບ)</span></div></div>
      <form class="filters" data-form="filter" data-path="/payments">
        <div><label>ສະຖານະ</label><select name="status">${options(Object.entries(L.pay), q.status, "ທັງໝົດ")}</select></div>
        <div><label>ເດືອນທີ່ເກັບ</label><input type="month" name="billingMonth" value="${q.billingMonth || ""}"></div>
        <label class="check"><input type="checkbox" name="overdue" value="true" ${q.overdue ? raw("checked") : ""}> ສະເພາະທີ່ເກີນກຳນົດ</label>
        <button class="btn ghost" type="submit">ຄົ້ນຫາ</button></form>
      ${table(cols, r.data, "ບໍ່ພົບລາຍການຊຳລະ")}${pager(r, "/payments", q)}`;
  });

  App.actions["pay-new"] = async () => {
    const stu = await get("/students?status=active&limit=200");
    App.modal("ອອກບິນ / ບັນທຶກຮັບເງິນ", html`<form data-form="pay-create"><div class="form-error" role="alert"></div>
      <div class="form-grid">
        ${field("ນັກສຶກສາ", html`<select name="studentId" required>${options(stu.data.map((s) => [s.id, s.name]), "", "— ເລືອກ —")}</select>`)}
        ${field("ປະເພດ", html`<select name="type">${options(Object.entries(L.ptype), "rent")}</select>`)}
        ${field("ຈຳນວນເງິນ (ກີບ)", html`<input type="number" name="amount" min="1" step="any" required>`)}
        ${field("ວິທີຊຳລະ", html`<select name="method">${options(Object.entries(L.method), "cash")}</select>`)}
        ${field("ເດືອນທີ່ເກັບ", html`<input type="month" name="billingMonth">`, "ບໍ່ບັງຄັບ — ໃສ່ເພື່ອກັນອອກບິນເດືອນດຽວກັນຊ້ຳ")}
        ${field("ກຳນົດຊຳລະ", html`<input type="date" name="dueDate">`)}
        ${field("ບັນທຶກເປັນ", html`<select name="status"><option value="pending">ໃບແຈ້ງໜີ້ (ຄ້າງຊຳລະ)</option><option value="paid">ຮັບເງິນແລ້ວ</option></select>`)}
      </div>
      ${field("ຄຳອະທິບາຍ", html`<input name="description" maxlength="255" placeholder="ເຊັ່ນ ຄ່າເຊົ່າເດືອນ ຕຸລາ">`)}
      <div class="modal-foot"><button type="button" class="btn ghost" data-act="close-modal">ຍົກເລີກ</button><button class="btn" type="submit">ບັນທຶກ</button></div></form>`, { wide: true });
  };
  App.forms["pay-create"] = (d) => App.do("POST", "/payments", clean({ studentId: d.studentId, type: d.type, amount: d.amount, method: d.method, billingMonth: d.billingMonth, dueDate: d.dueDate, status: d.status, description: d.description }));

  App.actions["pay-mark"] = (el) => App.modal("ຮັບຊຳລະ", html`<form data-form="pay-mark"><div class="form-error" role="alert"></div>
    <input type="hidden" name="id" value="${el.dataset.id}">
    ${field("ຮັບຊຳລະດ້ວຍວິທີ", html`<select name="method">${options(Object.entries(L.method), "cash")}</select>`)}
    <div class="modal-foot"><button type="button" class="btn ghost" data-act="close-modal">ຍົກເລີກ</button><button class="btn" type="submit">ຢືນຢັນຮັບເງິນ</button></div></form>`);
  App.forms["pay-mark"] = (d) => App.do("PUT", `/payments/${d.id}/status`, { status: "paid", method: d.method });
  App.actions["pay-refund"] = async (el) => { if (App.confirm("ຢືນຢັນຄືນເງິນລາຍການນີ້? ຍ້ອນກັບບໍ່ໄດ້")) await App.do("PUT", `/payments/${el.dataset.id}/status`, { status: "refunded" }); };
  App.actions["pay-remind"] = async () => { if (App.confirm("ສົ່ງແຈ້ງເຕືອນໃຫ້ນັກສຶກສາທຸກຄົນທີ່ມີບິນເກີນກຳນົດ?")) await App.do("POST", "/payments/send-reminders"); };

  App.actions["pay-monthly"] = () => {
    const month = new Date().toISOString().slice(0, 7);
    App.modal("ອອກບິນຄ່າເຊົ່າລາຍເດືອນ", html`<form data-form="monthly"><div class="form-error" role="alert"></div>
      <p class="muted">ອອກບິນໃຫ້ນັກສຶກສາທຸກຄົນທີ່ພັກຢູ່ ດ້ວຍລາຄາຂອງຫ້ອງ. ຄົນທີ່ມີບິນເດືອນນັ້ນແລ້ວຈະຖືກຂ້າມ (ບໍ່ອອກຊ້ຳ).</p>
      <div class="form-grid">
        ${field("ເດືອນ", html`<input type="month" name="month" value="${month}" required>`)}
        ${field("ກຳນົດຊຳລະວັນທີ (1–28)", html`<input type="number" name="dueDay" min="1" max="28" value="5" required>`)}
      </div>
      <label class="check"><input type="checkbox" name="splitRoom"> ແບ່ງຄ່າຫ້ອງຕາມຈຳນວນຄົນໃນຫ້ອງ (ຖ້າບໍ່ຕິກ = ລາຄາຫ້ອງຄືຄ່າເຊົ່າຕໍ່ຄົນ)</label>
      <div id="monthly-result" class="notice info" hidden style="margin-top:14px"></div>
      <div class="modal-foot"><button type="button" class="btn ghost" data-act="close-modal">ຍົກເລີກ</button>
        <button type="button" class="btn ghost" data-act="monthly-preview">ເບິ່ງຕົວຢ່າງ</button><button class="btn" type="submit">ອອກບິນ</button></div></form>`);
  };
  const monthlyBody = (d, dryRun) => ({ month: d.month, dueDay: Number(d.dueDay), splitRoom: !!d.splitRoom, dryRun });
  App.actions["monthly-preview"] = async (el) => {
    const form = el.closest("form");
    const r = await api("POST", "/payments/generate-monthly", monthlyBody(App.formData(form), true));
    const box = form.querySelector("#monthly-result");
    box.hidden = false;
    box.textContent = `ຈະອອກບິນ ${r.created} ຄົນ ລວມ ${money(r.totalAmount)} (ຂ້າມ ${r.skipped} ຄົນທີ່ມີບິນແລ້ວ). ກຳນົດຊຳລະ ${r.dueDate}`;
  };
  App.forms.monthly = async (d) => {
    if (!App.confirm(`ອອກບິນເດືອນ ${d.month} ໃຫ້ນັກສຶກສາທຸກຄົນທີ່ພັກຢູ່?`)) return;
    await App.do("POST", "/payments/generate-monthly", monthlyBody(d, false));
  };

  /* =============== ຜູ້ມາຢ້ຽມ =============== */
  route("/visitors", STAFF, "ຜູ້ມາຢ້ຽມ", async (q) => {
    const [inside, hist, stu] = await Promise.all([
      get("/visitors/logs?status=checked_in&limit=100"),
      get("/visitors/logs" + qs({ status: "checked_out", page: q.page, limit: 15 })),
      get("/students?status=active&limit=200"),
    ]);
    const base = [
      { h: "ຊື່ແຂກ", f: (v) => html`<b>${v.visitor_name}</b><br><span class="muted small">${v.id_card_number || ""} ${v.phone || ""}</span>` },
      { h: "ມາຫາ", f: (v) => html`${v.student_name || "—"} ${v.room_number ? html`<span class="muted small">(ຫ້ອງ ${v.room_number})</span>` : ""}` },
      { h: "ຈຸດປະສົງ", f: (v) => v.purpose || "—" },
      { h: "ເຂົ້າ", f: (v) => App.datetime(v.check_in_time) },
    ];
    return html`<div class="page-head"><h1>ຜູ້ມາຢ້ຽມ</h1></div>
      <section class="section panel"><h2>ບັນທຶກແຂກເຂົ້າ</h2>
        <form data-form="visitor-in"><div class="form-error" role="alert"></div>
          <div class="form-grid">
            ${field("ຊື່ແຂກ", html`<input name="visitorName" required maxlength="150">`)}
            ${field("ເລກບັດປະຈຳຕົວ", html`<input name="idCardNumber" maxlength="50">`)}
            ${field("ເບີໂທ", html`<input name="phone" maxlength="30">`)}
            ${field("ມາຫານັກສຶກສາ", html`<select name="studentId">${options(stu.data.map((s) => [s.id, s.name]), "", "— ບໍ່ລະບຸ —")}</select>`)}
            ${field("ຈຸດປະສົງ", html`<input name="purpose" maxlength="255">`)}
          </div><button class="btn" type="submit">ບັນທຶກເຂົ້າ</button></form></section>
      <section class="section"><h2>ແຂກທີ່ຢູ່ໃນຫໍດຽວນີ້ (${inside.total})</h2>
        ${table([...base, { h: "", f: (v) => html`<button class="btn sm" data-act="visitor-out" data-id="${v.id}">ບັນທຶກອອກ</button>` }], inside.data, "ບໍ່ມີແຂກຢູ່ໃນຫໍ")}</section>
      <section class="section"><h2>ປະຫວັດ</h2>
        ${table([...base, { h: "ອອກ", f: (v) => App.datetime(v.check_out_time) }], hist.data, "ຍັງບໍ່ມີປະຫວັດ")}${pager(hist, "/visitors", q)}</section>`;
  });
  App.forms["visitor-in"] = (d) => App.do("POST", "/visitors/check-in", clean({ visitorName: d.visitorName, idCardNumber: d.idCardNumber, phone: d.phone, studentId: d.studentId, purpose: d.purpose }));
  App.actions["visitor-out"] = (el) => App.do("POST", "/visitors/check-out", { id: el.dataset.id });
})();
