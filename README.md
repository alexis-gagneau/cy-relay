# CY Relay

Unofficial personal relay for **CY Cergy Paris Université** (CYU) student services —
*your CYU campus, relayed*: the CELCAT timetable and your student mailbox, in the
tools you actually use.

> ⚠️ **Disclaimer** — This project is not affiliated with, endorsed by, or connected to
> CY Cergy Paris Université or RENATER. It uses the owner's own student credentials,
> for personal use only. Use responsibly and respect your institution's IT policies.

## What it does

### Timetable → subscribable ICS feeds

- Scrapes the CYU **CELCAT** timetable (`celcat-calendar.cyu.fr`) with your own
  credentials (anti-forgery token + session cookies).
- Shapes raw events: titles, rooms, buildings, capacities, professors, sites
  (with Apple structured locations).
- Generates **seven ICS feeds** — full calendar, CM, TD, TP, CC, exams, other — ready
  to subscribe to from Apple Calendar, Google Calendar, or anything that speaks ICS.
  Variants like *TD à distance* or *CM par groupe de TD* are filed under their base
  category feed (TD à distance → TD, CM par groupe de TD → CM).
- Dynamic academic year (September 1 → June 30).

### Mailbox relay

The university disables mail forwarding and direct IMAP/SMTP access on student
mailboxes (`service.PERM_DENIED: forwarding not enabled`), so the relay replays the
web SSO flow (Shibboleth IdP → CAS → SAML) like a browser, then polls the inbox
through the Zimbra (RENATER Partage) REST API.

Every new **unread** message is transferred as-is to a personal address:

- original subject and untouched body — it reads like a mail landing directly in
  your box, with the real sender's name as the From;
- attachments re-attached, no `.eml` wrapper;
- `Reply-To` set to the original sender(s) — answering the transfer answers them,
  straight from your personal mailbox;
- a single discreet line at the very bottom for traceability:
  `Transféré par CY Relay · expéditeur d'origine : … · reçu le …`;
- the first run marks the existing inbox as seen, so no flood on day one.

Safety rails: credentials are sent exactly once per SSO flow (never retried on
network errors), and a refused login locks the relay until the password is fixed —
the CYU account is never brute-forced.

## Quick start (Docker Compose)

```bash
git clone <repo> && cd cy-relay
cp .env.example .env        # then fill in your CYU credentials
docker compose up -d --build
docker logs -f cy-relay     # watch the runs
```

The committed `docker-compose.yml` keeps the container alive on the schedules
below and mounts `output/` and `logs/` — the ICS feeds are subscribeable from
whatever URL serves that folder.

## Configuration

One file: **`.env`** (see [`.env.example`](.env.example) for every key). Three keys
are required — your numeric student id, your directory login and your password.
Everything else (schedules, active window, mail relay, log level) is optional and
commented in the example file. `.env` is git-ignored: never commit it.

## Running without Docker

```bash
npm install
node index.js               # one run, then exits
node index.js --test-mail   # transfers a test message to MAIL_NOTIFY_TO
```

ICS feeds are written to the `ics_path` from `configs/settings.json`.

## Schedules

`SCHEDULE` is the default cadence for every service; `CELCAT_SCHEDULE` and
`MAIL_SCHEDULE` override it per service. The compose defaults: timetable `*/10`
(changes are rare), mailbox probe `*/3` — a probe is a single light GET with the
session kept warm, so a short interval costs nothing.

`ACTIVE_WINDOW` (e.g. `8-20`, local hours) keeps the relay awake only between
those hours: nothing is scraped or polled overnight, and anything received at
night transfers at the first tick of the window.

## Diagnostics

Three small tools live in `tools/` and read the same `.env` and `runtime/` state
as the app:

- `node tools/inspect-celcat.js` — logs in and dumps the raw CELCAT events plus
  the distinct event categories;
- `node tools/inspect-sso.js` — replays the mailbox SSO flow and shows every form
  along the way (GET-only by default; `--post` sends the credentials once and
  saves the session);
- `node tools/send-self-mail.js` — sends a message to your own CYU inbox, so the
  next mail tick transfers it to your personal address (end-to-end test).

Inside the container: `docker exec cy-relay node tools/inspect-celcat.js`.

## Logs

Structured and component-tagged:

```
[23/11/2026 18:39:38] INFO  [core] celcat schedule: "*/10 * * * *"
[23/11/2026 18:40:00] INFO  [core] ── run #2 started ──
[23/11/2026 18:40:05] WARN  [celcat] network error (...) — retry 2/3...
[23/11/2026 18:40:11] ERROR [mail] transfer failed for 9797 — will retry next tick
```

- levels `DEBUG` / `INFO` / `WARN` / `ERROR`, filtered by `LOG_LEVEL` (default `info`);
- components `[core]` (run lifecycle), `[celcat]` (timetable), `[mail]` (relay);
- everything goes to stdout (so `docker logs` works) **and** to `logs/cy-relay.log`,
  rotated at startup past 5 MB.

## Security

- `.env` (real credentials) is **git-ignored** — never commit it.
- Refused logins lock the mailbox SSO until the password is fixed (fingerprint
  auto-unlock) — the CYU directory is never brute-forced.

## License

[MIT](LICENSE)
