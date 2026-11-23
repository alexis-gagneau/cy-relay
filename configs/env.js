// Secrets (student id, username, password) live in the root .env file.
// .env is git-ignored — see .env.example for the expected keys.
// Non-secret settings (URLs, DOM selectors, paths) live in configs/settings.json.

const fs = require('fs');
const path = require('path');

const ENV_PATH = path.join(__dirname, '..', '.env');

// Minimal .env loader — no dependency needed. Existing process.env always wins.
if (fs.existsSync(ENV_PATH)) {
    for (const line of fs.readFileSync(ENV_PATH, 'utf8').split('\n')) {
        if (/^\s*(#|$)/.test(line)) continue;
        const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (!match) continue;
        let value = match[2].trim();
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        if (process.env[match[1]] === undefined) {
            process.env[match[1]] = value;
        }
    }
}

// Legacy fallback: read credentials from an old-style settings.json if present
// (deployments that predate the .env migration keep working unchanged).
let legacy = {};
try {
    const legacySettings = require('./settings.json');
    legacy = {
        id: legacySettings.id,
        username: legacySettings.username,
        password: legacySettings.password
    };
} catch {
    /* no settings.json credentials — .env is the way */
}

function read(name, legacyKey) {
    const value = process.env[name] !== undefined ? process.env[name] : legacy[legacyKey];
    if (value === undefined || value === '') {
        throw new Error(
            `Missing ${name}. Create a .env file at the project root ` +
            `(see .env.example), or export ${name} in your environment.`
        );
    }
    return value;
}

module.exports = {
    get id() { return read('CYU_ID', 'id'); },
    get username() { return read('CYU_USERNAME', 'username'); },
    get password() { return read('CYU_PASSWORD', 'password'); }
};
