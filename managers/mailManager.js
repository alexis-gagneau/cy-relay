// MARK: - Mail manager
//
// The CYU student mailbox lives on the university Zimbra (RENATER Partage)
// and refuses password auth on IMAP/SMTP: only the web SSO works. This
// manager replays the browser SSO flow (Shibboleth IdP -> CAS -> SAML) to
// obtain a session, then polls the inbox through the Zimbra REST API and
// TRANSFERS every new unread message to a personal address, as-is: original
// subject, full body and attachments (no .eml wrapper), with Reply-To set
// to the original sender(s).
//
// Runtime state lives in runtime/ (git-ignored): session cookies, seen
// message ids, and an auth-lock marker used to protect the CYU account
// from repeated credential failures (never brute-force the SSO).

const settings = require('./../configs/settings.json');
const credentials = require('./../configs/env');
const { default_headers } = require('./../configs/constants');
const { create_logger } = require('./logManager');
const { encode, decode } = require('html-entities');
const fetch = require("node-fetch");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const log = create_logger("mail");

const MAIL_URL = settings.mail_url;
const INBOX_URL = MAIL_URL + settings.mail_inbox_path;
const SOAP_URL = MAIL_URL + settings.mail_soap_path;

const REQUEST_TIMEOUT = 30000;
const MAX_FORM_STEPS = 12;      // IdP hops (LS page, CAS, consent, SAML...)
const IDENTICAL_POST_LIMIT = 4; // the IdP re-displaying the same form 4x = stuck
const NOTIFY_LIMIT = 20;        // anti-flood when catching up
const MAX_SEEN = 1000;

const RUNTIME_DIR = path.join(__dirname, "..", "runtime");
const COOKIES_FILE = path.join(RUNTIME_DIR, "mail-cookies.json");
const SEEN_FILE = path.join(RUNTIME_DIR, "mail-seen.json");
const BLOCKED_FILE = path.join(RUNTIME_DIR, "mail-auth-blocked");

// MARK: - Cookie jar (hand-rolled, enough for the SSO dance)

function store_cookie(jar, host, header_line) {
    const pair = header_line.split(";")[0];
    const eq = pair.indexOf("=");
    if (eq < 1) return;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    const attributes = header_line.split(";").slice(1).map(a => a.trim().toLowerCase());
    const domain_attribute = (attributes.find(a => a.startsWith("domain=")) || "").slice(7);
    const path_attribute = (attributes.find(a => a.startsWith("path=")) || "").slice(5) || "/";
    const cookie = { name: name, value: value, domain: domain_attribute || host, path: path_attribute };
    const existing = jar.findIndex(c => c.name === name && c.domain === cookie.domain && c.path === cookie.path);
    if (existing >= 0) jar[existing] = cookie;
    else jar.push(cookie);
}

function cookie_header(jar, host, pathname) {
    return jar
        .filter(c => host === c.domain || host.endsWith("." + c.domain) || host.endsWith(c.domain))
        .filter(c => c.path === "/" || pathname.startsWith(c.path))
        .map(c => `${c.name}=${c.value}`)
        .join("; ");
}

function token_of(jar) {
    const cookie = jar.find(c => c.name === "ZM_AUTH_TOKEN");
    return cookie ? cookie.value : null;
}

// MARK: - HTTP (timeout, network retries, manual redirects, cookies)

async function request(jar, url, options = {}, attempts = 3) {
    const target = new URL(url);
    let last_error = null;
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            const headers = Object.assign({}, default_headers, options.headers || {});
            const cookie = cookie_header(jar, target.hostname, target.pathname);
            if (cookie) headers["cookie"] = cookie;
            if (options.body) headers["content-type"] = options.content_type || "application/x-www-form-urlencoded";
            const response = await fetch(url, {
                method: options.method || "GET",
                headers: headers,
                body: options.body || null,
                redirect: "manual",
                signal: AbortSignal.timeout(REQUEST_TIMEOUT)
            });
            for (const set_cookie of (response.headers.raw()["set-cookie"] || [])) {
                store_cookie(jar, target.hostname, set_cookie);
            }
            return response;
        } catch (error) {
            last_error = error;
            if (attempt === attempts) throw error;
            log.warn(`network error (${error.message}) — retry ${attempt + 1}/${attempts}...`);
            await new Promise(resolve => setTimeout(resolve, attempt * 2000));
        }
    }
    throw last_error;
}

async function follow(jar, url) {
    let current = url;
    for (let hop = 0; hop < 10; hop++) {
        const response = await request(jar, current, { method: "GET" }, 3);
        if ([301, 302, 303, 307, 308].includes(response.status)) {
            const location = response.headers.get("location");
            if (!location) return { url: current, status: response.status, text: await response.text() };
            current = new URL(location, current).toString();
            continue;
        }
        return { url: current, status: response.status, text: await response.text() };
    }
    throw new Error("too many redirects during the SSO flow");
}

async function submit(jar, url, fields, attempts, extra_headers = {}) {
    const response = await request(jar, url, {
        method: "POST",
        body: new URLSearchParams(fields).toString(),
        headers: extra_headers
    }, attempts);
    if ([301, 302, 303, 307, 308].includes(response.status)) {
        return follow(jar, new URL(response.headers.get("location") || "", url).toString());
    }
    return { url: url, status: response.status, text: await response.text() };
}

// MARK: - Forms

function parse_forms(html_text) {
    const forms = [];
    for (const block of html_text.match(/<form\b[\s\S]*?<\/form>/gi) || []) {
        const action_match = block.match(/action\s*=\s*["']?([^"'>\s]+)/i);
        const fields = {};
        const radios = {};

        for (const tag of block.match(/<input\b[^>]*>/gi) || []) {
            const name = (tag.match(/name\s*=\s*["']([^"']+)["']/i) || [])[1];
            if (!name) continue;
            const value_match = tag.match(/value\s*=\s*["']([^"']*)["']/i);
            const value = value_match ? decode(value_match[1]) : "";
            const type = (tag.match(/type\s*=\s*["']([^"']+)["']/i) || [])[1] || "text";

            if (/^radio$/i.test(type)) {
                (radios[name] = radios[name] || []).push(value);
            } else if (/^checkbox$/i.test(type)) {
                if (/checked/i.test(tag)) fields[name] = value;
            } else if (/^(button|file|image|reset)$/i.test(type)) {
                continue;
            } else {
                fields[name] = value;
            }
        }

        for (const tag of block.match(/<button\b[^>]*>/gi) || []) {
            const name = (tag.match(/name\s*=\s*["']([^"']+)["']/i) || [])[1];
            if (name) {
                const value_match = tag.match(/value\s*=\s*["']([^"']*)["']/i);
                fields[name] = value_match ? decode(value_match[1]) : "";
            }
        }

        const notes = [];
        for (const [name, options] of Object.entries(radios)) {
            // Consent pages: prefer the per-session option, else the first one.
            const choice = options.includes("_shib_idp_perSessionConsent")
                ? "_shib_idp_perSessionConsent"
                : options[0] || "";
            fields[name] = choice;
            notes.push(`${name}=${choice}`);
        }

        forms.push({ action: action_match ? decode(action_match[1]) : "", fields: fields, notes: notes });
    }
    return forms;
}

// MARK: - SSO replay (webmail -> IdP -> CAS -> consent -> SAML -> webmail)

async function sso_login(jar, identifiant, mot_de_passe) {
    let landing = await follow(jar, MAIL_URL + "/");
    let url = landing.url;
    let status = landing.status;
    let page = landing.text;
    log.debug(`sso: landing on ${url} (HTTP ${status})`);
    if (status !== 200) throw new Error(`webmail unreachable: HTTP ${status}`);

    const identical_posts = {};
    for (let step = 1; step <= MAX_FORM_STEPS; step++) {
        const forms = parse_forms(page);
        const form_saml = forms.find(f => "SAMLResponse" in f.fields);
        const form_login = forms.find(f => "j_username" in f.fields || "username" in f.fields);

        if (form_saml) {
            // One-shot POST (the SP has replay detection): never retried.
            const target = new URL(form_saml.action || url, url).toString();
            log.debug(`[${step}] posting the SAML response -> ${target}`);
            const outcome = await submit(jar, target, form_saml.fields, 1);
            url = outcome.url; status = outcome.status; page = outcome.text;
            if (url.startsWith(MAIL_URL) && status === 200) return url;
            if (status === null || page.includes("SecurityPolicyException")) {
                // The POST may have gone through server-side despite the
                // network error (session cookie already in the jar).
                const direct = await follow(jar, MAIL_URL + "/");
                if (direct.url.startsWith(MAIL_URL) && direct.status === 200) return direct.url;
                url = direct.url; status = direct.status; page = direct.text;
            }
            continue;
        }

        if (form_login) {
            const target = new URL(form_login.action || url, url).toString();
            const user_field = "j_username" in form_login.fields ? "j_username" : "username";
            const pass_field = "j_password" in form_login.fields ? "j_password" : "password";
            // Minimal canonical CAS body (username, password, execution,
            // _eventId). The extra hidden fields (geolocation, submitBtn) stay
            // empty in a real browser too, but deviceFingerprint is filled by
            // clientjs — sending it EMPTY is a state no browser produces.
            const data = {};
            data[user_field] = identifiant;
            data[pass_field] = mot_de_passe;
            if ("execution" in form_login.fields) data.execution = form_login.fields.execution;
            if ("_eventId" in form_login.fields) data._eventId = form_login.fields._eventId;
            log.debug(`[${step}] sending credentials -> ${target}`);
            // Credentials are sent exactly once (network errors included):
            // resending them on a flaky network is how accounts get locked.
            const outcome = await submit(jar, target, data, 1);
            url = outcome.url; status = outcome.status; page = outcome.text;
            const still_login = parse_forms(page).find(f => "j_username" in f.fields || "username" in f.fields);
            if (still_login && !page.includes("SAMLResponse")) {
                throw { code: "BAD_CREDENTIALS", message: `the CAS refused the credentials (HTTP ${status})` };
            }
            continue;
        }

        const other = forms.find(f => Object.keys(f.fields).length > 0);
        if (other) {
            const target = new URL(other.action || url, url).toString();
            const key = target + "|" + JSON.stringify(other.fields);
            identical_posts[key] = (identical_posts[key] || 0) + 1;
            if (identical_posts[key] >= IDENTICAL_POST_LIMIT) {
                throw new Error("the IdP keeps re-displaying the same form (consent?)");
            }
            const detail = other.notes.length ? ` (${other.notes.join(", ")})` : "";
            log.debug(`[${step}] intermediate step${detail} -> ${target}`);
            const outcome = await submit(jar, target, other.fields, 2);
            url = outcome.url; status = outcome.status; page = outcome.text;
            continue;
        }

        // A page without forms: the session may already exist server-side.
        if (!url.startsWith(MAIL_URL)) {
            const direct = await follow(jar, MAIL_URL + "/");
            if (direct.url.startsWith(MAIL_URL) && direct.status === 200) return direct.url;
        }
        break;
    }

    throw new Error(`SSO flow did not land on the webmail (ended on: ${url})`);
}

// MARK: - Persistence

function load_cookies() {
    try {
        const jar = JSON.parse(fs.readFileSync(COOKIES_FILE, "utf8"));
        return Array.isArray(jar) ? jar : [];
    } catch {
        return [];
    }
}

function save_cookies(jar) {
    fs.mkdirSync(RUNTIME_DIR, { recursive: true });
    fs.writeFileSync(COOKIES_FILE, JSON.stringify(jar, null, 2), "utf8");
}

function load_seen() {
    try {
        const state = JSON.parse(fs.readFileSync(SEEN_FILE, "utf8"));
        return Array.isArray(state.seen) ? state.seen : null; // null = first run
    } catch {
        return null;
    }
}

function save_seen(seen) {
    fs.mkdirSync(RUNTIME_DIR, { recursive: true });
    const tmp = SEEN_FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify({ seen: seen.slice(-MAX_SEEN) }), "utf8");
    fs.renameSync(tmp, SEEN_FILE);
}

function fingerprint(secret) {
    return crypto.createHash("sha256").update(String(secret)).digest("hex");
}

function auth_is_locked() {
    try {
        const lock = JSON.parse(fs.readFileSync(BLOCKED_FILE, "utf8"));
        // The lock only stands while the password is unchanged: fixing the
        // .env clears it automatically on the next check.
        return lock.fingerprint === fingerprint(credentials.password);
    } catch {
        return false;
    }
}

function lock_auth() {
    fs.mkdirSync(RUNTIME_DIR, { recursive: true });
    fs.writeFileSync(BLOCKED_FILE, JSON.stringify({
        fingerprint: fingerprint(credentials.password),
        at: new Date().toISOString()
    }), "utf8");
    log.error("credentials refused — mail SSO LOCKED");
    log.error(`fix the password in .env, then delete ${BLOCKED_FILE} to retry`);
}

// MARK: - Zimbra calls

async function soap(jar, token, body) {
    const envelope =
        '<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">' +
        '<soap:Header><context xmlns="urn:zimbra">' +
        `<authToken>${token || ""}</authToken>` +
        "</context></soap:Header>" +
        "<soap:Body>" + body + "</soap:Body></soap:Envelope>";
    const response = await request(jar, SOAP_URL, {
        method: "POST",
        body: envelope,
        content_type: "text/xml; charset=utf-8"
    }, 2);
    return { code: response.status, text: await response.text() };
}

async function fetch_inbox(jar) {
    const response = await request(jar, INBOX_URL, { method: "GET" }, 3);
    if (response.status !== 200) return { status: response.status, messages: [] };
    const data = JSON.parse(await response.text());
    return { status: 200, messages: data.messages || data.m || [] };
}

// MARK: - Transfer (real forward of the original message)

function xml_unescape(text) {
    return decode(String(text === undefined || text === null ? "" : text));
}

function attr_of(tag, name) {
    const match = tag.match(new RegExp("\\b" + name + "\\s*=\\s*\"([^\"]*)\""));
    return match ? xml_unescape(match[1]) : "";
}

// The inbox REST feed only carries a short fragment — not enough to transfer
// the message as-is. This fetches the full message: participants, body and
// the attachment parts (re-attached server-side at send time via <attach>).
async function fetch_full_message(jar, id) {
    const outcome = await soap(jar, token_of(jar), `<GetMsgRequest xmlns="urn:zimbraMail"><m id="${id}"/></GetMsgRequest>`);
    if (outcome.code !== 200 || !outcome.text.includes("GetMsgResponse")) {
        log.error(`cannot fetch message ${id} (HTTP ${outcome.code})`);
        return null;
    }

    const text = outcome.text;
    const full = {
        id: id,
        date: "",
        subject: "",
        participants: [],
        body: "",
        body_type: "text/plain",
        attachments: []
    };

    const head_tag = (text.match(/<m\b[^>]*>/i) || [""])[0];
    if (!head_tag) return null;
    full.date = attr_of(head_tag, "d");
    // The subject is a <su> element, not an attribute of <m>.
    const subject_match = text.match(/<su>([\s\S]*?)<\/su>/i);
    full.subject = subject_match ? xml_unescape(subject_match[1]) : "";

    for (const tag of text.match(/<e\b[^>]*>/gi) || []) {
        full.participants.push({
            t: attr_of(tag, "t"),
            a: attr_of(tag, "a"),
            p: attr_of(tag, "p"),
            d: attr_of(tag, "d")
        });
    }

    // Body: the part(s) flagged body="1" (text and/or html leaf of the mail).
    let body_tag = (text.match(/<mp\b[^>]*body="1"[^>]*>/i) || [""])[0];
    let body_type = body_tag ? attr_of(body_tag, "ct") : "";
    if (/multipart/i.test(body_type)) {
        const after_body = text.slice(text.indexOf(body_tag) + body_tag.length);
        body_tag = (after_body.match(/<mp\b[^>]*ct="text\/[^"]*"[^>]*>/i) || [""])[0];
        body_type = body_tag ? attr_of(body_tag, "ct") : "";
    }
    if (body_tag) {
        const content = text.slice(text.indexOf(body_tag) + body_tag.length).match(/<content>([\s\S]*?)<\/content>/i);
        if (content) full.body = xml_unescape(content[1]);
    }
    full.body_type = body_type || "text/plain";

    // Attachments: any part carrying a filename (or an embedded message).
    for (const tag of text.match(/<mp\b[^>]*>/gi) || []) {
        if (/body="1"/i.test(tag)) continue;
        const filename = attr_of(tag, "filename");
        const ct = attr_of(tag, "ct");
        if (filename || ct === "message/rfc822") {
            full.attachments.push({ part: attr_of(tag, "part"), name: filename || "message.eml" });
        }
    }

    return full;
}

async function forward_message(jar, token, full) {
    const senders = full.participants.filter(p => p.t === "f");
    if (!senders.length && full.participants.length) senders.push(full.participants[0]);
    const is_html = /html/i.test(full.body_type);
    const newline = is_html ? "<br>" : "\n";

    const transfer_header = [
        "---------- Message transféré ----------",
        `De : ${senders.map(p => `${p.p || p.d || p.a || "?"} <${p.a}>`).join(", ")}`,
        `Date : ${/^\d+$/.test(String(full.date)) ? new Date(Number(full.date)).toLocaleString("fr-FR", { timeZone: "Europe/Paris" }) : "unknown date"}`,
        `Objet : ${full.subject || "(no subject)"}`,
        ""
    ].join(newline);

    const request = '<SendMsgRequest xmlns="urn:zimbraMail"><m>' +
        `<e t="t" a="${encode(credentials.mail_notify_to, { mode: "specialChars" })}"/>` +
        `<e t="f" a="${encode(credentials.mail_address, { mode: "specialChars" })}"/>` +
        senders.filter(p => p.a).map(p => `<e t="r" a="${encode(p.a, { mode: "specialChars" })}"/>`).join("") +
        `<su>${encode(full.subject || "(no subject)", { mode: "specialChars" })}</su>` +
        `<mp ct="${is_html ? "text/html" : "text/plain"}"><content>${encode(transfer_header + newline + full.body, { mode: "specialChars" })}</content></mp>` +
        (full.attachments.length
            ? "<attach>" + full.attachments.map(a => `<mp mid="${full.id}" part="${a.part}"/>`).join("") + "</attach>"
            : "") +
        "</m></SendMsgRequest>";

    const outcome = await soap(jar, token, request);
    if (outcome.code === 200 && outcome.text.includes("SendMsgResponse")) return true;
    log.error(`transfer failed (HTTP ${outcome.code}): ${String(outcome.text).replace(/[<>]/g, "").slice(0, 150)}`);
    return false;
}

// MARK: - Session + check

async function sso_login_and_save() {
    const fresh_jar = [];
    await sso_login(fresh_jar, credentials.username, credentials.password);
    save_cookies(fresh_jar);
    return fresh_jar;
}

async function check_mail() {
    if (!credentials.mail_address || !credentials.mail_notify_to) {
        throw new Error("MAIL_ADDRESS / MAIL_NOTIFY_TO missing in .env");
    }

    let jar = load_cookies();
    let inbox = await fetch_inbox(jar);

    if (inbox.status !== 200) {
        log.info("no valid session — SSO login...");
        try {
            jar = await sso_login_and_save();
        } catch (error) {
            if (error && error.code === "BAD_CREDENTIALS") lock_auth();
            throw error;
        }
        inbox = await fetch_inbox(jar);
        if (inbox.status !== 200) throw new Error(`inbox still unreachable (HTTP ${inbox.status})`);
    }

    const seen = load_seen();
    if (seen === null) {
        // First run: mark everything as seen, no transfer flood.
        save_seen(inbox.messages.map(m => m.id));
        log.info(`first run: ${inbox.messages.length} existing message(s) marked as seen (no flood)`);
        return;
    }

    const fresh_ones = inbox.messages.filter(m => !seen.includes(m.id));
    const unread = fresh_ones.filter(m => String(m.f || "").includes("u"));
    if (!unread.length) {
        if (fresh_ones.length) {
            log.info(`${fresh_ones.length} message(s) already read on the webmail — nothing to transfer`);
        } else {
            log.info("no new message");
        }
        save_seen(seen.concat(fresh_ones.map(m => m.id)));
        return;
    }

    log.info(`${unread.length} new unread message(s) -> transfer(s)`);
    for (const message of unread.slice(0, NOTIFY_LIMIT).reverse()) {
        const full = await fetch_full_message(jar, message.id);
        if (!full) continue;
        // Belt and braces: the inbox feed carries the same meta.
        full.subject = full.subject || message.su || "";
        full.date = full.date || message.d || "";
        if (await forward_message(jar, token_of(jar), full)) {
            log.info(`transferred: ${full.subject || "(no subject)"}`);
            seen.push(message.id);
            save_seen(seen);
        } else {
            log.error(`transfer failed for ${message.id} — will retry next tick`);
        }
    }
}

async function send_test_notification() {
    if (!credentials.mail_address || !credentials.mail_notify_to) {
        throw new Error("MAIL_ADDRESS / MAIL_NOTIFY_TO missing in .env");
    }
    if (auth_is_locked()) {
        throw new Error(`mail SSO locked — delete ${BLOCKED_FILE} to retry`);
    }

    let jar = load_cookies();
    const inbox = await fetch_inbox(jar);
    if (inbox.status !== 200) {
        try {
            jar = await sso_login_and_save();
        } catch (error) {
            if (error && error.code === "BAD_CREDENTIALS") lock_auth();
            throw error;
        }
    }

    return forward_message(jar, token_of(jar), {
        id: "test",
        date: String(Date.now()),
        subject: "CY Relay — module mail activé",
        participants: [{ t: "f", a: credentials.mail_address, p: "CY Relay" }],
        body: "Si tu lis ceci dans ta boîte perso, le module fonctionne : chaque nouveau message CYU non lu te sera transféré tel quel " +
            "(objet, corps, pièces jointes), avec Reply-To positionné sur son vrai expéditeur.",
        body_type: "text/plain",
        attachments: []
    });
}

// _debug: internals exposed for the runtime/ diagnostics (no public contract).
module.exports = { check_mail, send_test_notification, _debug: { parse_forms, follow, submit } };
