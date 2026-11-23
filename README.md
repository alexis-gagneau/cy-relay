# CY Relay

Unofficial personal relay for **CY Cergy Paris Université** (CYU) student services —
*your CYU campus, relayed*: the CELCAT timetable today, your student mailbox next.

> ⚠️ **Disclaimer** — This project is not affiliated with, endorsed by, or connected to
> CY Cergy Paris Université or RENATER. It uses the owner's own student credentials,
> for personal use only. Use responsibly and respect your institution's IT policies.

## What it does

### ✅ Timetable → subscribable ICS feeds (current)

- Scrapes the CYU **CELCAT** timetable (`celcat-calendar.cyu.fr`) with your own
  credentials (anti-forgery token + session cookies).
- Shapes raw events: titles, rooms, buildings, capacities, professors, sites
  (with Apple structured locations).
- Generates **seven ICS feeds** — full calendar, CM, TD, TP, CC, exams, other — ready to
  subscribe to from Apple Calendar, Google Calendar, or anything that speaks ICS.

### 🚧 Mailbox relay (planned)

The university disables mail forwarding and direct IMAP/SMTP access on student
mailboxes (`service.PERM_DENIED: forwarding not enabled`), so the relay will:

- sign in through the **CYU SSO** (Shibboleth IdP → CAS → SAML), like a browser;
- poll the inbox through the Zimbra (RENATER Partage) REST API;
- push a notification card to a personal address for every new unread message,
  with `Reply-To` set to the original sender(s).

## Project layout

```
index.js                          entry point + file logging
services/scrappingService.js      CELCAT scraping (calendar + per-event sidebar)
managers/networkManager.js        HTTP + CELCAT session (anti-forgery token, cookies)
managers/eventShapeManager.js     event shaping (titles, rooms, sites, professors)
managers/calendarStoreManager.js  ICS generation (one feed per event category)
configs/constants.js              event types, campus sites, ICS templates
configs/env.js                    .env loader + credentials access
configs/settings.json             non-secret settings (endpoints, selectors, paths)
utils/dateUtils.js                date helpers
```

## Configuration

Two files, two purposes:

| File | Committed? | Contents |
|---|---|---|
| `.env` | ❌ never | Secrets: `CYU_ID`, `CYU_USERNAME`, `CYU_PASSWORD` |
| `configs/settings.json` | ✅ | Non-secret settings: CELCAT endpoints, DOM selectors, ICS output path |

```bash
cp .env.example .env    # then fill in your CYU credentials
```

## Getting started

```bash
npm install
node index.js
```

ICS feeds are written to the path configured in `configs/settings.json` (`ics_path`).

### Docker

```bash
docker build -t cy-relay .
docker run --env-file .env \
  -v "$(pwd)/output:/app/output" \
  -v "$(pwd)/logs:/app/logs" \
  cy-relay
```

### Logs

Logs go to **both** stdout (so `docker logs cy-relay` works) and `logs/celcat.log`.
The log file is rotated at startup once it exceeds 5 MB (archived as `celcat.log.<date>.old`).

## Security

- `.env` (real credentials) is **git-ignored** — never commit it.
- Failed logins can temporarily lock a CYU directory account: never retry
  credentials in a loop. Any automation must stop after a single rejection.

## Roadmap

- [x] CELCAT → seven ICS feeds (one per event category, dynamic academic year)
- [ ] Mailbox relay: CYU SSO → inbox polling → notifications with `Reply-To`
- [ ] Resilient scheduling (exponential backoff, night pause)
- [ ] Full English codebase and comments

## License

[MIT](LICENSE)
