// MARK: - Log manager
//
// The whole logging convention lives here:
//
//   [23/11/2026 15:27:37] INFO  [celcat] reaching celcat-calendar.cyu.fr
//   [23/11/2026 15:27:55] WARN  [celcat] network error (...) — retry 2/3
//   [23/11/2026 15:27:55] ERROR [mail]  transfer failed for 9797 — will retry next tick
//
// - timestamp: local time, Europe/Paris
// - level: debug | info | warn | error — filtered by LOG_LEVEL (default: info)
// - component: which part of the app is talking ([core], [celcat], [mail])
//
// Every line goes to the log file AND to stdout/stderr, so `docker logs`
// shows the same thing. The log file rotates when it grows too big.

const fs = require("fs");
const path = require("path");

const LOG_DIRECTORY = "./logs";
const LOG_FILE = path.join(LOG_DIRECTORY, "cy-relay.log");
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5 MB before rotating

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

if (!fs.existsSync(LOG_DIRECTORY)) {
    fs.mkdirSync(LOG_DIRECTORY, { recursive: true });
}

// Rotation: archive the current log when it grows too big.
if (fs.existsSync(LOG_FILE) && fs.statSync(LOG_FILE).size > MAX_LOG_SIZE) {
    fs.renameSync(LOG_FILE, `${LOG_FILE}.${new Date().toISOString().replace(/[:.]/g, "-")}.old`);
}

const stream = fs.createWriteStream(LOG_FILE, { flags: "a" });

// Join every argument (Errors print their message/stack), so nothing is lost.
function text_of(args) {
    return Array.from(args)
        .map(arg => arg instanceof Error ? (arg.stack || arg.message) : String(arg))
        .join(" ");
}

// Read lazily: .env is loaded by configs/env.js during the first requires,
// so the threshold must not be frozen before that.
function threshold() {
    return LEVELS[String(process.env.LOG_LEVEL || "info").toLowerCase()] || LEVELS.info;
}

function create_logger(component) {
    const emit = level => (...args) => {
        if (LEVELS[level] < threshold()) return;
        const now = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
        const line = `[${now}] ${level.toUpperCase().padEnd(5)} [${component}] ${text_of(args)}\n`;
        stream.write(line);
        (level === "error" ? process.stderr : process.stdout).write(line);
    };

    return {
        debug: emit("debug"),
        info: emit("info"),
        warn: emit("warn"),
        error: emit("error")
    };
}

module.exports = { create_logger };
