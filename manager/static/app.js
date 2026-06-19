let bots = [];
let currentId = null;
let currentTab = "logs";
let logSource = null;
let qrTimer = null;
let statusTimer = null;

const $ = (id) => document.getElementById(id);

function toast(msg, isErr = false) {
  const t = $("toast");
  t.textContent = msg;
  t.className = "toast show" + (isErr ? " err" : "");
  setTimeout(() => { t.className = "toast" + (isErr ? " err" : ""); }, 3200);
}

async function api(path, method = "GET", body = null) {
  const opt = { method, headers: { "Content-Type": "application/json" } };
  if (body) opt.body = JSON.stringify(body);
  const r = await fetch(path, opt);
  if (!r.ok) {
    let msg = r.statusText;
    try { msg = (await r.json()).detail || msg; } catch (e) {}
    throw new Error(msg);
  }
  return r.json();
}

async function loadBots() {
  const data = await api("/api/bots");
  bots = data.bots;
  renderSidebar();
  if (!currentId && bots.length) selectBot(bots[0].id);
}

function renderSidebar() {
  const el = $("botList");
  el.innerHTML = "";
  bots.forEach((b) => {
    const st = b.process.status || "stopped";
    const div = document.createElement("div");
    div.className = "bot-item" + (b.id === currentId ? " active" : "");
    div.onclick = () => selectBot(b.id);
    div.innerHTML = `
      <span class="dot ${st}"></span>
      <div class="meta">
        <div class="nm">${escapeHtml(b.config.name_bot || b.name)}</div>
        <div class="ty">${b.type.toUpperCase()} &middot; ${st}</div>
      </div>`;
    el.appendChild(div);
  });
}

function curBot() { return bots.find((b) => b.id === currentId); }

async function selectBot(id) {
  currentId = id;
  renderSidebar();
  await refreshDetail();
  switchTab(currentTab);
}

async function refreshDetail() {
  const detail = await api(`/api/bots/${currentId}`);
  const idx = bots.findIndex((b) => b.id === currentId);
  if (idx >= 0) bots[idx] = detail;
  const b = detail;
  $("botName").textContent = b.config.name_bot || b.name;
  const st = b.process.status || "stopped";
  const badge = $("statusBadge");
  badge.textContent = st;
  badge.className = "badge " + st;
  $("pidInfo").innerHTML = b.process.alive
    ? `PID <b>${b.process.pid}</b> &middot; uptime <b>${b.process.uptime}s</b> &middot; restart <b>${b.process.restart_count}</b>`
    : (b.process.exit_code != null ? `exit code <b>${b.process.exit_code}</b>` : "");
  $("autorestart").checked = b.overlay.autorestart;
  renderSidebar();
}

// ---- tabs ----
document.querySelectorAll(".tab").forEach((t) => {
  t.onclick = () => switchTab(t.dataset.tab);
});

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll(".tab").forEach((t) =>
    t.classList.toggle("active", t.dataset.tab === tab));
  stopLogStream();
  stopQrPoll();
  if (!currentId) return;
  if (tab === "logs") renderLogs();
  else if (tab === "commands") renderCommands();
  else if (tab === "qr") renderQR();
  else if (tab === "settings") renderSettings();
}

// ---- logs ----
function renderLogs() {
  const b = curBot();
  const err = b.process.last_error
    ? `<div class="error-banner"><b>Loi gan nhat:</b> ${escapeHtml(b.process.last_error)}</div>` : "";
  $("content").innerHTML = err + `<div class="logbox" id="logbox"></div>`;
  const box = $("logbox");
  logSource = new EventSource(`/api/bots/${currentId}/logs/stream`);
  logSource.onmessage = (ev) => {
    const e = JSON.parse(ev.data);
    const cls = e.kind === "err" ? "err" : (e.text.startsWith("[manager]") || e.text.startsWith("[auto-fix]") ? "manager" : "");
    const line = document.createElement("div");
    line.className = "logline " + cls;
    line.textContent = e.text;
    const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
    box.appendChild(line);
    if (atBottom) box.scrollTop = box.scrollHeight;
  };
  logSource.onerror = () => {};
}
function stopLogStream() { if (logSource) { logSource.close(); logSource = null; } }

// ---- commands ----
async function renderCommands() {
  const data = await api(`/api/bots/${currentId}/commands`);
  const b = curBot();
  const prefix = b.config.prefix || "(khong ro)";
  if (!data.commands.length) {
    $("content").innerHTML = `<div class="empty">Khong tim thay file lenh nao.</div>`;
    return;
  }
  $("content").innerHTML =
    `<p class="kv">Prefix lenh: <b>${escapeHtml(prefix)}</b> &middot; Tong <b>${data.commands.length}</b> lenh</p>
     <div class="cmd-grid">${data.commands.map((c) =>
       `<span class="cmd-chip">${escapeHtml(prefix)}${escapeHtml(c)}</span>`).join("")}</div>`;
}

// ---- QR ----
function renderQR() {
  const b = curBot();
  const last = b.config.last_login;
  const lastHtml = last
    ? `<p class="hint">Lan dang nhap gan nhat: <b>${escapeHtml(last.name || "?")}</b> (uid ${escapeHtml(last.uid || "?")}) luc ${escapeHtml(last.at || "")}</p>`
    : "";
  const checks = bots.map((x) =>
    `<label class="chk"><input type="checkbox" class="qrAllBot" value="${escapeAttr(x.id)}" checked /> ${escapeHtml(x.config.name_bot || x.name)} <span class="muted">(${x.type})</span></label>`
  ).join("");
  $("content").innerHTML = `
    <div class="qr-wrap">
      <div class="panel">
        <h3>Dang nhap 1 lan &rarr; ap dung cho NHIEU bot</h3>
        <p class="hint">Quet QR 1 lan, cookie + imei moi se tu ghi vao tat ca bot duoc chon ben duoi (cac bot se dung chung 1 tai khoan Zalo vua quet). Sua het 1 luot loi "het han" + "khong nhan lenh".</p>
        <div class="chk-list">${checks}</div>
        <div id="qrAreaAll"></div>
        <button class="primary" id="btnQrAll" style="margin-top:12px">Dang nhap QR cho cac bot da chon</button>
        <hr style="border-color:var(--border);margin:18px 0" />
        <p class="hint">Hoac dan thu cong cookie + imei roi ap dung 1 lan cho cac bot da chon:</p>
        <div class="form-row"><label>IMEI (de trong = giu nguyen imei tung bot)</label>
          <input id="f_imei_all" placeholder="vd: 1a2b3c..." /></div>
        <div class="form-row"><label>Cookie (chuoi "k=v; k=v" hoac JSON)</label>
          <textarea id="f_cookie_all" placeholder="dan cookie o day"></textarea></div>
        <button id="btnApplyAll">Ap dung cookie + imei cho cac bot da chon</button>
      </div>
      <hr style="border-color:var(--border);margin:22px 0" />
      <h3>Chi dang nhap rieng cho bot nay: ${escapeHtml(b.config.name_bot || b.name)}</h3>
      <p class="hint">Quet QR va chi ghi phien moi vao rieng bot nay.</p>
      ${lastHtml}
      <div id="qrArea"></div>
      <button class="primary" id="btnQrStart" style="margin-top:12px">Bat dau dang nhap QR</button>
    </div>`;
  $("btnQrStart").onclick = startQR;
  $("btnQrAll").onclick = startQRAll;
  $("btnApplyAll").onclick = applySessionAll;
}

function selectedAllBotIds() {
  return Array.from(document.querySelectorAll(".qrAllBot:checked")).map((e) => e.value);
}

async function startQRAll() {
  const ids = selectedAllBotIds();
  if (!ids.length) { toast("Chon it nhat 1 bot.", true); return; }
  $("btnQrAll").disabled = true;
  $("qrAreaAll").innerHTML = `<div class="qr-status">Dang tao ma QR...</div>`;
  try {
    await api(`/api/qr/start_all`, "POST", { bot_ids: ids });
    pollQRAll();
  } catch (e) {
    toast("Loi: " + e.message, true);
    $("btnQrAll").disabled = false;
  }
}

function pollQRAll() {
  qrTimer = setInterval(async () => {
    let s;
    try { s = await api(`/api/qr/status_all`); } catch (e) { return; }
    const area = $("qrAreaAll");
    if (!area) { stopQrPoll(); return; }
    let html = "";
    if (s.qr_image && (s.state === "waiting_scan" || s.state === "starting")) {
      html += `<img src="data:image/png;base64,${s.qr_image}" alt="QR" />`;
    }
    html += `<div class="qr-status">${escapeHtml(s.message || s.state)}</div>`;
    area.innerHTML = html;
    if (s.state === "success") {
      stopQrPoll();
      toast("Da dang nhap + ap dung cho cac bot da chon.");
      $("btnQrAll").disabled = false;
      loadBots();
    } else if (s.state === "error" || s.state === "cancelled") {
      stopQrPoll();
      $("btnQrAll").disabled = false;
    }
  }, 1500);
}

async function applySessionAll() {
  const ids = selectedAllBotIds();
  if (!ids.length) { toast("Chon it nhat 1 bot.", true); return; }
  const cookie = val("f_cookie_all");
  if (!cookie) { toast("Chua co cookie de ap dung.", true); return; }
  $("btnApplyAll").disabled = true;
  try {
    const r = await api(`/api/apply_session_all`, "POST",
      { cookie, imei: val("f_imei_all"), bot_ids: ids });
    toast(`Da ap dung cho ${r.count} bot.`);
    await refreshDetail();
  } catch (e) {
    toast("Loi: " + e.message, true);
  } finally {
    $("btnApplyAll").disabled = false;
  }
}

async function startQR() {
  $("btnQrStart").disabled = true;
  $("qrArea").innerHTML = `<div class="qr-status">Dang tao ma QR...</div>`;
  try {
    await api(`/api/bots/${currentId}/qr/start`, "POST");
    pollQR();
  } catch (e) {
    toast("Loi: " + e.message, true);
    $("btnQrStart").disabled = false;
  }
}

function pollQR() {
  qrTimer = setInterval(async () => {
    let s;
    try { s = await api(`/api/bots/${currentId}/qr/status`); } catch (e) { return; }
    const area = $("qrArea");
    let html = "";
    if (s.qr_image && (s.state === "waiting_scan" || s.state === "starting")) {
      html += `<img src="data:image/png;base64,${s.qr_image}" alt="QR" />`;
    }
    html += `<div class="qr-status">${escapeHtml(s.message || s.state)}</div>`;
    area.innerHTML = html;
    if (s.state === "success") {
      stopQrPoll();
      toast("Dang nhap thanh cong! Da ghi phien moi vao bot.");
      $("btnQrStart").disabled = false;
      $("btnQrStart").textContent = "Dang nhap lai";
      refreshDetail();
    } else if (s.state === "error" || s.state === "cancelled") {
      stopQrPoll();
      $("btnQrStart").disabled = false;
    }
  }, 1500);
}
function stopQrPoll() { if (qrTimer) { clearInterval(qrTimer); qrTimer = null; } }

// ---- settings ----
function renderSettings() {
  const b = curBot();
  const c = b.config, o = b.overlay;
  const aiName = c.ai_key_name || "AI API Key";
  $("content").innerHTML = `
    <div class="form-row"><label>Ten bot</label>
      <input id="f_name" value="${escapeAttr(c.name_bot || "")}" /></div>
    <div class="form-row"><label>Prefix lenh</label>
      <input id="f_prefix" value="${escapeAttr(c.prefix || "")}" />
      <div class="hint">Ky tu dat truoc lenh, vi du <b>-</b> hoac <b>*</b></div></div>
    <div class="form-row"><label>Admin (UID)</label>
      <input id="f_admin" value="${escapeAttr(c.admin || "")}" /></div>
    <div class="form-row"><label>Email (ghi chu)</label>
      <input id="f_email" value="${escapeAttr(o.email || "")}" placeholder="email gan voi tai khoan zalo" /></div>
    <div class="form-row"><label>Proxy</label>
      <input id="f_proxy" value="${escapeAttr(o.proxy || "")}" placeholder="http://user:pass@host:port" />
      <div class="hint">De trong neu khong dung proxy.</div></div>
    <div class="form-row"><label>${escapeHtml(aiName)}</label>
      <input id="f_ai" placeholder="${c.ai_key_set ? "Da co key (de trong neu khong doi)" : "Dan API key moi"}" />
      <div class="hint">Trang thai: ${c.ai_key_set ? "Da cau hinh" : "Chua cau hinh"}</div></div>
    <hr style="border-color:var(--border);margin:22px 0" />
    <h3>Phien Zalo (thu cong)</h3>
    <p class="hint">Khuyen dung tab "Dang nhap QR". Hoac dan cookie + imei thu cong o day.</p>
    <div class="form-row"><label>IMEI</label>
      <input id="f_imei" placeholder="de trong neu khong doi" />
      <div class="hint">Trang thai: ${c.imei_set ? "Da co" : "Chua co"}</div></div>
    <div class="form-row"><label>Cookie (chuoi "k=v; k=v" hoac JSON)</label>
      <textarea id="f_cookie" placeholder="de trong neu khong doi"></textarea>
      <div class="hint">Hien co <b>${c.cookie_count}</b> cookie.</div></div>
    <button class="primary" id="btnSaveSettings">Luu cai dat</button>`;
  $("btnSaveSettings").onclick = saveSettings;
}

async function saveSettings() {
  const body = {
    name_bot: val("f_name"), prefix: val("f_prefix"), admin: val("f_admin"),
    email: val("f_email"), proxy: val("f_proxy"),
  };
  const ai = val("f_ai"); if (ai) body.ai_key = ai;
  const imei = val("f_imei"); if (imei) body.imei = imei;
  const cookie = val("f_cookie"); if (cookie) body.cookie = cookie;
  $("btnSaveSettings").disabled = true;
  try {
    await api(`/api/bots/${currentId}/settings`, "POST", body);
    toast("Da luu cai dat.");
    await refreshDetail();
  } catch (e) {
    toast("Loi: " + e.message, true);
  } finally {
    $("btnSaveSettings").disabled = false;
  }
}

// ---- top bar actions ----
$("btnStart").onclick = () => action("start");
$("btnStop").onclick = () => action("stop");
$("btnRestart").onclick = () => action("restart");
$("autorestart").onchange = async (e) => {
  await api(`/api/bots/${currentId}/settings`, "POST", { autorestart: e.target.checked });
  toast("Tu sua loi: " + (e.target.checked ? "BAT" : "TAT"));
};

async function action(kind) {
  if (!currentId) return;
  try {
    const r = await api(`/api/bots/${currentId}/${kind}`, "POST");
    toast(r.message || "OK");
    await refreshDetail();
    if (currentTab === "logs") switchTab("logs");
  } catch (e) {
    toast("Loi: " + e.message, true);
  }
}

// ---- helpers ----
function val(id) { const e = $(id); return e ? e.value.trim() : ""; }
function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }

// poll bot statuses periodically
statusTimer = setInterval(async () => {
  try {
    const data = await api("/api/bots");
    bots = bots.map((b) => {
      const fresh = data.bots.find((x) => x.id === b.id);
      return fresh ? { ...b, process: fresh.process, overlay: fresh.overlay } : b;
    });
    renderSidebar();
    if (currentId) {
      const b = curBot();
      if (b) {
        const st = b.process.status || "stopped";
        $("statusBadge").textContent = st;
        $("statusBadge").className = "badge " + st;
      }
    }
  } catch (e) {}
}, 4000);

loadBots();
