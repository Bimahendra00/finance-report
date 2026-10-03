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

## Features

- Add income / expense records with description, amount, and date
- Named liabilities with remaining balances, progress bars, and per-liability payments
- Live balance, income, expense, and total-liability figures
- Filter records by type
- Delete records and liabilities
- Persists in `localStorage`
