/* ໜ້າທີ່ໃຊ້ຮ່ວມກັນ: ເຂົ້າສູ່ລະບົບ, ໜ້າຫຼັກ, ຫ້ອງພັກ, ແຈ້ງການ, ໂປຣໄຟລ໌, ການຈອງ/ການຊຳລະຂອງນັກສຶກສາ */
(function () {
  "use strict";
  const { html, raw, route, api, get, L, badge, table, pager, money, kip, date, field, options, qs, clean } = App;
  const ALL = ["admin", "staff", "student"];
  const STAFF = ["admin", "staff"];
  const today = () => new Date().toISOString().slice(0, 10);
  App.today = today;

  /* =============== ເຂົ້າສູ່ລະບົບ / ສະໝັກ / ລືມລະຫັດຜ່ານ =============== */
  const authPage = (title, sub, form, links) => html`
    <div class="auth">
      <section class="auth-art">
        <div class="brand"><span class="brand-mark">ຫ</span>ລະບົບຈັດການຫໍພັກ</div>
        <h1>ຫ້ອງພັກ ນັກສຶກສາ ການຊຳລະ<br>ຢູ່ບ່ອນດຽວ</h1>
        <p>ຈອງຫ້ອງ, ຕິດຕາມຄ່າເຊົ່າ, ແຈ້ງສ້ອມແປງ ແລະ ຮັບແຈ້ງການຈາກຫໍພັກ.</p>
        <div class="rooms-demo" aria-hidden="true">
          <div class="key">A101<small><i class="f"></i><i class="f"></i><i></i><i></i></small></div>
          <div class="key">B204<small><i class="f"></i><i class="f"></i><i class="f"></i><i class="f"></i></small></div>
        </div>
      </section>
      <section class="auth-form">
        <h1>${title}</h1><p class="muted">${sub}</p>
        ${form}
        <div class="links">${links}</div>
      </section>
    </div>`;

  route("/login", null, "ເຂົ້າສູ່ລະບົບ", async () => authPage("ເຂົ້າສູ່ລະບົບ", "ໃຊ້ອີເມວ ແລະ ລະຫັດຜ່ານຂອງທ່ານ", html`
    <form data-form="login" novalidate><div class="form-error" role="alert"></div>
      ${field("ອີເມວ", html`<input name="email" type="email" autocomplete="username" required>`)}
      ${field("ລະຫັດຜ່ານ", html`<input name="password" type="password" autocomplete="current-password" required>`)}
      <button class="btn" type="submit">ເຂົ້າສູ່ລະບົບ</button>
    </form>`, html`<a href="#/register">ສະໝັກບັນຊີນັກສຶກສາ</a><a href="#/forgot">ລືມລະຫັດຜ່ານ?</a>`));
  App.forms.login = async (d) => {
    const r = await api("POST", "/auth/login", { email: d.email, password: d.password });
    App.tokens.set(r.accessToken, r.refreshToken);
    App.me = (await get("/auth/me")).data;
    location.hash = "#/";
  };

  route("/register", null, "ສະໝັກບັນຊີ", async () => authPage("ສະໝັກບັນຊີນັກສຶກສາ", "ສະໝັກແລ້ວຈອງຫ້ອງໄດ້ທັນທີ", html`
    <form data-form="register" novalidate><div class="form-error" role="alert"></div>
      ${field("ຊື່-ນາມສະກຸນ", html`<input name="name" required maxlength="150">`)}
      ${field("ອີເມວ", html`<input name="email" type="email" required>`)}
      ${field("ເບີໂທ (ບໍ່ບັງຄັບ)", html`<input name="phone" inputmode="tel" maxlength="30">`)}
      ${field("ລະຫັດຜ່ານ", html`<input name="password" type="password" minlength="8" autocomplete="new-password" required>`, "ຢ່າງໜ້ອຍ 8 ຕົວອັກສອນ")}
      ${field("ຢືນຢັນລະຫັດຜ່ານ", html`<input name="confirm" type="password" autocomplete="new-password" required>`)}
      <button class="btn" type="submit">ສະໝັກບັນຊີ</button>
    </form>`, html`<a href="#/login">ມີບັນຊີແລ້ວ? ເຂົ້າສູ່ລະບົບ</a>`));
  App.forms.register = async (d) => {
    if (d.password !== d.confirm) throw new Error("ລະຫັດຜ່ານທັງສອງຊ່ອງບໍ່ຕົງກັນ");
    const r = await api("POST", "/auth/register", clean({ name: d.name, email: d.email, phone: d.phone, password: d.password }));
    App.toast(r.message, "ok");
    location.hash = "#/login";
  };

  route("/forgot", null, "ລືມລະຫັດຜ່ານ", async () => authPage("ລືມລະຫັດຜ່ານ", "ປ້ອນອີເມວ ເຮົາຈະສົ່ງລິ້ງຕັ້ງລະຫັດໃໝ່ໃຫ້", html`
    <form data-form="forgot" novalidate><div class="form-error" role="alert"></div>
      ${field("ອີເມວ", html`<input name="email" type="email" required>`)}
      <button class="btn" type="submit">ສົ່ງລິ້ງຕັ້ງລະຫັດໃໝ່</button>
      <div id="forgot-result" class="notice info" hidden style="margin-top:16px"></div>
    </form>`, html`<a href="#/login">ກັບໄປເຂົ້າສູ່ລະບົບ</a>`));
  App.forms.forgot = async (d, form) => {
    const r = await api("POST", "/auth/forgot-password", { email: d.email });
    const box = form.querySelector("#forgot-result");
    box.hidden = false;
    box.textContent = r.message;
    if (r.resetLink) { // ມີສະເພາະຕອນ dev ທີ່ຍັງບໍ່ໄດ້ຕັ້ງ SMTP
      const a = document.createElement("a");
      a.href = "#/reset-password?token=" + encodeURIComponent(r.resetToken);
      a.textContent = " (ໂໝດພັດທະນາ) ກົດທີ່ນີ້ເພື່ອຕັ້ງລະຫັດໃໝ່";
      box.appendChild(a);
    }
  };

  route("/reset-password", null, "ຕັ້ງລະຫັດຜ່ານໃໝ່", async (q) => authPage("ຕັ້ງລະຫັດຜ່ານໃໝ່", "ຕັ້ງລະຫັດຜ່ານໃໝ່ຂອງທ່ານ", html`
    <form data-form="reset" novalidate><div class="form-error" role="alert"></div>
      <input type="hidden" name="token" value="${q.token || ""}">
      ${field("ລະຫັດຜ່ານໃໝ່", html`<input name="newPassword" type="password" minlength="8" autocomplete="new-password" required>`, "ຢ່າງໜ້ອຍ 8 ຕົວອັກສອນ")}
      ${field("ຢືນຢັນລະຫັດຜ່ານ", html`<input name="confirm" type="password" autocomplete="new-password" required>`)}
      <button class="btn" type="submit">ບັນທຶກລະຫັດໃໝ່</button>
    </form>`, html`<a href="#/login">ກັບໄປເຂົ້າສູ່ລະບົບ</a>`));
  App.forms.reset = async (d) => {
    if (d.newPassword !== d.confirm) throw new Error("ລະຫັດຜ່ານທັງສອງຊ່ອງບໍ່ຕົງກັນ");
    const r = await api("POST", "/auth/reset-password", { token: d.token, newPassword: d.newPassword });
    App.toast(r.message, "ok");
    location.hash = "#/login";
  };

  /* =============== ໜ້າຫຼັກ =============== */
  const stat = (value, label, href, tone) =>
    href ? html`<a class="stat ${tone || ""}" href="#${href}"><b>${value}</b><span>${label}</span></a>` : html`<div class="stat ${tone || ""}"><b>${value}</b><span>${label}</span></div>`;

  const staffHome = async () => {
    const d = (await get("/reports/dashboard")).data;
    const todo = [];
    if (d.bookings.pending) todo.push(html`<li><a href="#/bookings?status=pending">ມີການຈອງລໍຖ້າອະນຸມັດ ${d.bookings.pending} ລາຍການ</a></li>`);
    if (d.payments.overdueCount) todo.push(html`<li><a href="#/payments?overdue=true">ມີບິນເກີນກຳນົດ ${d.payments.overdueCount} ລາຍການ ລວມ ${money(d.payments.overdueAmount)}</a></li>`);
    if (d.maintenance.openUrgent) todo.push(html`<li><a href="#/maintenance?priority=urgent">ມີວຽກສ້ອມແປງດ່ວນທີ່ຍັງເປີດຢູ່ ${d.maintenance.openUrgent} ລາຍການ</a></li>`);
    if (d.students.unlinked) todo.push(html`<li><a href="#/students?unlinked=true">ມີນັກສຶກສາ ${d.students.unlinked} ຄົນທີ່ຍັງບໍ່ໄດ້ຜູກກັບບັນຊີເຂົ້າສູ່ລະບົບ</a></li>`);
    return html`
      <div class="page-head"><div><h1>ພາບລວມຫໍພັກ</h1><p>ສະຖານະວັນນີ້ ${date(new Date().toISOString())}</p></div></div>
      <div class="stats">
        ${stat(d.rooms.occupancyRate + "%", "ອັດຕາການເຂົ້າພັກ", "/rooms")}
        ${stat(d.rooms.occupants + " / " + d.rooms.beds, "ຜູ້ພັກ / ບ່ອນນອນທັງໝົດ", "/students")}
        ${stat(d.rooms.availableBeds, "ບ່ອນນອນຫວ່າງ", "/rooms?hasVacancy=true", "good")}
        ${stat(d.rooms.maintenance, "ຫ້ອງທີ່ກຳລັງສ້ອມ", "/rooms?status=maintenance", d.rooms.maintenance ? "warn" : "")}
      </div>
      <div class="stats">
        ${stat(kip(d.payments.revenueThisMonth), "ລາຍຮັບເດືອນນີ້ (ກີບ)", "/payments?status=paid", "good")}
        ${stat(kip(d.payments.pendingAmount), "ຍອດຄ້າງຊຳລະ (ກີບ, " + d.payments.pendingCount + " ລາຍການ)", "/payments?status=pending", d.payments.pendingCount ? "warn" : "")}
        ${stat(d.payments.overdueCount, "ບິນເກີນກຳນົດ", "/payments?overdue=true", d.payments.overdueCount ? "bad" : "")}
        ${stat(d.maintenance.open, "ວຽກສ້ອມແປງທີ່ຍັງເປີດ", "/maintenance", d.maintenance.openUrgent ? "bad" : "")}
        ${stat(d.visitors.inside, "ແຂກທີ່ຢູ່ໃນຫໍດຽວນີ້", "/visitors")}
      </div>
      <section class="section"><h2>ສິ່ງທີ່ຕ້ອງຈັດການ</h2>
        ${todo.length ? html`<ul class="list-plain">${todo}</ul>` : html`<div class="empty">ບໍ່ມີວຽກຄ້າງ ທຸກຢ່າງຮຽບຮ້ອຍ</div>`}
      </section>`;
  };

  const studentHome = async () => {
    const me = (await get("/auth/me")).data;
    App.me = me;
    if (!me.student_id) {
      return html`<div class="page-head"><h1>ສະບາຍດີ ${me.name}</h1></div>
        <div class="notice">ບັນຊີຂອງທ່ານຍັງບໍ່ໄດ້ຖືກເຊື່ອມກັບຂໍ້ມູນນັກສຶກສາ ກະລຸນາຕິດຕໍ່ພະນັກງານຫໍພັກ.</div>`;
    }
    const [pay, notes] = await Promise.all([get(`/payments/student/${me.student_id}?limit=1`), get("/notifications?limit=4")]);
    return html`
      <div class="page-head"><div><h1>ສະບາຍດີ ${me.name}</h1></div></div>
      ${me.room_id ? html`<div class="stats">
          ${stat(me.room_number, "ຫ້ອງຂອງທ່ານ (" + (me.building_name || "") + ")", "/rooms")}
          ${stat(kip(pay.totalPending), "ຍອດຄ້າງຊຳລະ (ກີບ)", "/my-payments", pay.totalPending ? "warn" : "")}
          ${stat(kip(pay.totalOverdue), "ເກີນກຳນົດ (ກີບ)", "/my-payments", pay.totalOverdue ? "bad" : "")}
          ${stat(notes.unread, "ແຈ້ງການທີ່ຍັງບໍ່ໄດ້ອ່ານ", "/notifications", notes.unread ? "warn" : "")}
        </div>`
        : html`<div class="notice info">ທ່ານຍັງບໍ່ມີຫ້ອງພັກ. <a href="#/rooms?hasVacancy=true">ເບິ່ງຫ້ອງທີ່ຍັງຫວ່າງ ແລະ ຈອງ</a></div>`}
      <section class="section"><h2>ແຈ້ງການຫຼ້າສຸດ</h2>
        ${notes.data.length ? html`<ul class="list-plain">${notes.data.map((n) => html`<li class="${n.is_read ? "" : "unread"}"><b>${n.title}</b><br><span class="muted small">${n.message}</span></li>`)}</ul>` : html`<div class="empty">ຍັງບໍ່ມີແຈ້ງການ</div>`}
      </section>`;
  };
  route("/", ALL, "ໜ້າຫຼັກ", async () => (App.isStaff() ? staffHome() : studentHome()));

  /* =============== ຫ້ອງພັກ =============== */
  const roomCache = {};
  const roomTile = (r) => {
    roomCache[r.id] = r;
    const beds = Array.from({ length: r.capacity }, (_, i) => html`<span class="bed ${i < r.occupants ? "filled" : ""}"></span>`);
    return html`<article class="room st-${r.status}">
      <div class="room-no">${r.room_number}</div>
      <div class="room-meta">${r.building_name || ""}</div>
      <div class="beds" aria-label="ມີຄົນພັກ ${r.occupants} ຈາກ ${r.capacity}">${beds}</div>
      <div class="small">${r.statusText}</div>
      <div class="room-price">${money(r.price)} <span class="muted small">/ເດືອນ</span></div>
      <div class="actions">
        ${!App.isStaff() && r.isAvailable ? html`<button class="btn sm" data-act="room-book" data-id="${r.id}">ຈອງຫ້ອງ</button>` : ""}
        ${App.isStaff() ? html`<button class="btn ghost sm" data-act="room-occ" data-id="${r.id}">ຜູ້ພັກ</button>` : ""}
        ${App.isAdmin() ? html`<button class="btn ghost sm" data-act="room-edit" data-id="${r.id}">ແກ້ໄຂ</button><button class="btn ghost sm" data-act="room-del" data-id="${r.id}">ລຶບ</button>` : ""}
      </div></article>`;
  };

  route("/rooms", ALL, "ຫ້ອງພັກ", async (q) => {
    const [buildings, rooms] = await Promise.all([get("/buildings"), get("/rooms" + qs({ buildingId: q.buildingId, status: q.status, hasVacancy: q.hasVacancy, page: q.page, limit: 48 }))]);
    App.buildingsCache = buildings.data;
    const s = rooms.summary;
    return html`
      <div class="page-head"><div><h1>ຫ້ອງພັກ</h1><p>ຈຸດວົງມົນແຕ່ລະອັນຄືບ່ອນນອນ — ຈຸດເຕັມ = ມີຄົນພັກແລ້ວ. ບ່ອນຫວ່າງທັງໝົດ ${s.totalVacancy} ບ່ອນ</p></div>
        <div class="actions">${App.isAdmin() ? html`<button class="btn" data-act="room-add">+ ເພີ່ມຫ້ອງ</button>` : ""}</div></div>
      <form class="filters" data-form="filter" data-path="/rooms">
        <div><label>ຕຶກ</label><select name="buildingId">${options(buildings.data.map((b) => [b.id, b.name]), q.buildingId, "ທຸກຕຶກ")}</select></div>
        <div><label>ສະຖານະ</label><select name="status">${options(Object.entries(L.room), q.status, "ທັງໝົດ")}</select></div>
        <label class="check"><input type="checkbox" name="hasVacancy" value="true" ${q.hasVacancy ? raw("checked") : ""}> ສະເພາະຫ້ອງທີ່ຍັງຫວ່າງ</label>
        <button class="btn ghost" type="submit">ຄົ້ນຫາ</button>
      </form>
      ${rooms.data.length ? html`<div class="rooms">${rooms.data.map(roomTile)}</div>` : html`<div class="empty">ບໍ່ພົບຫ້ອງທີ່ກົງເງື່ອນໄຂ</div>`}
      ${pager(rooms, "/rooms", q)}`;
  });

  const roomForm = (r = {}) => {
    const bs = (App.buildingsCache || []).map((b) => [b.id, b.name]);
    return html`<form data-form="room-save"><div class="form-error" role="alert"></div>
      <input type="hidden" name="id" value="${r.id || ""}">
      <div class="form-grid">
        ${field("ເລກຫ້ອງ", html`<input name="roomNumber" value="${r.room_number || ""}" required maxlength="50">`)}
        ${field("ຕຶກ", html`<select name="buildingId" required>${options(bs, r.building_id, "— ເລືອກຕຶກ —")}</select>`)}
        ${field("ຄວາມຈຸ (1–4 ຄົນ)", html`<input name="capacity" type="number" min="1" max="4" value="${r.capacity || 4}" required>`)}
        ${field("ລາຄາ/ຄົນ/ເດືອນ (ກີບ)", html`<input name="price" type="number" min="1" step="any" value="${r.price || ""}" required>`)}
        ${field("ສະຖານະ", html`<select name="status">${options(Object.entries(L.room), r.status || "available")}</select>`)}
      </div>
      <div class="modal-foot"><button type="button" class="btn ghost" data-act="close-modal">ຍົກເລີກ</button><button class="btn" type="submit">ບັນທຶກ</button></div>
    </form>`;
  };
  App.actions["room-add"] = () => App.modal("ເພີ່ມຫ້ອງ", roomForm());
  App.actions["room-edit"] = (el) => App.modal("ແກ້ໄຂຫ້ອງ " + roomCache[el.dataset.id].room_number, roomForm(roomCache[el.dataset.id]));
  App.forms["room-save"] = async (d) => {
    const body = { roomNumber: d.roomNumber, buildingId: d.buildingId, capacity: d.capacity, price: d.price, status: d.status };
    if (d.id) await App.do("PUT", "/rooms/" + d.id, body, "ບັນທຶກຫ້ອງສຳເລັດ"); else await App.do("POST", "/rooms", body, "ເພີ່ມຫ້ອງສຳເລັດ");
  };
  App.actions["room-del"] = async (el) => {
    const r = roomCache[el.dataset.id];
    if (!App.confirm(`ລຶບຫ້ອງ ${r.room_number} ?`)) return;
    try { await App.do("DELETE", "/rooms/" + r.id, undefined, "ລຶບຫ້ອງສຳເລັດ"); }
    catch (err) {
      if (err.status === 409 && /force/.test(err.message) && App.confirm(err.message + "\n\nຕ້ອງການລຶບແທ້ໆບໍ?")) await App.do("DELETE", `/rooms/${r.id}?force=true`, undefined, "ລຶບຫ້ອງສຳເລັດ");
      else throw err;
    }
  };
  App.actions["room-occ"] = async (el) => {
    const r = roomCache[el.dataset.id];
    const o = await get(`/rooms/${r.id}/occupants`);
    App.modal(`ຜູ້ພັກຫ້ອງ ${r.room_number} (${o.label})`, o.data.length
      ? table([{ h: "ຊື່", f: (s) => s.name }, { h: "ອີເມວ", f: (s) => s.email }, { h: "ເບີໂທ", f: (s) => s.phone || "—" }], o.data)
      : html`<div class="empty">ຫ້ອງນີ້ຍັງບໍ່ມີຜູ້ພັກ</div>`);
  };
  App.actions["room-book"] = (el) => {
    const r = roomCache[el.dataset.id];
    App.modal("ຈອງຫ້ອງ " + r.room_number, html`<form data-form="book"><div class="form-error" role="alert"></div>
      <p>${r.building_name} · ${money(r.price)}/ເດືອນ · ${r.statusText}</p>
      <input type="hidden" name="roomId" value="${r.id}">
      ${field("ວັນທີເຂົ້າພັກ", html`<input type="date" name="checkInDate" value="${today()}" min="${today()}" required>`, "ພະນັກງານຈະອະນຸມັດການຈອງຂອງທ່ານ")}
      <div class="modal-foot"><button type="button" class="btn ghost" data-act="close-modal">ຍົກເລີກ</button><button class="btn" type="submit">ຢືນຢັນການຈອງ</button></div></form>`);
  };
  App.forms.book = async (d) => {
    const r = await api("POST", "/bookings", { roomId: d.roomId, checkInDate: d.checkInDate });
    App.toast(r.message, "ok");
    App.closeModal();
    location.hash = "#/my-bookings";
  };

  /* =============== ການຈອງ / ການຊຳລະຂອງນັກສຶກສາ =============== */
  route("/my-bookings", ["student"], "ການຈອງຂອງຂ້ອຍ", async (q) => {
    const r = await get("/bookings" + qs({ page: q.page, limit: 20 }));
    return html`<div class="page-head"><h1>ການຈອງຂອງຂ້ອຍ</h1></div>
      ${table([
        { h: "ຫ້ອງ", f: (b) => html`<b>${b.room_number}</b> <span class="muted small">${b.building_name || ""}</span>` },
        { h: "ວັນເຂົ້າພັກ", f: (b) => date(b.check_in_date) },
        { h: "ວັນອອກ", f: (b) => date(b.check_out_date) },
        { h: "ສະຖານະ", f: (b) => badge(L.booking[b.status], b.status) },
        { h: "", f: (b) => (b.status === "pending" ? html`<button class="btn ghost sm" data-act="bk-cancel" data-id="${b.id}">ຍົກເລີກການຈອງ</button>` : "") },
      ], r.data, "ທ່ານຍັງບໍ່ເຄີຍຈອງຫ້ອງ")}${pager(r, "/my-bookings", q)}`;
  });
  App.actions["bk-cancel"] = async (el) => {
    if (App.confirm("ຍົກເລີກການຈອງນີ້?")) await App.do("PATCH", `/bookings/${el.dataset.id}/cancel`);
  };

  App.payBadge = (p) => (p.is_overdue && Number(p.is_overdue) ? badge("ເກີນກຳນົດ", "overdue") : badge(L.pay[p.status], p.status));
  const payCols = (staff) => [
    { h: "ລາຍການ", f: (p) => html`${p.description || L.ptype[p.type]}${staff ? html`<br><span class="muted small">${p.student_name || ""}</span>` : ""}` },
    { h: "ເລກບິນ", f: (p) => html`<span class="small num">${p.invoice_no || "—"}</span>` },
    { h: "ຈຳນວນ", cls: "right num", f: (p) => money(p.amount) },
    { h: "ກຳນົດຊຳລະ", f: (p) => date(p.due_date) },
    { h: "ສະຖານະ", f: (p) => App.payBadge(p) },
  ];
  App.payCols = payCols;

  route("/my-payments", ["student"], "ການຊຳລະ", async (q) => {
    const me = App.me;
    if (!me.student_id) return html`<div class="notice">ບັນຊີຍັງບໍ່ໄດ້ເຊື່ອມກັບຂໍ້ມູນນັກສຶກສາ</div>`;
    const r = await get(`/payments/student/${me.student_id}` + qs({ page: q.page, limit: 20 }));
    return html`<div class="page-head"><h1>ການຊຳລະຂອງຂ້ອຍ</h1></div>
      <div class="stats">${stat(kip(r.totalPending), "ຄ້າງຊຳລະ (ກີບ)", null, r.totalPending ? "warn" : "")}${stat(kip(r.totalOverdue), "ເກີນກຳນົດ (ກີບ)", null, r.totalOverdue ? "bad" : "")}${stat(kip(r.totalPaid), "ຊຳລະແລ້ວ (ກີບ)", null, "good")}</div>
      ${table([...payCols(false), { h: "ເອກະສານ", f: (p) => html`<div class="row-actions"><button class="btn ghost sm" data-act="doc" data-kind="invoice" data-id="${p.id}">ໃບແຈ້ງໜີ້</button>${p.receipt_no ? html`<button class="btn ghost sm" data-act="doc" data-kind="receipt" data-id="${p.id}">ໃບຮັບເງິນ</button>` : ""}</div>` }], r.data, "ຍັງບໍ່ມີລາຍການຊຳລະ")}
      ${pager(r, "/my-payments", q)}<p class="muted small">ກະລຸນາຊຳລະທີ່ຫ້ອງການຫໍພັກ ຫຼື ໂອນຕາມທີ່ພະນັກງານແຈ້ງ ແລ້ວແຈ້ງພະນັກງານເພື່ອບັນທຶກ.</p>`;
  });

  /* ໃບແຈ້ງໜີ້ / ໃບຮັບເງິນ (ພິມໄດ້) */
  App.actions.doc = async (el) => {
    const d = (await get(`/payments/${el.dataset.id}/${el.dataset.kind}`)).data;
    const isR = d.kind === "receipt";
    App.modal(isR ? "ໃບຮັບເງິນ" : "ໃບແຈ້ງໜີ້", html`
      <div class="doc">
        <h2>${isR ? "ໃບຮັບເງິນ" : "ໃບແຈ້ງໜີ້"} · ຫໍພັກ</h2>
        <div class="muted num">ເລກທີ ${d.documentNo || "—"}</div>
        <dl>
          <dt>ນັກສຶກສາ</dt><dd>${d.student ? d.student.name : "—"}</dd>
          <dt>ຫ້ອງ</dt><dd>${d.room ? `${d.room.roomNumber} (${d.room.buildingName || ""})` : "—"}</dd>
          <dt>ລາຍການ</dt><dd>${d.item.description || d.item.typeLabel}${d.item.billingMonth ? " · ເດືອນ " + d.item.billingMonth : ""}</dd>
          <dt>ວິທີຊຳລະ</dt><dd>${isR ? L.method[d.method] : "ຍັງບໍ່ໄດ້ຊຳລະ"}</dd>
          <dt>ອອກເມື່ອ</dt><dd>${App.datetime(d.issuedAt)}</dd>
          ${d.dueDate ? html`<dt>ກຳນົດຊຳລະ</dt><dd>${date(d.dueDate)}</dd>` : ""}
          ${d.paidAt ? html`<dt>ຊຳລະເມື່ອ</dt><dd>${App.datetime(d.paidAt)}</dd>` : ""}
          <dt>ສະຖານະ</dt><dd>${L.pay[d.status]}</dd>
        </dl>
        <div class="total"><span>ຈຳນວນເງິນ</span><span class="num">${money(d.amount)}</span></div>
      </div>
      <div class="modal-foot"><button class="btn ghost" data-act="close-modal">ປິດ</button><button class="btn" data-act="print">ພິມ</button></div>`, { wide: false });
  };

  /* =============== ແຈ້ງສ້ອມແປງ =============== */
  route("/maintenance", ALL, "ສ້ອມແປງ", async (q) => {
    const r = await get("/maintenance" + qs({ status: q.status, priority: q.priority, page: q.page, limit: 25 }));
    const staff = App.isStaff();
    const cols = [
      { h: "ຫ້ອງ", f: (m) => html`<b>${m.room_number || m.room_id}</b>` },
      { h: "ບັນຫາ", f: (m) => m.issue },
      { h: "ຄວາມດ່ວນ", f: (m) => badge(L.prio[m.priority], m.priority) },
      { h: "ສະຖານະ", f: (m) => badge(L.maint[m.status], m.status) },
      { h: "ຜູ້ແຈ້ງ", f: (m) => m.reporter_name || "ພະນັກງານ" },
      { h: "ວັນທີ", f: (m) => date(m.created_at) },
    ];
    if (staff) cols.push({ h: "", f: (m) => html`<div class="row-actions">
      ${m.status === "pending" ? html`<button class="btn sm" data-act="maint-status" data-id="${m.id}" data-status="in_progress">ເລີ່ມສ້ອມ</button>` : ""}
      ${m.status === "in_progress" ? html`<button class="btn sm" data-act="maint-status" data-id="${m.id}" data-status="resolved">ສ້ອມສຳເລັດ</button>` : ""}
      ${m.status === "pending" || m.status === "in_progress" ? html`<button class="btn ghost sm" data-act="maint-status" data-id="${m.id}" data-status="cancelled">ຍົກເລີກ</button>` : ""}
      ${App.isAdmin() ? html`<button class="btn ghost sm" data-act="maint-del" data-id="${m.id}">ລຶບ</button>` : ""}</div>` });
    return html`<div class="page-head"><div><h1>ແຈ້ງສ້ອມແປງ</h1>${staff ? "" : html`<p>ແຈ້ງບັນຫາໃນຫ້ອງຂອງທ່ານ ພະນັກງານຈະອັບເດດສະຖານະໃຫ້</p>`}</div>
        <button class="btn" data-act="maint-new">+ ແຈ້ງສ້ອມແປງ</button></div>
      <form class="filters" data-form="filter" data-path="/maintenance">
        <div><label>ສະຖານະ</label><select name="status">${options(Object.entries(L.maint), q.status, "ທັງໝົດ")}</select></div>
        <div><label>ຄວາມດ່ວນ</label><select name="priority">${options(Object.entries(L.prio), q.priority, "ທັງໝົດ")}</select></div>
        <button class="btn ghost" type="submit">ຄົ້ນຫາ</button></form>
      ${table(cols, r.data, "ບໍ່ມີລາຍການແຈ້ງສ້ອມແປງ")}${pager(r, "/maintenance", q)}`;
  });
  App.actions["maint-new"] = async () => {
    let roomField;
    if (App.isStaff()) {
      const rooms = await get("/rooms?limit=500");
      roomField = field("ຫ້ອງ", html`<select name="roomId" required>${options(rooms.data.map((r) => [r.id, `${r.building_name || ""} ${r.room_number}`]), "", "— ເລືອກຫ້ອງ —")}</select>`);
    } else {
      if (!App.me.room_id) { App.toast("ທ່ານຍັງບໍ່ມີຫ້ອງພັກ ຈຶ່ງແຈ້ງສ້ອມແປງບໍ່ໄດ້", "error"); return; }
      roomField = html`<input type="hidden" name="roomId" value="${App.me.room_id}"><p>ຫ້ອງ <b>${App.me.room_number}</b></p>`;
    }
    App.modal("ແຈ້ງສ້ອມແປງ", html`<form data-form="maint-save"><div class="form-error" role="alert"></div>${roomField}
      ${field("ລາຍລະອຽດບັນຫາ", html`<textarea name="issue" rows="3" maxlength="500" required></textarea>`)}
      ${field("ຄວາມດ່ວນ", html`<select name="priority">${options(Object.entries(L.prio), "medium")}</select>`)}
      <div class="modal-foot"><button type="button" class="btn ghost" data-act="close-modal">ຍົກເລີກ</button><button class="btn" type="submit">ສົ່ງແຈ້ງ</button></div></form>`);
  };
  App.forms["maint-save"] = (d) => App.do("POST", "/maintenance", { roomId: d.roomId, issue: d.issue, priority: d.priority }, "ແຈ້ງສ້ອມແປງສຳເລັດ");
  App.actions["maint-status"] = (el) => App.do("PUT", `/maintenance/${el.dataset.id}/status`, { status: el.dataset.status });
  App.actions["maint-del"] = async (el) => { if (App.confirm("ລຶບລາຍການນີ້?")) await App.do("DELETE", "/maintenance/" + el.dataset.id); };

  /* =============== ແຈ້ງການ =============== */
  route("/notifications", ALL, "ແຈ້ງການ", async (q) => {
    const r = await get("/notifications" + qs({ type: q.type, page: q.page, limit: 20 }));
    let createForm = "";
    if (App.isStaff()) {
      const stu = await get("/students?status=active&limit=200");
      createForm = html`<section class="section panel"><h2>ສົ່ງແຈ້ງການ</h2>
        <form data-form="notif-create"><div class="form-error" role="alert"></div>
          <div class="form-grid">
            ${field("ຫົວຂໍ້", html`<input name="title" required maxlength="200">`)}
            ${field("ສົ່ງຫາ", html`<select name="studentId">${options(stu.data.map((s) => [s.id, s.name]), "", "ທຸກຄົນ (ແຈ້ງລວມ)")}</select>`)}
            ${field("ປະເພດ", html`<select name="type">${options(Object.entries(L.ntype), "info")}</select>`)}
          </div>
          ${field("ຂໍ້ຄວາມ", html`<textarea name="message" rows="2" maxlength="1000" required></textarea>`)}
          <label class="check"><input type="checkbox" name="sendEmail"> ສົ່ງອີເມວນຳ (ຕ້ອງຕັ້ງ SMTP ກ່ອນ)</label>
          <button class="btn" type="submit">ສົ່ງແຈ້ງການ</button></form></section>`;
    }
    return html`<div class="page-head"><div><h1>ແຈ້ງການ</h1><p>${App.isStaff() ? "ແຈ້ງການທັງໝົດຂອງຫໍພັກ" : `ຍັງບໍ່ໄດ້ອ່ານ ${r.unread} ລາຍການ`}</p></div>
        ${!App.isStaff() && r.unread ? html`<button class="btn ghost" data-act="notif-readall">ໝາຍວ່າອ່ານແລ້ວທັງໝົດ</button>` : ""}</div>
      ${createForm}
      ${r.data.length ? html`<ul class="list-plain">${r.data.map((n) => html`<li class="${!App.isStaff() && !n.is_read ? "unread" : ""}">
        <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap">
          <div><b>${n.title}</b> ${badge(L.ntype[n.type], n.type === "urgent" ? "urgent" : n.type === "warning" ? "high" : "")}
            ${App.isStaff() ? badge(n.student_id ? "ສ່ວນຕົວ" : "ແຈ້ງລວມ", "") : ""}
            <br><span>${n.message}</span><br><span class="muted small">${App.datetime(n.created_at)}</span></div>
          <div class="row-actions">${!App.isStaff() && !n.is_read ? html`<button class="btn ghost sm" data-act="notif-read" data-id="${n.id}">ໝາຍວ່າອ່ານແລ້ວ</button>` : ""}
            ${App.isAdmin() ? html`<button class="btn ghost sm" data-act="notif-del" data-id="${n.id}">ລຶບ</button>` : ""}</div></div></li>`)}</ul>` : html`<div class="empty">ຍັງບໍ່ມີແຈ້ງການ</div>`}
      ${pager(r, "/notifications", q)}`;
  });
  App.forms["notif-create"] = async (d) => {
    const r = await api("POST", "/notifications", clean({ title: d.title, message: d.message, type: d.type, studentId: d.studentId, sendEmail: d.sendEmail ? true : undefined }));
    App.toast(r.message, "ok");
    App.navigate();
  };
  App.actions["notif-read"] = (el) => App.do("PATCH", `/notifications/${el.dataset.id}/read`, undefined, "ໝາຍວ່າອ່ານແລ້ວ");
  App.actions["notif-readall"] = () => App.do("PATCH", "/notifications/read-all");
  App.actions["notif-del"] = async (el) => { if (App.confirm("ລຶບແຈ້ງການນີ້?")) await App.do("DELETE", "/notifications/" + el.dataset.id); };

  /* =============== ໂປຣໄຟລ໌ =============== */
  route("/profile", ALL, "ໂປຣໄຟລ໌", async () => {
    const me = (await get("/auth/me")).data;
    App.me = me;
    const isStudent = me.role === "student" && me.student_id;
    return html`<div class="page-head"><h1>ໂປຣໄຟລ໌</h1></div>
      <div class="cols">
        <section class="panel"><h2>ຂໍ້ມູນຂອງຂ້ອຍ</h2><br>
          <div style="display:flex;gap:16px;align-items:center;margin-bottom:16px">
            ${me.avatar_url ? html`<img class="avatar" src="${App.base + me.avatar_url}" alt="ຮູບໂປຣໄຟລ໌">` : html`<div class="avatar">${(me.name || "?").slice(0, 1)}</div>`}
            <div><b>${me.name}</b><br><span class="muted">${me.email}</span><br>${badge(L.role[me.role], "info")}
              ${me.room_number ? html`<br><span class="small">ຫ້ອງ ${me.room_number} (${me.building_name || ""})</span>` : ""}</div></div>
          ${isStudent ? html`
            <form data-form="profile-save"><div class="form-error" role="alert"></div>
              ${field("ຊື່", html`<input name="name" value="${me.name}" required maxlength="150">`)}
              ${field("ເບີໂທ", html`<input name="phone" value="${me.phone || ""}" maxlength="30" inputmode="tel">`)}
              <button class="btn" type="submit">ບັນທຶກ</button></form>
            <hr style="border:0;border-top:1px solid var(--line);margin:18px 0">
            <form data-form="avatar"><div class="form-error" role="alert"></div>
              ${field("ປ່ຽນຮູບໂປຣໄຟລ໌", html`<input type="file" name="avatar" accept="image/jpeg,image/png,image/webp" required>`, "jpg, png, webp ບໍ່ເກີນ 5MB")}
              <button class="btn ghost" type="submit">ອັບໂຫຼດຮູບ</button></form>` : ""}
        </section>
        <section class="panel"><h2>ປ່ຽນລະຫັດຜ່ານ</h2><br>
          <form data-form="password"><div class="form-error" role="alert"></div>
            ${field("ລະຫັດຜ່ານປັດຈຸບັນ", html`<input type="password" name="currentPassword" autocomplete="current-password" required>`)}
            ${field("ລະຫັດຜ່ານໃໝ່", html`<input type="password" name="newPassword" minlength="8" autocomplete="new-password" required>`, "ຢ່າງໜ້ອຍ 8 ຕົວອັກສອນ")}
            ${field("ຢືນຢັນລະຫັດຜ່ານໃໝ່", html`<input type="password" name="confirm" autocomplete="new-password" required>`)}
            <button class="btn" type="submit">ປ່ຽນລະຫັດຜ່ານ</button></form></section>
      </div>`;
  });
  App.forms["profile-save"] = async (d) => { await api("PUT", "/students/me/profile", { name: d.name, phone: d.phone }); App.toast("ບັນທຶກສຳເລັດ", "ok"); App.me = (await get("/auth/me")).data; App.navigate(); };
  App.forms.avatar = async (d, form) => {
    const file = form.elements.avatar.files[0];
    if (!file) throw new Error("ກະລຸນາເລືອກໄຟລ໌ຮູບ");
    const fd = new FormData();
    fd.append("avatar", file);
    await api("POST", "/students/me/avatar", fd);
    App.toast("ອັບໂຫຼດຮູບສຳເລັດ", "ok");
    App.navigate();
  };
  App.forms.password = async (d) => {
    if (d.newPassword !== d.confirm) throw new Error("ລະຫັດຜ່ານໃໝ່ທັງສອງຊ່ອງບໍ່ຕົງກັນ");
    await api("PUT", "/auth/change-password", { currentPassword: d.currentPassword, newPassword: d.newPassword });
    App.toast("ປ່ຽນລະຫັດຜ່ານສຳເລັດ ກະລຸນາເຂົ້າສູ່ລະບົບໃໝ່", "ok");
    await App.logout(false);
  };
})();
