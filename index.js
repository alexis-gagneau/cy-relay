const fs = require('fs');
const path = require('path');

const { event_scrapper } = require('./services//scrappingService');
const { generateICSCalendars } = require('./managers/calendarStoreManager');

const logDirectory = './logs';
const logFile = path.join(logDirectory, 'celcat.log');

if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory, { recursive: true });
}

const logStream = fs.createWriteStream(logFile, { flags: 'a' });

function formatLog(message) {
    const now = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
    return `[${now}] ${message}\n`;
}

const originalLog = console.log;
console.log = function(d) {
    logStream.write(formatLog(d));
    // originalLog.apply(console, arguments);
};

const originalError = console.error;
console.error = function(d) {
    logStream.write(formatLog(`ERROR: ${d}`));
    // originalError.apply(console, arguments);
};

async function main() {
    console.log('Starting Celcat scraping...');
    let calendar = await event_scrapper();
    generateICSCalendars(calendar);
    console.log('Celcat scraping completed.');
    console.log('######################');
}

main();
