/* ແກນຂອງໜ້າເວັບ: api, router, ຕົວຊ່ວຍ render (ປ້ອງກັນ XSS ໂດຍຄ່າເລີ່ມຕົ້ນ), modal, toast */
(function () {
  "use strict";
  const App = (window.App = {});
  App.base = window.DORM_API || "";

  /* ---------- render ປອດໄພ: ທຸກຄ່າທີ່ໃສ່ໃນ html`` ຖືກ escape ອັດຕະໂນມັດ ---------- */
  const RAW = Symbol("raw");
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const render = (v) => {
    if (v === null || v === undefined || v === false) return "";
    if (Array.isArray(v)) return v.map(render).join("");
    if (typeof v === "object" && v[RAW]) return v.s;
    return esc(v);
  };
  App.esc = esc;
  App.raw = (s) => ({ [RAW]: true, s: String(s) });
  App.html = (strings, ...vals) => {
    let out = "";
    strings.forEach((s, i) => {
      out += s;
      if (i < vals.length) out += render(vals[i]);
    });
    return { [RAW]: true, s: out };
  };
  App.str = render;

  /* ---------- token ---------- */
  const KEY = { a: "dorm_access", r: "dorm_refresh" };
  App.tokens = {
    get access() { return localStorage.getItem(KEY.a); },
    get refresh() { return localStorage.getItem(KEY.r); },
    set(a, r) { if (a) localStorage.setItem(KEY.a, a); if (r) localStorage.setItem(KEY.r, r); },
    clear() { localStorage.removeItem(KEY.a); localStorage.removeItem(KEY.r); },
  };
  App.me = null;

  /* ---------- API ---------- */
  const rawRequest = async (method, path, body) => {
    const headers = {};
    if (App.tokens.access) headers.Authorization = "Bearer " + App.tokens.access;
    let payload;
    if (body instanceof FormData) payload = body;
    else if (body !== undefined) { headers["Content-Type"] = "application/json"; payload = JSON.stringify(body); }
    const res = await fetch(App.base + "/api" + path, { method, headers, body: payload });
    let data = null;
    try { data = await res.json(); } catch (e) { /* ບໍ່ແມ່ນ JSON */ }
    return { res, data };
  };

  let refreshing = null;
  const refreshAccess = () => {
    if (!refreshing) {
      refreshing = (async () => {
        try {
          const { res, data } = await rawRequest("POST", "/auth/refresh-token", { refreshToken: App.tokens.refresh });
          if (res.ok && data.accessToken) { App.tokens.set(data.accessToken); return true; }
        } catch (e) { /* ignore */ }
        return false;
      })().finally(() => { refreshing = null; });
    }
    return refreshing;
  };

  App.api = async (method, path, body) => {
    let { res, data } = await rawRequest(method, path, body);
    if (res.status === 401 && data && data.code === "TOKEN_EXPIRED" && App.tokens.refresh) {
      if (await refreshAccess()) ({ res, data } = await rawRequest(method, path, body));
    }
    if (!res.ok) {
      const err = new Error((data && data.message) || "ເກີດຂໍ້ຜິດພາດ (" + res.status + ")");
      err.status = res.status;
      err.code = data && data.code;
      if (App.me && (res.status === 401 || err.code === "ACCOUNT_DISABLED")) App.logout(false);
      throw err;
    }
    return data;
  };
  App.get = (p) => App.api("GET", p);

  App.logout = async (callServer = true) => {
    if (callServer && App.tokens.refresh) { try { await rawRequest("POST", "/auth/logout", { refreshToken: App.tokens.refresh }); } catch (e) { /* ignore */ } }
    App.tokens.clear();
    App.me = null;
    document.getElementById("app").innerHTML = "";
    location.hash = "#/login";
    App.navigate();
  };

  /* ---------- ຕົວຊ່ວຍ ---------- */
  App.kip = (n) => Number(n || 0).toLocaleString("en-US");
  App.money = (n) => Number(n || 0).toLocaleString("en-US") + " ກີບ";
  App.date = (s) => (s ? String(s).slice(0, 10) : "—");
  App.datetime = (s) => (s ? String(s).slice(0, 16).replace("T", " ") : "—");
  App.isStaff = () => App.me && (App.me.role === "admin" || App.me.role === "staff");
  App.isAdmin = () => App.me && App.me.role === "admin";
  App.qs = (query, over = {}) => {
    const p = new URLSearchParams();
    Object.entries({ ...query, ...over }).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "" && v !== false) p.set(k, v); });
    const s = p.toString();
    return s ? "?" + s : "";
  };
  App.options = (items, selected, empty) =>
    App.html`${empty !== undefined ? App.html`<option value="">${empty}</option>` : ""}${items.map(([v, l]) => App.html`<option value="${v}" ${String(v) === String(selected ?? "") ? App.raw("selected") : ""}>${l}</option>`)}`;

  const L = {
    role: { admin: "ຜູ້ດູແລ", staff: "ພະນັກງານ", student: "ນັກສຶກສາ" },
    room: { available: "ຫວ່າງ", occupied: "ເຕັມ", maintenance: "ສ້ອມແປງ" },
    booking: { pending: "ລໍຖ້າອະນຸມັດ", active: "ພັກຢູ່", checked_out: "ອອກແລ້ວ", cancelled: "ຍົກເລີກ" },
    pay: { pending: "ຄ້າງຊຳລະ", paid: "ຊຳລະແລ້ວ", failed: "ລົ້ມເຫຼວ", refunded: "ຄືນເງິນແລ້ວ" },
    method: { cash: "ເງິນສົດ", bank_transfer: "ໂອນທະນາຄານ", card: "ບັດ", mobile_banking: "ມືຖືທະນາຄານ" },
    ptype: { rent: "ຄ່າເຊົ່າຫ້ອງ", deposit: "ເງິນມັດຈຳ", utility: "ຄ່ານ້ຳ/ຄ່າໄຟ", other: "ອື່ນໆ" },
    maint: { pending: "ລໍຖ້າ", in_progress: "ກຳລັງສ້ອມ", resolved: "ສຳເລັດ", cancelled: "ຍົກເລີກ" },
    prio: { low: "ຕ່ຳ", medium: "ກາງ", high: "ສູງ", urgent: "ດ່ວນ" },
    visitor: { checked_in: "ຢູ່ໃນຫໍ", checked_out: "ອອກແລ້ວ" },
    student: { active: "ພັກຢູ່", inactive: "ບໍ່ໄດ້ພັກ" },
    ntype: { info: "ທົ່ວໄປ", warning: "ເຕືອນ", urgent: "ດ່ວນ", payment: "ການເງິນ", maintenance: "ສ້ອມແປງ" },
  };
  App.L = L;
  const TONE = {
    available: "ok", occupied: "", maintenance: "warn",
    pending: "warn", active: "ok", checked_out: "", cancelled: "",
    paid: "ok", failed: "bad", refunded: "info", overdue: "bad",
    in_progress: "info", resolved: "ok", urgent: "bad", high: "warn", medium: "info", low: "",
    checked_in: "ok", inactive: "",
  };
  App.badge = (text, key) => App.html`<span class="badge ${TONE[key] || ""}">${text}</span>`;

  /* ຕາຕະລາງ: cols = [{h, f(row), cls}] */
  App.table = (cols, rows, emptyText = "ຍັງບໍ່ມີຂໍ້ມູນ") => {
    if (!rows || rows.length === 0) return App.html`<div class="empty">${emptyText}</div>`;
    return App.html`<div class="table-wrap"><table>
      <thead><tr>${cols.map((c) => App.html`<th class="${c.cls || ""}">${c.h}</th>`)}</tr></thead>
      <tbody>${rows.map((r) => App.html`<tr>${cols.map((c) => App.html`<td class="${c.cls || ""}">${c.f(r)}</td>`)}</tr>`)}</tbody>
    </table></div>`;
  };

  App.pager = (resp, path, query) => {
    if (!resp || resp.totalPages <= 1) return "";
    const link = (p, text) => App.html`<a href="#${path}${App.qs(query, { page: p })}">${text}</a>`;
    return App.html`<div class="pager">
      ${resp.page > 1 ? link(resp.page - 1, "‹ ກ່ອນໜ້າ") : App.html`<span class="disabled">‹ ກ່ອນໜ້າ</span>`}
      <span>ໜ້າ ${resp.page} / ${resp.totalPages} (ທັງໝົດ ${resp.total} ລາຍການ)</span>
      ${resp.page < resp.totalPages ? link(resp.page + 1, "ຕໍ່ໄປ ›") : App.html`<span class="disabled">ຕໍ່ໄປ ›</span>`}
    </div>`;
  };

  App.field = (label, inner, hint) => App.html`<div class="field"><label>${label}</label>${inner}${hint ? App.html`<div class="hint">${hint}</div>` : ""}</div>`;

  /* ---------- Modal / Toast ---------- */
  App.modal = (title, body, opts = {}) => {
    const root = document.getElementById("modal-root");
    root.innerHTML = App.html`<div class="overlay"><div class="modal ${opts.wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-label="${title}">
      <div class="modal-head"><h2>${title}</h2><button type="button" data-act="close-modal" aria-label="ປິດ">×</button></div>${body}</div></div>`.s;
    const first = root.querySelector("input, select, textarea");
    if (first) first.focus();
  };
  App.closeModal = () => { document.getElementById("modal-root").innerHTML = ""; };
  App.toast = (msg, type) => {
    const el = document.createElement("div");
    el.className = "toast " + (type || "");
    el.textContent = msg;
    document.getElementById("toasts").appendChild(el);
    setTimeout(() => el.remove(), 4200);
  };

  /* ---------- ເຫດການ: data-act (ປຸ່ມ) / data-form (ຟອມ) ---------- */
  App.actions = {
    "close-modal": () => App.closeModal(),
    "toggle-nav": () => document.querySelector(".side")?.classList.toggle("open"),
    logout: () => App.logout(true),
    print: () => window.print(),
  };
  App.forms = {
    filter: (data, form) => {
      const q = App.qs(data);
      const target = "#" + form.dataset.path + q;
      if (location.hash === target) App.navigate(); else location.hash = target;
    },
  };
  App.formData = (form) => {
    const out = {};
    for (const el of form.elements) {
      if (!el.name || el.disabled) continue;
      if (el.type === "checkbox") out[el.name] = el.checked;
      else if (el.type === "file") continue;
      else out[el.name] = el.value.trim ? el.value.trim() : el.value;
    }
    return out;
  };
  /* ເອົາ field ວ່າງອອກ ເພື່ອບໍ່ສົ່ງຄ່າວ່າງໄປໃຫ້ API */
  App.clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== "" && v !== undefined && v !== null));

  document.addEventListener("click", async (e) => {
    // ກົດພື້ນຫຼັງມືດຂອງ modal (ບໍ່ແມ່ນເນື້ອໃນ) → ປິດ. ບໍ່ໃຊ້ data-act ເພາະຈະຈັບທຸກ click ໃນ modal ແລະ ບລັອກປຸ່ມ submit
    if (e.target.classList && e.target.classList.contains("overlay")) { App.closeModal(); return; }
    const el = e.target.closest("[data-act]");
    if (!el) return;
    const fn = App.actions[el.dataset.act];
    if (!fn) return;
    if (el.tagName !== "A" || !el.getAttribute("href")) e.preventDefault();
    try { await fn(el, e); } catch (err) { App.toast(err.message, "error"); }
  });
  document.addEventListener("submit", async (e) => {
    const form = e.target.closest("form[data-form]");
    if (!form) return;
    e.preventDefault();
    const fn = App.forms[form.dataset.form];
    if (!fn) return;
    const btn = form.querySelector("button[type=submit]");
    const errBox = form.querySelector(".form-error");
    if (errBox) errBox.textContent = "";
    if (btn) btn.disabled = true;
    try { await fn(App.formData(form), form); }
    catch (err) { if (errBox) errBox.textContent = err.message; else App.toast(err.message, "error"); }
    finally { if (btn) btn.disabled = false; }
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") App.closeModal(); });

  /* ຢືນຢັນກ່ອນລຶບ ຫຼື ເຮັດສິ່ງທີ່ຍ້ອນກັບບໍ່ໄດ້ */
  App.confirm = (msg) => window.confirm(msg);
  /* ເອີ້ນ API ແລ້ວ refresh ໜ້າ + toast */
  App.do = async (method, path, body, okMsg) => {
    const r = await App.api(method, path, body);
    if (okMsg || (r && r.message)) App.toast(okMsg || r.message, "ok");
    App.closeModal();
    App.navigate();
    return r;
  };

  /* ---------- Router ---------- */
  const routes = [];
  App.route = (path, roles, title, fn) => routes.push({ path, roles, title, fn });
  const parseHash = () => {
    const raw = location.hash.slice(1) || "/";
    const [path, q] = raw.split("?");
    return { path: path || "/", query: Object.fromEntries(new URLSearchParams(q || "")) };
  };

  let shellFor = null;
  const NAV = (me) => {
    const staff = me.role === "admin" || me.role === "staff";
    if (!staff) {
      return [["/", "ໜ້າຫຼັກ"], ["/rooms", "ຫ້ອງພັກ"], ["/my-bookings", "ການຈອງຂອງຂ້ອຍ"], ["/my-payments", "ການຊຳລະ"], ["/maintenance", "ແຈ້ງສ້ອມແປງ"], ["/notifications", "ແຈ້ງການ", "unread"], ["/profile", "ໂປຣໄຟລ໌"]];
    }
    const list = [["/", "ພາບລວມ"], ["/students", "ນັກສຶກສາ"], ["/rooms", "ຫ້ອງພັກ"], ["/bookings", "ການຈອງ"], ["/payments", "ການຊຳລະ"], ["/maintenance", "ສ້ອມແປງ"], ["/visitors", "ຜູ້ມາຢ້ຽມ"], ["/notifications", "ແຈ້ງການ"]];
    if (me.role === "admin") list.push(["-"], ["/buildings", "ຕຶກ"], ["/reports", "ລາຍງານ"], ["/users", "ຜູ້ໃຊ້"], ["/audit", "ປະຫວັດການແກ້ໄຂ"]);
    list.push(["-"], ["/profile", "ໂປຣໄຟລ໌"]);
    return list;
  };

  const renderShell = () => {
    const me = App.me;
    if (shellFor === me.id + ":" + me.role && document.getElementById("view")) return;
    shellFor = me.id + ":" + me.role;
    document.getElementById("app").innerHTML = App.html`
      <div class="shell">
        <aside class="side" id="side">
          <div class="brand"><span class="brand-mark">ຫ</span>ຫໍພັກ</div>
          <nav class="nav">${NAV(me).map((n) => (n[0] === "-" ? App.html`<div class="sep"></div>` : App.html`<a href="#${n[0]}" data-nav="${n[0]}" data-act="nav-click">${n[1]}${n[2] === "unread" ? App.html`<span class="dot" id="unread-dot" hidden></span>` : ""}</a>`))}</nav>
          <div class="me"><b>${me.name}</b><span class="muted">${L.role[me.role]}</span><br><button class="btn ghost sm" data-act="logout">ອອກຈາກລະບົບ</button></div>
        </aside>
        <div>
          <div class="topbar"><button data-act="toggle-nav" aria-label="ເມນູ">☰</button><b>ລະບົບຈັດການຫໍພັກ</b></div>
          <main class="main" id="view"></main>
        </div>
      </div>`.s;
  };
  App.actions["nav-click"] = () => document.querySelector(".side")?.classList.remove("open");

  const markNav = (path) => {
    document.querySelectorAll(".nav a").forEach((a) => {
      const p = a.dataset.nav;
      a.classList.toggle("on", p === path || (p !== "/" && path.startsWith(p + "/")));
    });
  };

  const refreshUnread = async () => {
    if (!App.me) return;
    try {
      const r = await App.get("/notifications?limit=1&isRead=false");
      const dot = document.getElementById("unread-dot");
      if (dot) { dot.textContent = r.unread; dot.hidden = !r.unread; }
    } catch (e) { /* ບໍ່ສຳຄັນ */ }
  };
  App.refreshUnread = refreshUnread;

  let navToken = 0;
  App.navigate = async () => {
    const token = ++navToken;
    const { path, query } = parseHash();
    const route = routes.find((r) => r.path === path) || null;

    // ເຂົ້າໜ້າທີ່ຕ້ອງ login ໂດຍຍັງບໍ່ໄດ້ login
    if (route && route.roles && !App.me) {
      if (App.tokens.access) {
        try { const r = await App.get("/auth/me"); App.me = r.data; } catch (e) { App.tokens.clear(); }
      }
      if (!App.me) { location.hash = "#/login"; return; }
    }
    // login ແລ້ວແຕ່ເຂົ້າໜ້າ login/register
    if (route && !route.roles && App.me && path !== "/reset-password") { location.hash = "#/"; return; }
    if (route && route.roles && App.me && !route.roles.includes(App.me.role)) {
      renderShell();
      document.getElementById("view").innerHTML = App.html`<div class="empty">ທ່ານບໍ່ມີສິດເຂົ້າໜ້ານີ້</div>`.s;
      return;
    }
    if (!route) {
      if (App.me) { renderShell(); document.getElementById("view").innerHTML = App.html`<div class="empty">ບໍ່ພົບໜ້ານີ້ — <a href="#/">ກັບໜ້າຫຼັກ</a></div>`.s; }
      else location.hash = "#/login";
      return;
    }

    if (!route.roles) { // ໜ້າສາທາລະນະ (login ...)
      document.getElementById("app").innerHTML = "";
      shellFor = null;
      document.getElementById("app").innerHTML = (await route.fn(query)).s;
      document.title = route.title + " · ລະບົບຈັດການຫໍພັກ";
      return;
    }

    renderShell();
    markNav(path);
    document.title = route.title + " · ລະບົບຈັດການຫໍພັກ";
    const view = document.getElementById("view");
    view.innerHTML = '<div class="loading">ກຳລັງໂຫຼດ…</div>';
    try {
      const out = await route.fn(query);
      if (token !== navToken) return; // ມີການເປີດໜ້າໃໝ່ແລ້ວ
      view.innerHTML = out.s;
      window.scrollTo(0, 0);
      refreshUnread();
    } catch (err) {
      if (token !== navToken) return;
      view.innerHTML = App.html`<div class="empty"><p>${err.message}</p><button class="btn ghost" data-act="retry">ລອງໃໝ່</button></div>`.s;
    }
  };
  App.actions.retry = () => App.navigate();
  window.addEventListener("hashchange", () => App.navigate());

  App.boot = () => { if (!location.hash) location.hash = App.tokens.access ? "#/" : "#/login"; App.navigate(); };
})();
