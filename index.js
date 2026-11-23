const { event_scrapper } = require('./services//scrappingService');
const { generateICSCalendars } = require('./managers/calendarStoreManager');
const { check_mail, send_test_notification } = require('./managers/mailManager');
const { create_logger } = require('./managers/logManager');

const pkg = require('./package.json');
const log = create_logger('core');

log.info(`${pkg.name} v${pkg.version} — node ${process.version}, Europe/Paris`);

// --- Scheduling -------------------------------------------------------------
// Set SCHEDULE in .env (cron syntax, e.g. "*/10 * * * *") to keep the process
// alive and re-scrape automatically (Europe/Paris). Without it, the app runs
// once and exits — perfect for an external cron job.
const SCHEDULE = process.env.SCHEDULE;
log.info(SCHEDULE ? `schedule: "${SCHEDULE}"` : 'schedule: none — single run then exit');

const MAIL_ENABLED = Boolean(process.env.MAIL_ADDRESS && process.env.MAIL_NOTIFY_TO);
log.info(MAIL_ENABLED ? `mail relay: enabled -> ${process.env.MAIL_NOTIFY_TO}` : 'mail relay: disabled (MAIL_ADDRESS / MAIL_NOTIFY_TO not set)');

let runCount = 0;

async function main() {
    const runId = ++runCount;
    const startedAt = Date.now();
    log.info(`── run #${runId} started ──`);

    let calendar = await event_scrapper();
    generateICSCalendars(calendar);

    // Mail relay: a mail failure must never kill the timetable run.
    if (MAIL_ENABLED) {
        try {
            await check_mail();
        } catch (error) {
            log.error(`mail check failed: ${error.message}`);
        }
    }

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
} else if (SCHEDULE) {
    const cron = require('node-cron');

    if (!cron.validate(SCHEDULE)) {
        log.error(`invalid SCHEDULE: "${SCHEDULE}"`);
        process.exit(1);
    }

    const run = () => main().catch(error => log.error(`run #${runCount} fatal: ${error.message}`));
    run();
    cron.schedule(SCHEDULE, run);
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
