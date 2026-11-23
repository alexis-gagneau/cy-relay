# CY Campus Relay

Unofficial, personal tooling for **CY Cergy Paris Université** student services.
The project relays what the university does not expose through standard, student-friendly
channels — today the CELCAT timetable, and soon the student mailbox.

> ⚠️ **Disclaimer** — This project is **not** affiliated with, endorsed by, or connected to
> CY Cergy Paris Université or RENATER. It automates access to student-facing services with
> the owner's own student credentials, for personal use only. Use responsibly and respect
> your institution's IT rules.

## Features

### ✅ Timetable → subscribable calendar feeds (current)
- Logs into the **CELCAT** timetable web app (`celcat-calendar.cyu.fr`) with your own CYU
  credentials (anti-forgery token + session cookies).
- Pulls the calendar data (rolling window: last month → end of next year) plus the
  per-event sidebar (category, module, professors, rooms).
- Shapes raw events: normalized titles, room/building/capacity parsing, CYU & CY Tech
  site geolocation (Apple structured locations included).
- Generates **six ICS feeds** — full calendar, CM, TD, continuous assessment (CC),
  exams, and other events — ready to subscribe to from Apple Calendar, Google Calendar, etc.

### 🚧 Mailbox relay (planned)
The university blocks both native mail forwarding
(`service.PERM_DENIED: forwarding not enabled`) and direct IMAP/SMTP password access on
student mailboxes, so the relay will do it the app way:
- sign in through the CYU SSO (Shibboleth IdP → CAS → SAML), like a browser;
- poll the inbox through the Zimbra (RENATER Partage) REST API;
- push a notification card to a personal address for every new unread message,
  with `Reply-To` set to the original sender(s) so replies go to the right person.

## Project layout

```
index.js                          entry point + file logging
services/scrappingService.js      CELCAT scraping (calendar + per-event sidebar data)
managers/networkManager.js        HTTP requests + CELCAT session (anti-forgery token, cookies)
managers/eventShapeManager.js     event shaping (titles, rooms, sites, professors, English classes)
managers/calendarStoreManager.js  ICS generation (one feed per event category)
utils/dateUtils.js                date parsing helpers
configs/constants.js              event types, campus sites, ICS templates
configs/settings.json             credentials & endpoints — NOT committed (see .gitignore)
```

## Getting started

1. Create your local configuration:

   ```bash
   cp configs/settings.example.json configs/settings.json
   ```

   then fill in your CYU student id, username (`e-…`) and password.

2. Install and run:

   ```bash
   npm install
   node index.js
   ```

   ICS feeds are written to the path configured in `ics_path` (one per event category).

### Docker

```bash
docker build -t cy-campus-relay .
docker run -v "$(pwd)/configs:/app/configs" -v "$(pwd)/output:/app/output" cy-campus-relay
```

## Security notes

- `configs/settings.json` holds real credentials: it is **git-ignored** and must never be
  committed. Use `configs/settings.example.json` as the template.
- Repeated failed logins can temporarily lock a CYU directory account — never retry
  credentials in a loop. Any automation must stop after a single rejected attempt.

## Roadmap

- [ ] Mailbox notifications via the CYU SSO (Shibboleth/CAS/SAML) → personal e-mail with `Reply-To`
- [ ] Resilient scheduling: exponential backoff, night pause, credential-lockout guard
- [ ] Full English codebase and comments

## License

[MIT](LICENSE) — personal project.
