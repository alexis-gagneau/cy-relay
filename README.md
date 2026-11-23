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
- Generates **seven ICS feeds** — full calendar, CM, TD, TP, CC, exams, other — ready to
  subscribe to from Apple Calendar, Google Calendar, or anything that speaks ICS.
  Variants like *TD à distance* or *CM par groupe de TD* are filed under their
  base category feed (TD à distance → TD, CM par groupe de TD → CM).
- Dynamic academic year (September 1 → June 30).

### Mailbox relay

The university disables mail forwarding and direct IMAP/SMTP access on student
mailboxes (`service.PERM_DENIED: forwarding not enabled`), so the relay replays
the web SSO flow (Shibboleth IdP → CAS → SAML) like a browser, then polls the
inbox through the Zimbra (RENATER Partage) REST API.

Every new **unread** message is transferred as-is to a personal address:

- original subject and untouched body — it reads like a mail landing directly
  in your box, with the real sender's name shown as the From;
- attachments re-attached, no `.eml` wrapper;
- `Reply-To` set to the original sender(s) — answering the transfer answers
  them, straight from your personal mailbox;
- a single discreet line at the very bottom for traceability:
  `Transféré par CY Relay · expéditeur d'origine : … · reçu le …`;
- the first run marks the existing inbox as seen, so no flood on setup.

Safety rails: credentials are sent exactly once per SSO flow (never retried on
network errors), and a refused login locks the relay until the password is
fixed — the CYU account is never brute-forced.

## Getting started

```bash
git clone <repo> && cd cy-relay
cp .env.example .env    # fill in your CYU credentials
npm install
node index.js
```

Configuration lives in **one file: `.env`** (see `.env.example` for the full
list of keys). Everything else — endpoints, selectors, output paths — is
committed in `configs/settings.json` and only needs touching if the university
changes its endpoints.

Optionally set in `.env`:

- `SCHEDULE` — cron syntax (e.g. `*/10 * * * *`): the process stays alive and
  re-runs on schedule (Europe/Paris). Unset, it runs once and exits.
- `MAIL_ADDRESS` + `MAIL_NOTIFY_TO` — enable the mailbox relay (your CYU
  address and the personal address receiving the transfers).
- `LOG_LEVEL` — `debug`, `info` (default), `warn` or `error`.

`node index.js --test-mail` sends a test transfer to `MAIL_NOTIFY_TO`.

## Output

ICS feeds are written next to `ics_path` from `configs/settings.json`
(default `/app/output/timetable`):

| File | Contents |
|---|---|
| `timetable.ics` | every event |
| `timetable_cm.ics` | CM |
| `timetable_td.ics` | TD |
| `timetable_tp.ics` | TP |
| `timetable_cc.ics` | CC |
| `timetable_exams.ics` | exams |
| `timetable_others.ics` | everything else |

Subscribe from your calendar app to the ones you want (all of them, or just
TD + TP + exams).

## Docker

```bash
docker build -t cy-relay .
docker run --env-file .env \
  -v "$(pwd)/output:/app/output" \
  -v "$(pwd)/logs:/app/logs" \
  cy-relay
```

### Scheduling

- **Inside the container** (recommended): set `SCHEDULE` (cron syntax, e.g.
  `*/10 * * * *`, Europe/Paris). The container stays up and re-runs on
  schedule — no external cron needed. Each service can also get its own
  cadence: `CELCAT_SCHEDULE` and `MAIL_SCHEDULE` override the `SCHEDULE`
  default per service (the mailbox probe is a single light GET — e.g. `*/10`
  for the timetable, `*/3` for the mailbox).
- **Outside**: leave the schedules unset and let a cron job / systemd timer
  run the container periodically — one run per invocation, then it exits.

## Logs

Structured and component-tagged:

```
[23/11/2026 15:27:37] INFO  [core]  ── run #1 started ──
[23/11/2026 15:27:42] INFO  [celcat] ICS calendars written to /app/output (71 event(s))
[23/11/2026 15:27:42] INFO  [mail]  transferred: Schedule change for tomorrow
[23/11/2026 15:27:42] INFO  [core]  ── run #1 completed in 6.2s ──
```

Levels `DEBUG` / `INFO` / `WARN` / `ERROR` (filter with `LOG_LEVEL`), components
`[core]` (run lifecycle), `[celcat]` (timetable) and `[mail]` (relay). Logs go
to **both** stdout (`docker logs` friendly) and `logs/cy-relay.log`, rotated at
startup past 5 MB.

## Security

- `.env` (real credentials) is **git-ignored** — never commit it.
- Failed logins can temporarily lock a CYU directory account: never retry
  credentials in a loop. Any automation must stop after a single rejection —
  this relay follows that rule (one SSO attempt per flow, auth-lock on refusal).

## Roadmap

- [x] CELCAT → seven ICS feeds (one per event category, dynamic academic year)
- [x] Mailbox relay: CYU SSO → inbox polling → as-is transfers with `Reply-To`
- [ ] Optional SMTP transport (service address) alongside the CYU sender
- [ ] Resilient scheduling (exponential backoff, night pause)
- [ ] Full English codebase and comments

## License

[MIT](LICENSE)
