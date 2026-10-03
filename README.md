# Finance Record

A simple personal finance tracker. Add income and expense records, track
named liabilities (debts) and pay them down one by one, see your balance at
a glance, and filter the history. Data is stored in the browser via
`localStorage` — no backend needed.

## Run it

Just open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

Served over `http://localhost` (not `file://`), it works as an installable
PWA: the service worker caches the app shell for offline use, and browsers
offer "Install app" for a fullscreen home-screen icon.

## Features

- Add income / expense records with description, amount, date, and account (bank or cash)
- Move money between bank and cash as transfers — not income, not an expense
- Bank / cash / total balance cards; monthly income/expense summary with a month navigator
- Named liabilities with remaining balances, progress bars, and per-liability payments
- Liability payments are logged as expenses, so your balance drops too (deleting the payment restores the liability)
- Recurring bills (monthly/weekly) as a compact checklist — checking one logs it as an expense for the period, auto-resets next period
- Amount fields accept Indonesian thousand separators (`1.500.000`) and decimal comma (`1.500,50`)
- Live balance, income, expense, and total-liability figures
- Filter records by type
- Delete records and liabilities
- Persists in `localStorage`
