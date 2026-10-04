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

- Material 3 interface with light/dark theme (follows system, toggle in header)
- Phone-style bottom navigation bar: Home, Records, Debts, Bills
- Floating + button with a quick-add bottom sheet: pick expense/income, tap a category, enter the amount — two taps and it's logged
- Categories with icons on every record (Food, Transport, Shopping, Bills, Health, Fun, Education, Salary, ...)
- Monthly budgets per category with progress bars ("Rp X of Rp Y", amount left / over)
- Installable PWA with offline support

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
- Export / import all data as a JSON backup file

## Android app (Capacitor)

The web app can be wrapped into a native APK. Data then lives in the app's
own sandbox, so clearing browser data can't wipe it. (Uninstalling the app
or clearing *its* storage still would — keep an exported backup.)

Prerequisites: Node.js and Android Studio (Studio installs the Android SDK
for you on first launch).

```bash
npm install
npx cap add android   # one-time: generates the native android/ project
npm run sync          # copies the web files into the project
```

Then open the `android/` folder in Android Studio and choose
**Build → Build App Bundle(s) / APK(s) → Build APK(s)**. The APK lands in
`android/app/build/outputs/apk/debug/`. Copy it to your phone, tap it, and
allow "install unknown apps" when asked.

After changing the web app, run `npm run sync` again and rebuild in Studio.
