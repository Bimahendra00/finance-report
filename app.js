const form = document.getElementById("record-form");
const recordsList = document.getElementById("records");
const emptyMsg = document.getElementById("empty-msg");
const balanceEl = document.getElementById("balance");
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

const STORAGE_KEY = "finance-records";
const LIAB_KEY = "finance-liabilities";

let records = loadRecords();
let liabilities = loadLiabilities();
let activeFilter = "all";
let payingId = null;

migrateOldLiabilityRecords();

document.getElementById("date").valueAsDate = new Date();

form.addEventListener("submit", (e) => {
  e.preventDefault();

  const record = {
    id: Date.now(),
    description: document.getElementById("description").value.trim(),
    amount: parseAmount(document.getElementById("amount").value),
    type: document.getElementById("type").value,
    date: document.getElementById("date").value,
  };

  if (!record.description || isNaN(record.amount) || record.amount <= 0) return;

  records.unshift(record);
  saveRecords();
  render();
  form.reset();
  document.getElementById("date").valueAsDate = new Date();
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

// Format amount fields with thousand separators on blur,
// so what you typed is easy to verify.
["amount", "liab-amount", "pay-amount"].forEach((id) => {
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

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function saveLiabilities() {
  localStorage.setItem(LIAB_KEY, JSON.stringify(liabilities));
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

function render() {
  const income = records
    .filter((r) => r.type === "income")
    .reduce((sum, r) => sum + r.amount, 0);
  const expense = records
    .filter((r) => r.type === "expense")
    .reduce((sum, r) => sum + r.amount, 0);

  balanceEl.textContent = formatMoney(income - expense);
  incomeEl.textContent = formatMoney(income);
  expenseEl.textContent = formatMoney(expense);

  const visible =
    activeFilter === "all"
      ? records
      : records.filter((r) => r.type === activeFilter);

  recordsList.innerHTML = "";
  emptyMsg.style.display = visible.length ? "none" : "block";

  visible.forEach((r) => {
    const li = document.createElement("li");
    const sign = r.type === "income" ? "+ " : "- ";
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
