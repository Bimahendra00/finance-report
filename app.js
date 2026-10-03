const form = document.getElementById("record-form");
const recordsList = document.getElementById("records");
const emptyMsg = document.getElementById("empty-msg");
const balanceEl = document.getElementById("balance");
const bankEl = document.getElementById("total-bank");
const cashEl = document.getElementById("total-cash");
const incomeEl = document.getElementById("total-income");
const expenseEl = document.getElementById("total-expense");
const liabilityEl = document.getElementById("total-liability");
const filterBtns = document.querySelectorAll(".filter");

const liabForm = document.getElementById("liability-form");
const liabList = document.getElementById("liabilities");
const liabEmptyMsg = document.getElementById("liab-empty-msg");
const payModal = document.getElementById("pay-modal");
const payNameEl = document.getElementById("pay-name");
const payRemainingEl = document.getElementById("pay-remaining");
const payAmountInput = document.getElementById("pay-amount");
const payConfirmBtn = document.getElementById("pay-confirm");
const payCancelBtn = document.getElementById("pay-cancel");

const recForm = document.getElementById("recurring-form");
const recList = document.getElementById("recurring");
const recEmptyMsg = document.getElementById("rec-empty-msg");

const moveForm = document.getElementById("move-form");

// Theme: saved choice wins, otherwise follow the OS. The inline script in
// <head> already applied it pre-paint; this just wires up the toggle.
const themeBtn = document.getElementById("theme-toggle");
function applyTheme(t) {
  document.documentElement.classList.toggle("dark", t === "dark");
  themeBtn.textContent = t === "dark" ? "☀️" : "🌙";
  try {
    localStorage.setItem("finance-theme", t);
  } catch (e) {}
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", t === "dark" ? "#0f172a" : "#f4f6f8");
}
themeBtn.addEventListener("click", () => {
  applyTheme(document.documentElement.classList.contains("dark") ? "light" : "dark");
});
let initialTheme = "light";
try {
  initialTheme =
    localStorage.getItem("finance-theme") ||
    (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
} catch (e) {}
applyTheme(initialTheme);

// PWA: cache the app shell for offline use. Needs http(s) — serve via
// `python3 -m http.server`, it won't register on file://.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

const STORAGE_KEY = "finance-records";
const LIAB_KEY = "finance-liabilities";
const REC_KEY = "finance-recurring";

let records = loadRecords();
let liabilities = loadLiabilities();
let recurring = loadRecurring();
let activeFilter = "all";
let payingId = null;

// Month scope for the income/expense cards. Balance is all-time on purpose:
// money carries over between months.
const _today = new Date();
let viewYear = _today.getFullYear();
let viewMonth = _today.getMonth();

const monthLabelEl = document.getElementById("month-label");
document.getElementById("month-prev").addEventListener("click", () => shiftMonth(-1));
document.getElementById("month-next").addEventListener("click", () => shiftMonth(1));
monthLabelEl.addEventListener("click", resetViewMonth);

function shiftMonth(delta) {
  viewMonth += delta;
  if (viewMonth < 0) { viewMonth = 11; viewYear--; }
  if (viewMonth > 11) { viewMonth = 0; viewYear++; }
  render();
}

function resetViewMonth() {
  const d = new Date();
  viewYear = d.getFullYear();
  viewMonth = d.getMonth();
  render();
}

function monthLabel() {
  return new Date(viewYear, viewMonth, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

function inViewMonth(dateStr) {
  if (!dateStr) return false;
  const parts = dateStr.split("-");
  return Number(parts[0]) === viewYear && Number(parts[1]) === viewMonth + 1;
}

migrateOldLiabilityRecords();

document.getElementById("date").valueAsDate = new Date();

form.addEventListener("submit", (e) => {
  e.preventDefault();

  const record = {
    id: Date.now(),
    description: document.getElementById("description").value.trim(),
    amount: parseAmount(document.getElementById("amount").value),
    type: document.getElementById("type").value,
    account: document.getElementById("account").value,
    date: document.getElementById("date").value,
  };

  if (!record.description || isNaN(record.amount) || record.amount <= 0) return;

  records.unshift(record);
  saveRecords();
  render();
  form.reset();
  document.getElementById("date").valueAsDate = new Date();
});

// Transfers move money between pockets: not income, not an expense.
moveForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const amount = parseAmount(document.getElementById("move-amount").value);
  if (isNaN(amount) || amount <= 0) return;
  const [from, to] = document.getElementById("move-direction").value.split("-");
  records.unshift({
    id: Date.now(),
    description: from === "bank" ? "Cash withdrawal" : "Cash deposit",
    amount,
    type: "transfer",
    date: todayISO(),
    from,
    to,
  });
  saveRecords();
  render();
  moveForm.reset();
});

filterBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    filterBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    activeFilter = btn.dataset.filter;
    render();
  });
});

recordsList.addEventListener("click", (e) => {
  const btn = e.target.closest(".delete-btn");
  if (!btn) return;
  const id = Number(btn.dataset.id);
  const rec = records.find((r) => r.id === id);
  // Reversing a liability payment restores the liability balance.
  if (rec && rec.liabilityId) {
    const liab = liabilities.find((l) => l.id === rec.liabilityId);
    if (liab) {
      liab.remaining = Math.min(liab.total, liab.remaining + rec.amount);
      saveLiabilities();
      renderLiabilities();
    }
  }
  // Deleting a recurring payment unchecks it for the period.
  if (rec && rec.recurringId) {
    const item = recurring.find((r) => r.id === rec.recurringId);
    if (item && item.lastPaid === rec.period) {
      item.lastPaid = null;
      saveRecurring();
      renderRecurring();
    }
  }
  records = records.filter((r) => r.id !== id);
  saveRecords();
  render();
});

liabForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("liab-name").value.trim();
  const amount = parseAmount(document.getElementById("liab-amount").value);
  if (!name || isNaN(amount) || amount <= 0) return;
  liabilities.unshift({ id: Date.now(), name, total: amount, remaining: amount });
  saveLiabilities();
  renderLiabilities();
  liabForm.reset();
});

liabList.addEventListener("click", (e) => {
  const payBtn = e.target.closest(".pay-btn");
  if (payBtn) {
    openPayModal(Number(payBtn.dataset.id));
    return;
  }
  const delBtn = e.target.closest(".delete-btn");
  if (delBtn) {
    const id = Number(delBtn.dataset.id);
    const liab = liabilities.find((l) => l.id === id);
    if (liab && confirm(`Delete "${liab.name}"?`)) {
      liabilities = liabilities.filter((l) => l.id !== id);
      saveLiabilities();
      renderLiabilities();
    }
  }
});

function openPayModal(id) {
  const liab = liabilities.find((l) => l.id === id);
  if (!liab || liab.remaining <= 0) return;
  payingId = id;
  payNameEl.textContent = liab.name;
  payRemainingEl.textContent = formatMoney(liab.remaining);
  payAmountInput.value = "";
  payModal.hidden = false;
  payAmountInput.focus();
}

function closePayModal() {
  payModal.hidden = true;
  payingId = null;
}

payConfirmBtn.addEventListener("click", () => {
  const liab = liabilities.find((l) => l.id === payingId);
  const amount = parseAmount(payAmountInput.value);
  if (!liab || isNaN(amount) || amount <= 0) return;
  const paid = Math.min(amount, liab.remaining);
  liab.remaining -= paid;
  // A payment is money out, so it also lands in expenses.
  records.unshift({
    id: Date.now(),
    description: `Pay ${liab.name}`,
    amount: paid,
    type: "expense",
    date: todayISO(),
    liabilityId: liab.id,
  });
  saveRecords();
  saveLiabilities();
  render();
  renderLiabilities();
  closePayModal();
});

payCancelBtn.addEventListener("click", closePayModal);

payAmountInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") payConfirmBtn.click();
});

payModal.addEventListener("click", (e) => {
  if (e.target === payModal) closePayModal();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !payModal.hidden) closePayModal();
});

// Recurring bills ------------------------------------------------------

recForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("rec-name").value.trim();
  const amount = parseAmount(document.getElementById("rec-amount").value);
  const period = document.getElementById("rec-period").value;
  if (!name || isNaN(amount) || amount <= 0) return;
  recurring.unshift({ id: Date.now(), name, amount, period, lastPaid: null });
  saveRecurring();
  renderRecurring();
  recForm.reset();
});

recList.addEventListener("change", (e) => {
  const cb = e.target.closest('input[type="checkbox"]');
  if (!cb) return;
  const id = Number(cb.dataset.id);
  const item = recurring.find((r) => r.id === id);
  if (!item) return;
  const key = currentPeriodKey(item.period);
  if (cb.checked) {
    item.lastPaid = key;
    records.unshift({
      id: Date.now(),
      description: item.name,
      amount: item.amount,
      type: "expense",
      date: todayISO(),
      recurringId: item.id,
      period: key,
    });
  } else {
    // Unchecking removes this period's expense.
    records = records.filter(
      (r) => !(r.recurringId === item.id && r.period === key)
    );
    item.lastPaid = null;
  }
  saveRecords();
  saveRecurring();
  render();
  renderRecurring();
});

recList.addEventListener("click", (e) => {
  const delBtn = e.target.closest(".delete-btn");
  if (!delBtn) return;
  const id = Number(delBtn.dataset.id);
  const item = recurring.find((r) => r.id === id);
  if (item && confirm(`Delete "${item.name}"?`)) {
    const key = currentPeriodKey(item.period);
    records = records.filter(
      (r) => !(r.recurringId === id && r.period === key)
    );
    recurring = recurring.filter((r) => r.id !== id);
    saveRecords();
    saveRecurring();
    render();
    renderRecurring();
  }
});

function renderRecurring() {
  recList.innerHTML = "";
  recEmptyMsg.style.display = recurring.length ? "none" : "block";

  recurring.forEach((item) => {
    const paid = item.lastPaid === currentPeriodKey(item.period);
    const li = document.createElement("li");
    li.className = "rec-item" + (paid ? " paid" : "");
    li.innerHTML = `
      <input type="checkbox" data-id="${item.id}" ${paid ? "checked" : ""} />
      <div class="rec-info">
        <span class="rec-name">${escapeHtml(item.name)}</span>
        <span class="rec-meta">${item.period === "weekly" ? "Weekly" : "Monthly"}</span>
      </div>
      <span class="rec-amount">${formatMoney(item.amount)}</span>
      <button class="delete-btn" data-id="${item.id}" title="Delete">&times;</button>`;
    recList.appendChild(li);
  });
}

// "2026-10" for monthly, "2026-W40" for weekly. Checked state is derived
// from lastPaid, so a new period automatically unchecks everything.
function currentPeriodKey(period) {
  const d = new Date();
  if (period === "weekly") {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
    return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Format amount fields with thousand separators on blur,
// so what you typed is easy to verify.
["amount", "liab-amount", "pay-amount", "rec-amount", "move-amount"].forEach((id) => {
  document.getElementById(id).addEventListener("blur", (e) => {
    if (e.target.value.trim()) e.target.value = formatInputAmount(e.target.value);
  });
});

function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function loadLiabilities() {
  try {
    return JSON.parse(localStorage.getItem(LIAB_KEY)) || [];
  } catch {
    return [];
  }
}

function loadRecurring() {
  try {
    return JSON.parse(localStorage.getItem(REC_KEY)) || [];
  } catch {
    return [];
  }
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function saveLiabilities() {
  localStorage.setItem(LIAB_KEY, JSON.stringify(liabilities));
}

function saveRecurring() {
  localStorage.setItem(REC_KEY, JSON.stringify(recurring));
}

// One-time migration from the old flat "liability" record type
// to named liability accounts.
function migrateOldLiabilityRecords() {
  const old = records.filter((r) => r.type === "liability");
  if (!old.length) return;
  old.forEach((r) => {
    liabilities.unshift({
      id: r.id,
      name: r.description,
      total: r.amount,
      remaining: r.amount,
    });
  });
  records = records.filter((r) => r.type !== "liability");
  saveRecords();
  saveLiabilities();
}

// Parses Indonesian-formatted amounts: dots are thousand separators,
// comma is the decimal separator.
// "1.500.000" -> 1500000, "1.500,50" -> 1500.5
function parseAmount(str) {
  const cleaned = String(str).trim().replace(/\./g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? NaN : n;
}

function formatInputAmount(str) {
  const n = parseAmount(str);
  if (isNaN(n)) return str;
  const [intPart, decPart] = String(n).split(".");
  const grouped = Number(intPart).toLocaleString("id-ID");
  return decPart ? grouped + "," + decPart : grouped;
}

function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function formatMoney(n) {
  return "Rp " + n.toLocaleString("id-ID");
}

// Balances per pocket. Old records without an account count as bank.
// Transfers cancel out of the total by construction.
function accountBalances() {
  let bank = 0;
  let cash = 0;
  records.forEach((r) => {
    if (r.type === "transfer") {
      if (r.from === "bank") { bank -= r.amount; cash += r.amount; }
      else { bank += r.amount; cash -= r.amount; }
    } else {
      const delta = r.type === "income" ? r.amount : -r.amount;
      if ((r.account || "bank") === "bank") bank += delta;
      else cash += delta;
    }
  });
  return { bank, cash };
}

function render() {
  const monthRecords = records.filter((r) => inViewMonth(r.date));
  const income = monthRecords
    .filter((r) => r.type === "income")
    .reduce((sum, r) => sum + r.amount, 0);
  const expense = monthRecords
    .filter((r) => r.type === "expense")
    .reduce((sum, r) => sum + r.amount, 0);
  // Balance carries over: all-time income minus all-time expenses.
  const allIncome = records
    .filter((r) => r.type === "income")
    .reduce((sum, r) => sum + r.amount, 0);
  const allExpense = records
    .filter((r) => r.type === "expense")
    .reduce((sum, r) => sum + r.amount, 0);
  const { bank, cash } = accountBalances();

  balanceEl.textContent = formatMoney(allIncome - allExpense);
  bankEl.textContent = formatMoney(bank);
  cashEl.textContent = formatMoney(cash);
  incomeEl.textContent = formatMoney(income);
  expenseEl.textContent = formatMoney(expense);
  monthLabelEl.textContent = monthLabel();

  const visible =
    activeFilter === "all"
      ? records
      : records.filter((r) => r.type === activeFilter);

  recordsList.innerHTML = "";
  emptyMsg.style.display = visible.length ? "none" : "block";

  visible.forEach((r) => {
    const li = document.createElement("li");
    const sign = r.type === "income" ? "+ " : r.type === "expense" ? "- " : "";
    li.innerHTML = `
      <div class="record-info">
        <span class="record-desc">${escapeHtml(r.description)}</span>
        <span class="record-date">${r.date}</span>
      </div>
      <div class="record-right">
        <span class="record-amount ${r.type}">${sign}${formatMoney(r.amount)}</span>
        <button class="delete-btn" data-id="${r.id}" title="Delete">&times;</button>
      </div>`;
    recordsList.appendChild(li);
  });
}

function renderLiabilities() {
  const totalRemaining = liabilities.reduce((sum, l) => sum + l.remaining, 0);
  liabilityEl.textContent = formatMoney(totalRemaining);

  liabList.innerHTML = "";
  liabEmptyMsg.style.display = liabilities.length ? "none" : "block";

  liabilities.forEach((l) => {
    const paidPct =
      l.total > 0 ? Math.round(((l.total - l.remaining) / l.total) * 100) : 0;
    const done = l.remaining <= 0;
    const li = document.createElement("li");
    li.className = "liab-item" + (done ? " paid-off" : "");
    li.innerHTML = `
      <div class="liab-info">
        <span class="record-desc">${escapeHtml(l.name)}${done ? '<span class="paid-badge">paid off</span>' : ""}</span>
        <span class="record-date">${formatMoney(l.remaining)} remaining of ${formatMoney(l.total)}</span>
        <div class="progress"><div class="progress-fill" style="width: ${paidPct}%"></div></div>
      </div>
      <div class="record-right">
        ${done ? "" : `<button class="pay-btn" data-id="${l.id}">Pay</button>`}
        <button class="delete-btn" data-id="${l.id}" title="Delete">&times;</button>
      </div>`;
    liabList.appendChild(li);
  });
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

render();
renderLiabilities();
renderRecurring();

// Bottom tab navigation ----------------------------------------------

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".tab-page").forEach((p) => p.classList.remove("active"));
    document.getElementById("page-" + btn.dataset.tab).classList.add("active");
    window.scrollTo(0, 0);
  });
});

// Backup: export / import ---------------------------------------------

const exportBtn = document.getElementById("export-btn");
const importBtn = document.getElementById("import-btn");
const importFile = document.getElementById("import-file");

exportBtn.addEventListener("click", () => {
  const data = {
    app: "finance-report",
    version: 1,
    exportedAt: new Date().toISOString(),
    records,
    liabilities,
    recurring,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `finance-backup-${todayISO()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

importBtn.addEventListener("click", () => importFile.click());

importFile.addEventListener("change", () => {
  const file = importFile.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (
        !data ||
        !Array.isArray(data.records) ||
        !Array.isArray(data.liabilities) ||
        !Array.isArray(data.recurring)
      ) {
        throw new Error("bad shape");
      }
      const when = data.exportedAt ? data.exportedAt.slice(0, 10) : "unknown date";
      if (
        !confirm(
          `Import backup from ${when}? This replaces all current data. ` +
          `(${data.records.length} records, ${data.liabilities.length} liabilities, ` +
          `${data.recurring.length} recurring bills)`
        )
      ) {
        return;
      }
      records = data.records;
      liabilities = data.liabilities;
      recurring = data.recurring;
      saveRecords();
      saveLiabilities();
      saveRecurring();
      render();
      renderLiabilities();
      renderRecurring();
    } catch (e) {
      alert("That file doesn't look like a finance-report backup.");
    } finally {
      importFile.value = "";
    }
  };
  reader.readAsText(file);
});
