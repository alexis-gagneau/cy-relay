// SSO flow inspector — replays the mailbox web SSO (webmail -> IdP -> CAS ->
// consent -> SAML) and shows every form along the way, so a broken flow is
// visible step by step.
//
//   node tools/inspect-sso.js          -> GET-only walk (no credentials, safe
//                                         to repeat any number of times)
//   node tools/inspect-sso.js --post   -> sends the credentials ONCE with the
//                                         minimal canonical CAS body, then
//                                         saves the session cookies
//
// Refused credentials are never retried in a loop — the CYU directory locks
// accounts after repeated failures.

const mm = require("../managers/mailManager");
const credentials = require("../configs/env");
const settings = require("../configs/settings.json");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

function title_of(text) {
    const match = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    return (match ? match[1] : "(no title)").replace(/\s+/g, " ").trim().slice(0, 120);
}

function visible_error(text) {
    const flat = String(text).replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    const match = flat.match(/.{0,120}(invalid|incorrect|authentication failed|account|locked|blocked|error|erreur|refus|bloqu).{0,160}/i);
    return match ? match[0].trim() : "(no obvious error text)";
}

function dump_forms(text) {
    const forms = mm._debug.parse_forms(text);
    console.log(`  ${forms.length} form(s)`);
    forms.forEach((form, index) => {
        console.log(`  --- form #${index} action: ${form.action || "(none)"}`);
        for (const [name, value] of Object.entries(form.fields)) {
            const shown = /password/i.test(name) ? `<hidden, ${String(value).length} chars>` : value;
            console.log(`      ${name} = ${shown.length > 60 ? shown.slice(0, 60) + "…" : shown}`);
        }
    });
    return forms;
}

function dump_login_html(text) {
    const blocks = text.match(/<form\b[\s\S]*?<\/form>/gi) || [];
    const login = blocks.find(b => /username|j_username/i.test(b));
    if (login) {
        console.log("  --- RAW login form HTML (first 2500 chars) ---");
        console.log(login.slice(0, 2500));
    }
}

(async () => {
    const jar = [];
    let current = await mm._debug.follow(jar, settings.mail_url + "/");

    for (let step = 1; step <= 10; step++) {
        console.log(`\n=== page ${step}: ${current.url} (HTTP ${current.status}) ===`);
        console.log(`  title: ${title_of(current.text)}`);

        const forms = dump_forms(current.text);
        const form_saml = forms.find(f => "SAMLResponse" in f.fields);
        const form_login = forms.find(f => "j_username" in f.fields || "username" in f.fields);

        if (form_saml) {
            const target = new URL(form_saml.action || current.url, current.url).toString();
            console.log(`  -> posting the SAML response (one-shot) -> ${target}`);
            current = await mm._debug.submit(jar, target, form_saml.fields, 1);
            continue;
        }

        if (form_login) {
            if (!process.argv.includes("--post")) {
                console.log("\n(GET-only mode — credentials NOT sent. Re-run with --post to send them once.)");
                return;
            }
            const target = new URL(form_login.action || current.url, current.url).toString();
            const user_field = "j_username" in form_login.fields ? "j_username" : "username";
            const pass_field = "j_password" in form_login.fields ? "j_password" : "password";
            const data = {};
            data[user_field] = credentials.username;
            data[pass_field] = credentials.password;
            if ("execution" in form_login.fields) data.execution = form_login.fields.execution;
            if ("_eventId" in form_login.fields) data._eventId = form_login.fields._eventId;
            if ("deviceFingerprint" in form_login.fields) {
                // ClientJS-style numeric fingerprint — a real browser always
                // sends one; an empty value is a state the CAS never sees.
                const hex = crypto.createHash("md5").update("cy-relay device " + credentials.username).digest("hex").slice(0, 12);
                data.deviceFingerprint = String(parseInt(hex, 16));
            }
            console.log(`\n=== sending credentials ONCE -> ${target}`);
            console.log(`  fields posted: ${Object.keys(data).join(", ")}`);
            const page_url = new URL(current.url);
            current = await mm._debug.submit(jar, target, data, 1, {
                "origin": page_url.origin,
                "referer": current.url
            });
            console.log(`=== response: ${current.url} (HTTP ${current.status})`);
            console.log(`  title: ${title_of(current.text)}`);
            console.log(`  SAMLResponse present: ${current.text.includes("SAMLResponse")}`);
            if (current.status === 401 || current.status === 403) {
                console.log(`  server says: ${visible_error(current.text)}`);
                return;
            }
            continue;
        }

        const other = forms.find(f => Object.keys(f.fields).length > 0);
        if (other) {
            const target = new URL(other.action || current.url, current.url).toString();
            console.log(`  -> posting intermediate form -> ${target}`);
            current = await mm._debug.submit(jar, target, other.fields, 2);
            continue;
        }

        // No form on the page: did we land on the webmail with a session?
        const token_cookie = jar.find(c => c.name === "ZM_AUTH_TOKEN");
        console.log(`\n=== end of flow — url: ${current.url}`);
        console.log(`  ZM_AUTH_TOKEN: ${token_cookie ? "OK (" + String(token_cookie.value).slice(0, 12) + "...)" : "MISSING"}`);
        if (token_cookie) {
            fs.mkdirSync(path.join(__dirname, "..", "runtime"), { recursive: true });
            fs.writeFileSync(path.join(__dirname, "..", "runtime", "mail-cookies.json"), JSON.stringify(jar, null, 2), "utf8");
            console.log("  cookies saved to runtime/mail-cookies.json — the next index.js run will reuse this session.");
        }
        return;
    }

    console.log("\n=== flow did not reach a form-less page within 10 steps");
})().catch(error => { console.error("DEBUG ERROR:", error.message); process.exit(1); });
