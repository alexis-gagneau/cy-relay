const { event_scrapper } = require('./services//scrappingService');
const { generateICSCalendars } = require('./managers/calendarStoreManager');
const { check_mail, send_test_notification } = require('./managers/mailManager');
const { create_logger } = require('./managers/logManager');

const pkg = require('./package.json');
const log = create_logger('core');

log.info(`${pkg.name} v${pkg.version} — node ${process.version}, Europe/Paris`);

// --- Scheduling -------------------------------------------------------------
// SCHEDULE keeps the process alive and re-scrapes the timetable on a cron
// (Europe/Paris). Without it, the app runs once and exits — perfect for an
// external cron job. MAIL_SCHEDULE gives the mailbox its own lighter cadence.
const SCHEDULE = process.env.SCHEDULE;
log.info(SCHEDULE ? `schedule: "${SCHEDULE}"` : 'schedule: none — single run then exit');

const MAIL_ENABLED = Boolean(process.env.MAIL_ADDRESS && process.env.MAIL_NOTIFY_TO);
log.info(MAIL_ENABLED ? `mail relay: enabled -> ${process.env.MAIL_NOTIFY_TO}` : 'mail relay: disabled (MAIL_ADDRESS / MAIL_NOTIFY_TO not set)');

// Mail cadence decoupled from the timetable: MAIL_SCHEDULE drives a light
// inbox probe (one REST GET — the session cookie persists, no re-login)
// while SCHEDULE keeps the heavier CELCAT scrape on its own rhythm.
const MAIL_SCHEDULE = process.env.MAIL_SCHEDULE;
if (MAIL_SCHEDULE && !MAIL_ENABLED) {
    log.warn('MAIL_SCHEDULE is set but the mail relay is not configured (MAIL_ADDRESS / MAIL_NOTIFY_TO missing) — ignored');
}

let runCount = 0;

// A tick slower than its interval is dropped, never queued (polling logic).
let mail_in_flight = false;
async function mail_tick() {
    if (mail_in_flight) return;
    mail_in_flight = true;
    try {
        await check_mail();
    } catch (error) {
        log.error(`mail tick failed: ${error.message}`);
    } finally {
        mail_in_flight = false;
    }
}

async function main() {
    const runId = ++runCount;
    const startedAt = Date.now();
    log.info(`── run #${runId} started ──`);

    let calendar = await event_scrapper();
    generateICSCalendars(calendar);

    // Inline mail check only when the mailbox has no schedule of its own.
    if (MAIL_ENABLED && !MAIL_SCHEDULE) await mail_tick();

    log.info(`── run #${runId} completed in ${((Date.now() - startedAt) / 1000).toFixed(1)}s ──`);
}

// `node index.js --test-mail` transfers a test message to MAIL_NOTIFY_TO.
if (process.argv.includes('--test-mail')) {
    send_test_notification().then(ok => {
        log[ok ? 'info' : 'error'](ok ? 'test transfer sent' : 'test transfer FAILED');
        process.exit(ok ? 0 : 1);
    }).catch(error => {
        log.error(`fatal: ${error.message}`);
        process.exit(1);
    });
} else if (SCHEDULE || (MAIL_SCHEDULE && MAIL_ENABLED)) {
    const cron = require('node-cron');

    if (SCHEDULE) {
        if (!cron.validate(SCHEDULE)) {
            log.error(`invalid SCHEDULE: "${SCHEDULE}"`);
            process.exit(1);
        }

        const run = () => main().catch(error => log.error(`run #${runCount} fatal: ${error.message}`));
        run();
        cron.schedule(SCHEDULE, run);
    }

    if (MAIL_SCHEDULE && MAIL_ENABLED) {
        if (!cron.validate(MAIL_SCHEDULE)) {
            log.error(`invalid MAIL_SCHEDULE: "${MAIL_SCHEDULE}"`);
            process.exit(1);
        }

        log.info(`mail schedule: "${MAIL_SCHEDULE}"`);
        mail_tick();
        cron.schedule(MAIL_SCHEDULE, mail_tick);
    }
} else {
    main().catch(error => {
        log.error(`fatal: ${error.message}`);
        process.exit(1);
    });
}

// Never die silently: log the failure, then flag the process as failed.
process.on('unhandledRejection', reason => {
    log.error(`unhandled rejection: ${reason instanceof Error ? reason.message : reason}`);
    process.exitCode = 1;
});
