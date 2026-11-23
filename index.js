const fs = require('fs');
const path = require('path');

const { event_scrapper } = require('./services//scrappingService');
const { generateICSCalendars } = require('./managers/calendarStoreManager');
const { check_mail, send_test_notification } = require('./managers/mailManager');

const logDirectory = './logs';
const logFile = path.join(logDirectory, 'celcat.log');
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5 MB before rotating

if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory, { recursive: true });
}

// Simple rotation: archive the current log when it grows too big.
if (fs.existsSync(logFile) && fs.statSync(logFile).size > MAX_LOG_SIZE) {
    fs.renameSync(logFile, `${logFile}.${new Date().toISOString().replace(/[:.]/g, '-')}.old`);
}

const logStream = fs.createWriteStream(logFile, { flags: 'a' });

function formatLog(message) {
    const now = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
    return `[${now}] ${message}\n`;
}

// Join every argument (Errors print their message/stack), so nothing is lost.
function logText(args) {
    return Array.from(args)
        .map(arg => arg instanceof Error ? (arg.stack || arg.message) : String(arg))
        .join(' ');
}

// Logs go to the file AND to stdout/stderr, so `docker logs` shows them too.
console.log = function() {
    const line = formatLog(logText(arguments));
    logStream.write(line);
    process.stdout.write(line);
};

console.error = function() {
    const line = formatLog(`ERROR: ${logText(arguments)}`);
    logStream.write(line);
    process.stderr.write(line);
};

// Never die silently: log the failure, then exit non-zero.
process.on('unhandledRejection', reason => {
    console.error(`Unhandled rejection: ${reason instanceof Error ? reason.message : reason}`);
    process.exitCode = 1;
});

async function main() {
    console.log('Starting Celcat scraping...');
    let calendar = await event_scrapper();
    generateICSCalendars(calendar);
    console.log('Celcat scraping completed.');

    // Mail relay: a mail failure must never kill the timetable run.
    console.log('Checking the CYU mailbox...');
    try {
        await check_mail();
    } catch (error) {
        console.error(`Mail check failed: ${error.message}`);
    }
    console.log('######################');
}

// --- Scheduling -------------------------------------------------------------
// Set SCHEDULE in .env (cron syntax, e.g. "*/10 * * * *") to keep the process
// alive and re-scrape automatically (Europe/Paris). Without it, the app runs
// once and exits — perfect for an external cron job.
const SCHEDULE = process.env.SCHEDULE;

// `node index.js --test-mail` transfers a test message to MAIL_NOTIFY_TO.
if (process.argv.includes('--test-mail')) {
    send_test_notification().then(ok => {
        console.log(ok ? 'Test message transferred.' : 'Test transfer FAILED.');
        process.exit(ok ? 0 : 1);
    }).catch(error => {
        console.error('Fatal:', error.message);
        process.exit(1);
    });
} else if (SCHEDULE) {
    const cron = require('node-cron');

    if (!cron.validate(SCHEDULE)) {
        console.error(`Invalid SCHEDULE: "${SCHEDULE}"`);
        process.exit(1);
    }

    console.log(`Schedule: "${SCHEDULE}" (Europe/Paris) — running now, then on schedule.`);
    const run = () => main().catch(error => console.error('Fatal:', error.message));
    run();
    cron.schedule(SCHEDULE, run);
} else {
    main().catch(error => {
        console.error('Fatal:', error.message);
        process.exit(1);
    });
}
