# 🌀 CY Relay

Unofficial personal relay for **CY Cergy Paris Université** (CYU) student services —
*your CYU campus, relayed*: the CELCAT timetable and your student mailbox, in the
tools you actually use.

> ⚠️ **Disclaimer** — not affiliated with or endorsed by CY Cergy Paris Université or
> RENATER. Uses the owner's own student credentials, for personal use only. Respect
> your institution's IT policies.

## ✨ What it does

CYU student services are web-only: the CELCAT timetable has no ICS feed, the student
mailbox refuses forwarding and IMAP/SMTP, and everything sits behind a login you have
to open (and refresh) yourself. CY Relay signs in with your own credentials on a
schedule, and relays what matters to where you actually live — your calendar and your
personal inbox. No university infrastructure involved.

### 📅 Timetable → subscribable ICS feeds

Logs into CELCAT with your credentials and generates **seven ICS feeds** — full
calendar, CM, TD, TP, CC, exams, other — that your calendar app subscribes to.
Variants like *TD à distance* are filed under their base feed (TD → TD). Your
timetable, without ever opening the site.

### 📬 Mailbox → personal inbox

Signs in through the CYU SSO like a browser, polls the Zimbra inbox, and transfers
every new **unread** message as-is to a personal address: original subject, untouched
body, attachments included, the real sender's name as From — and `Reply-To` pointing
at them, so answering the transfer answers them. One discreet line at the very bottom
marks the transfer: `Transféré par CY Relay · …`.

## 🧰 Setup

### 1️⃣ Clone

```bash
git clone https://github.com/alexis-gagneau/cy-relay.git && cd cy-relay
```

### 2️⃣ Configure

```bash
cp .env.example .env
```

Then fill in your CYU credentials (numeric student id, directory login, password).
That's the only file to touch — every optional knob (schedules, active window, mail
relay, log level) is commented in [`.env.example`](.env.example). `.env` is
git-ignored: never commit it.

### 3️⃣ Run

#### 🟢 Without Docker

```bash
npm install
node index.js               # one run, then exits
node index.js --test-mail   # transfers a test message to MAIL_NOTIFY_TO
```

Feeds are written to the `ics_path` from `configs/settings.json`.

#### 🐳 With Docker

```bash
docker build -t cy-relay .
docker run --env-file .env -v "$(pwd)/output:/app/output" -v "$(pwd)/logs:/app/logs" \
  -e CELCAT_SCHEDULE="*/10 * * * *" -e MAIL_SCHEDULE="*/3 * * * *" cy-relay
```

#### ⭐ With Docker Compose (recommended)

```bash
docker compose up -d --build
docker logs -f cy-relay
```

The committed `docker-compose.yml` keeps the container alive on the schedules below
and mounts `output/` and `logs/` — subscribe your calendar app to the ICS feeds and
you're done.

## ⏱️ Schedules

`SCHEDULE` is the default cadence; `CELCAT_SCHEDULE` and `MAIL_SCHEDULE` override it
per service (compose defaults: timetable `*/10`, mailbox probe `*/3` — the probe is a
single light GET with the session kept warm).

`ACTIVE_WINDOW` (e.g. `8-20`, local hours) keeps the relay awake only between those
hours: nothing is scraped or polled overnight, and anything received at night
transfers at the first tick of the window.

## 🔍 Diagnostics

Small tools live in `tools/` and read the same `.env` and `runtime/` state as the app:

- `node tools/inspect-celcat.js` — logs in and dumps the raw CELCAT events plus the
  distinct event categories;
- `node tools/inspect-sso.js` — replays the mailbox SSO flow and shows every form
  (GET-only by default; `--post` sends the credentials once and saves the session);
- `node tools/send-self-mail.js` — sends a message to your own CYU inbox, so the next
  mail tick transfers it to your personal address (end-to-end test).

Inside the container: `docker exec cy-relay node tools/inspect-celcat.js`.

## 📜 Logs

Structured and component-tagged:

```
[23/11/2026 18:39:38] INFO  [core] celcat schedule: "*/10 * * * *"
[23/11/2026 18:40:00] INFO  [core] ── run #2 started ──
[23/11/2026 18:40:05] WARN  [celcat] network error (...) — retry 2/3...
[23/11/2026 18:40:11] ERROR [mail] transfer failed for 9797 — will retry next tick
```

Levels `DEBUG` / `INFO` / `WARN` / `ERROR` (filter with `LOG_LEVEL`), components
`[core]` / `[celcat]` / `[mail]`; everything goes to stdout **and** to
`logs/cy-relay.log` (rotated past 5 MB).

## 🔒 Security

Your credentials live only in your local `.env` and are used solely to authenticate
against CYU services — nothing is stored, logged or sent anywhere else. A refused
login locks the mailbox SSO instead of retrying (the CYU directory blocks accounts
after repeated failures).

## 🤝 Credits

CY Relay started as a personal project by Alexis Gagneau: the timetable scraper is
the original hand-written core. The mailbox relay, the structured logging, the docs
and a large part of the hardening were developed with the help of an AI coding agent
([OpenCode](https://opencode.ai)), under human direction and review.

## 📄 License

[MIT](LICENSE)
