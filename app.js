const form = document.getElementById("record-form");
const recordsList = document.getElementById("records");
const emptyMsg = document.getElementById("empty-msg");
const balanceEl = document.getElementById("balance");
const incomeEl = document.getElementById("total-income");
const expenseEl = document.getElementById("total-expense");
const filterBtns = document.querySelectorAll(".filter");

const STORAGE_KEY = "finance-records";

let records = loadRecords();
let activeFilter = "all";

document.getElementById("date").valueAsDate = new Date();

form.addEventListener("submit", (e) => {
  e.preventDefault();

  const record = {
    id: Date.now(),
    description: document.getElementById("description").value.trim(),
    amount: parseFloat(document.getElementById("amount").value),
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
  records = records.filter((r) => r.id !== Number(btn.dataset.id));
  saveRecords();
  render();
});

function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
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
    const sign = r.type === "income" ? "+" : "-";
    li.innerHTML = `
      <div class="record-info">
        <span class="record-desc">${escapeHtml(r.description)}</span>
        <span class="record-date">${r.date}</span>
      </div>
      <div class="record-right">
        <span class="record-amount ${r.type}">${sign} ${formatMoney(r.amount)}</span>
        <button class="delete-btn" data-id="${r.id}" title="Delete">&times;</button>
      </div>`;
    recordsList.appendChild(li);
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
