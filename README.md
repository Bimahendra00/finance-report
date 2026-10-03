# Finance Record

A simple personal finance tracker. Add income, expense, and liability
records, see your balance at a glance, and filter the history. Data is
stored in the browser via `localStorage` — no backend needed.

## Run it

Just open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Features

- Add income / expense / liability records with description, amount, and date
- Live balance, income, expense, and liability totals
- Filter records by type
- Delete records
- Persists in `localStorage`
