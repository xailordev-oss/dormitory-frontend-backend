/* ໜ້າສະເພາະ admin: ຕຶກ, ຜູ້ໃຊ້, ລາຍງານ, ປະຫວັດການແກ້ໄຂ + ເລີ່ມແອັບ */
(function () {
  "use strict";
  const { html, raw, route, api, get, L, badge, table, pager, money, kip, date, field, options, qs, clean } = App;
  const ADMIN = ["admin"];

  /* =============== ຕຶກ =============== */
  const bCache = {};
  route("/buildings", ADMIN, "ຕຶກ", async () => {
    const r = await get("/buildings");
    r.data.forEach((b) => (bCache[b.id] = b));
    return html`<div class="page-head"><h1>ຕຶກ</h1><button class="btn" data-act="bld-add">+ ເພີ່ມຕຶກ</button></div>
      ${table([
        { h: "ຊື່ຕຶກ", f: (b) => html`<b>${b.name}</b>` },
        { h: "ທີ່ຢູ່", f: (b) => b.address || "—" },
        { h: "ຈຳນວນຊັ້ນ", f: (b) => b.total_floors || "—" },
        { h: "ຈຳນວນຫ້ອງ", f: (b) => html`<a href="#/rooms?buildingId=${b.id}">${b.room_count} ຫ້ອງ</a>` },
        { h: "", f: (b) => html`<div class="row-actions"><button class="btn ghost sm" data-act="bld-edit" data-id="${b.id}">ແກ້ໄຂ</button><button class="btn ghost sm" data-act="bld-del" data-id="${b.id}">ລຶບ</button></div>` },
      ], r.data, "ຍັງບໍ່ມີຕຶກ — ເພີ່ມຕຶກກ່ອນ ແລ້ວຈຶ່ງເພີ່ມຫ້ອງ")}`;
  });
  const bForm = (b = {}) => html`<form data-form="bld-save"><div class="form-error" role="alert"></div>
    <input type="hidden" name="id" value="${b.id || ""}">
    ${field("ຊື່ຕຶກ", html`<input name="name" value="${b.name || ""}" required maxlength="150">`)}
    ${field("ທີ່ຢູ່", html`<input name="address" value="${b.address || ""}" maxlength="255">`)}
    ${field("ຈຳນວນຊັ້ນ", html`<input type="number" name="totalFloors" min="1" max="100" value="${b.total_floors || ""}">`)}
    <div class="modal-foot"><button type="button" class="btn ghost" data-act="close-modal">ຍົກເລີກ</button><button class="btn" type="submit">ບັນທຶກ</button></div></form>`;
  App.actions["bld-add"] = () => App.modal("ເພີ່ມຕຶກ", bForm());
  App.actions["bld-edit"] = (el) => App.modal("ແກ້ໄຂຕຶກ", bForm(bCache[el.dataset.id]));
  App.forms["bld-save"] = async (d) => {
    const body = { name: d.name, address: d.address || null, totalFloors: d.totalFloors || null };
    if (d.id) await App.do("PUT", "/buildings/" + d.id, body, "ບັນທຶກຕຶກສຳເລັດ"); else await App.do("POST", "/buildings", body, "ເພີ່ມຕຶກສຳເລັດ");
  };
  App.actions["bld-del"] = async (el) => { if (App.confirm(`ລຶບຕຶກ ${bCache[el.dataset.id].name} ?`)) await App.do("DELETE", "/buildings/" + el.dataset.id, undefined, "ລຶບຕຶກສຳເລັດ"); };

  /* =============== ຜູ້ໃຊ້ =============== */
  const uCache = {};
  route("/users", ADMIN, "ຜູ້ໃຊ້", async (q) => {
    const r = await get("/users" + qs({ role: q.role, search: q.search, page: q.page, limit: 25 }));
    r.data.forEach((u) => (uCache[u.id] = u));
    return html`<div class="page-head"><div><h1>ຜູ້ໃຊ້</h1><p>ບັນຊີທີ່ເຂົ້າສູ່ລະບົບໄດ້. ຜູ້ດູແລ = ທຸກສິດ, ພະນັກງານ = ວຽກໜ້າຫໍ (ບໍ່ແກ້ຫ້ອງ/ບໍ່ເບິ່ງລາຍງານ)</p></div>
        <button class="btn" data-act="usr-add">+ ສ້າງບັນຊີ</button></div>
      <form class="filters" data-form="filter" data-path="/users">
        <div><label>ຄົ້ນຫາ</label><input name="search" value="${q.search || ""}" placeholder="ຊື່ ຫຼື ອີເມວ"></div>
        <div><label>ບົດບາດ</label><select name="role">${options(Object.entries(L.role), q.role, "ທັງໝົດ")}</select></div>
        <button class="btn ghost" type="submit">ຄົ້ນຫາ</button></form>
      ${table([
        { h: "ຊື່", f: (u) => html`<b>${u.name}</b><br><span class="muted small">${u.email}</span>` },
        { h: "ບົດບາດ", f: (u) => html`<select data-role-sel data-id="${u.id}" aria-label="ບົດບາດຂອງ ${u.name}" ${u.id === App.me.id ? raw("disabled") : ""}>${options(Object.entries(L.role), u.role)}</select>` },
        { h: "ສະຖານະ", f: (u) => (u.is_active ? badge("ໃຊ້ງານ", "active") : badge("ຖືກປິດ", "failed")) },
        { h: "ສ້າງເມື່ອ", f: (u) => date(u.created_at) },
        { h: "", f: (u) => (u.id === App.me.id ? html`<span class="muted small">ບັນຊີຂອງທ່ານ</span>` : html`<div class="row-actions">
          <button class="btn ghost sm" data-act="usr-toggle" data-id="${u.id}">${u.is_active ? "ປິດບັນຊີ" : "ເປີດບັນຊີ"}</button>
          <button class="btn ghost sm" data-act="usr-pass" data-id="${u.id}">ຕັ້ງລະຫັດໃໝ່</button>
          <button class="btn ghost sm" data-act="usr-del" data-id="${u.id}">ລຶບ</button></div>`) },
      ], r.data, "ບໍ່ພົບຜູ້ໃຊ້")}${pager(r, "/users", q)}`;
  });
  App.actions["usr-add"] = () => App.modal("ສ້າງບັນຊີ", html`<form data-form="usr-create"><div class="form-error" role="alert"></div>
    <div class="form-grid">
      ${field("ຊື່", html`<input name="name" required maxlength="150">`)}
      ${field("ອີເມວ", html`<input name="email" type="email" required>`)}
      ${field("ລະຫັດຜ່ານເບື້ອງຕົ້ນ", html`<input name="password" type="text" minlength="8" required autocomplete="off">`, "ຢ່າງໜ້ອຍ 8 ຕົວ — ບອກໃຫ້ເຈົ້າຂອງບັນຊີປ່ຽນເອງພາຍຫຼັງ")}
      ${field("ບົດບາດ", html`<select name="role">${options(Object.entries(L.role), "staff")}</select>`)}
    </div>
    <div class="modal-foot"><button type="button" class="btn ghost" data-act="close-modal">ຍົກເລີກ</button><button class="btn" type="submit">ສ້າງບັນຊີ</button></div></form>`);
  App.forms["usr-create"] = (d) => App.do("POST", "/users", { name: d.name, email: d.email, password: d.password, role: d.role }, "ສ້າງບັນຊີສຳເລັດ");
  App.actions["usr-toggle"] = (el) => {
    const u = uCache[el.dataset.id];
    if (u.is_active && !App.confirm(`ປິດບັນຊີຂອງ ${u.name}? ເຂົາຈະເຂົ້າລະບົບບໍ່ໄດ້ທັນທີ`)) return;
    return App.do("PATCH", `/users/${u.id}/status`, { isActive: !u.is_active });
  };
  document.addEventListener("change", async (e) => {
    const sel = e.target.closest("select[data-role-sel]");
    if (!sel) return;
    const u = uCache[sel.dataset.id];
    if (!App.confirm(`ປ່ຽນບົດບາດຂອງ ${u.name} ເປັນ "${L.role[sel.value]}"? ເຂົາຕ້ອງເຂົ້າສູ່ລະບົບໃໝ່`)) { sel.value = u.role; return; }
    try { await App.do("PATCH", `/users/${u.id}/role`, { role: sel.value }); } catch (err) { App.toast(err.message, "error"); sel.value = u.role; }
  });
  App.actions["usr-pass"] = (el) => App.modal("ຕັ້ງລະຫັດຜ່ານໃໝ່ໃຫ້ " + uCache[el.dataset.id].name, html`<form data-form="usr-pass"><div class="form-error" role="alert"></div>
    <input type="hidden" name="id" value="${el.dataset.id}">
    ${field("ລະຫັດຜ່ານໃໝ່", html`<input name="newPassword" type="text" minlength="8" required autocomplete="off">`, "ຜູ້ໃຊ້ຈະຖືກບັງຄັບໃຫ້ເຂົ້າສູ່ລະບົບໃໝ່ທຸກອຸປະກອນ")}
    <div class="modal-foot"><button type="button" class="btn ghost" data-act="close-modal">ຍົກເລີກ</button><button class="btn" type="submit">ບັນທຶກ</button></div></form>`);
  App.forms["usr-pass"] = (d) => App.do("PATCH", `/users/${d.id}/password`, { newPassword: d.newPassword });
  App.actions["usr-del"] = async (el) => {
    const u = uCache[el.dataset.id];
    if (!App.confirm(`ລຶບບັນຊີ ${u.name}? ແນະນຳໃຫ້ "ປິດບັນຊີ" ແທນ`)) return;
    try { await App.do("DELETE", "/users/" + u.id, undefined, "ລຶບບັນຊີສຳເລັດ"); }
    catch (err) {
      if (err.status === 409 && /force/.test(err.message) && App.confirm(err.message + "\n\nຕ້ອງການລຶບແທ້ໆບໍ?")) await App.do("DELETE", `/users/${u.id}?force=true`, undefined, "ລຶບບັນຊີສຳເລັດ");
      else throw err;
    }
  };

  /* =============== ລາຍງານ =============== */
  const bars = (items, fmt) => {
    const max = Math.max(1, ...items.map((i) => i.value));
    return html`<ul class="list-plain">${items.map((i) => html`<li><div style="display:flex;justify-content:space-between"><span>${i.label}</span><b class="num">${fmt(i.value)}</b></div><div class="bar"><i style="width:${Math.round((i.value / max) * 100)}%"></i></div></li>`)}</ul>`;
  };
  route("/reports", ADMIN, "ລາຍງານ", async (q) => {
    const [occ, rev, mnt] = await Promise.all([get("/reports/occupancy"), get("/reports/revenue" + qs({ from: q.from, to: q.to })), get("/reports/maintenance-summary")]);
    const o = occ.data, v = rev.data, m = mnt.data;
    return html`<div class="page-head"><h1>ລາຍງານ</h1></div>
      <section class="section"><h2>ການເຂົ້າພັກ</h2>
        <div class="stats"><div class="stat"><b>${o.occupancyRate}%</b><span>ອັດຕາການເຂົ້າພັກ</span></div>
          <div class="stat"><b>${o.totalOccupants} / ${o.totalBeds}</b><span>ຜູ້ພັກ / ບ່ອນນອນ</span></div>
          <div class="stat"><b>${o.fullRooms}</b><span>ຫ້ອງເຕັມ (ຈາກ ${o.totalRooms} ຫ້ອງ)</span></div>
          <div class="stat"><b>${o.maintenanceRooms}</b><span>ຫ້ອງກຳລັງສ້ອມ</span></div></div>
        ${bars(o.byBuilding.map((b) => ({ label: `${b.buildingName} — ${b.occupants}/${b.beds} ບ່ອນ`, value: b.occupancyRate })), (x) => x + "%")}</section>
      <section class="section"><h2>ລາຍຮັບ</h2>
        <form class="filters" data-form="filter" data-path="/reports">
          <div><label>ຕັ້ງແຕ່ວັນທີ</label><input type="date" name="from" value="${q.from || ""}"></div>
          <div><label>ເຖິງວັນທີ</label><input type="date" name="to" value="${q.to || ""}"></div>
          <button class="btn ghost" type="submit">ເບິ່ງລາຍງານ</button></form>
        <div class="stats"><div class="stat good"><b>${kip(v.totalRevenue)}</b><span>ລາຍຮັບທີ່ໄດ້ຮັບແລ້ວ (ກີບ, ${v.totalPaidTransactions} ລາຍການ)</span></div>
          <div class="stat warn"><b>${kip(v.outstandingAmount)}</b><span>ຍັງຄ້າງຊຳລະ (ກີບ, ${v.outstandingCount} ລາຍການ)</span></div></div>
        <div class="cols"><div><h3>ລາຍຮັບແຍກຕາມເດືອນ</h3><br>${v.monthlyRevenue.length ? bars(v.monthlyRevenue.map((x) => ({ label: x.month, value: x.total })), money) : html`<div class="empty">ຍັງບໍ່ມີລາຍຮັບ</div>`}</div>
          <div><h3>ແຍກຕາມວິທີຊຳລະ</h3><br>${Object.keys(v.revenueByMethod).length ? bars(Object.entries(v.revenueByMethod).map(([k, x]) => ({ label: L.method[k], value: x })), money) : html`<div class="empty">ຍັງບໍ່ມີຂໍ້ມູນ</div>`}</div></div></section>
      <section class="section"><h2>ການສ້ອມແປງ</h2>
        <div class="stats"><div class="stat"><b>${m.totalRequests}</b><span>ແຈ້ງທັງໝົດ</span></div>
          <div class="stat warn"><b>${m.openCount}</b><span>ຍັງເປີດຢູ່</span></div>
          <div class="stat bad"><b>${m.openUrgentCount}</b><span>ດ່ວນທີ່ຍັງເປີດ</span></div>
          <div class="stat"><b>${m.avgResolutionHours === null ? "—" : m.avgResolutionHours + " ຊມ."}</b><span>ເວລາສະເລ່ຍປິດວຽກ</span></div></div>
        ${m.topRooms.length ? html`<h3>ຫ້ອງທີ່ແຈ້ງສ້ອມຫຼາຍທີ່ສຸດ</h3><br>${bars(m.topRooms.map((r) => ({ label: "ຫ້ອງ " + r.roomNumber, value: r.count })), (x) => x + " ຄັ້ງ")}` : ""}</section>`;
  });

  /* =============== ປະຫວັດການແກ້ໄຂ =============== */
  route("/audit", ADMIN, "ປະຫວັດການແກ້ໄຂ", async (q) => {
    const r = await get("/audit-logs" + qs({ method: q.method, from: q.from, to: q.to, page: q.page, limit: 30 }));
    return html`<div class="page-head"><div><h1>ປະຫວັດການແກ້ໄຂ</h1><p>ທຸກການເພີ່ມ/ແກ້/ລຶບ ທີ່ຜູ້ດູແລ ແລະ ພະນັກງານເຮັດ</p></div></div>
      <form class="filters" data-form="filter" data-path="/audit">
        <div><label>ວິທີ</label><select name="method">${options([["POST", "ເພີ່ມ (POST)"], ["PUT", "ແກ້ (PUT)"], ["PATCH", "ແກ້ບາງສ່ວນ (PATCH)"], ["DELETE", "ລຶບ (DELETE)"]], q.method, "ທັງໝົດ")}</select></div>
        <div><label>ຕັ້ງແຕ່</label><input type="date" name="from" value="${q.from || ""}"></div>
        <div><label>ເຖິງ</label><input type="date" name="to" value="${q.to || ""}"></div>
        <button class="btn ghost" type="submit">ຄົ້ນຫາ</button></form>
      ${table([
        { h: "ເວລາ", f: (l) => App.datetime(l.created_at) },
        { h: "ຜູ້ເຮັດ", f: (l) => html`${l.admin_email || "—"} ${l.role ? badge(L.role[l.role] || l.role, "info") : ""}` },
        { h: "ການກະທຳ", f: (l) => html`<b>${l.method}</b> <span class="small">${l.path}</span>` },
        { h: "ຜົນ", f: (l) => l.status_code },
        { h: "IP", f: (l) => l.ip_address || "—" },
      ], r.data, "ຍັງບໍ່ມີປະຫວັດ")}${pager(r, "/audit", q)}`;
  });

  App.boot();
})();
