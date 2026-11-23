const settings = require('./../configs/settings.json');
const { default_headers } = require('./../configs/constants');
const credentials = require('./../configs/env');

const fetch = require('node-fetch');
const moment = require('moment');

// MARK: - Requests manager

const REQUEST_TIMEOUT = 30000; // ms before giving up on a request
const MAX_ATTEMPTS = 3;

async function do_request(url, method = "GET", headers = {}, body = null) {
    let lastError;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
            return await fetch((body && method === "GET") ? url + body : url, {
                headers: Object.assign(default_headers, headers),
                method: method,
                redirect: "manual",
                body: method === "POST" ? body : null,
                signal: AbortSignal.timeout(REQUEST_TIMEOUT)
            });
        } catch (error) {
            lastError = error;
            if (attempt < MAX_ATTEMPTS) {
                let wait = attempt * 2000;
                console.log(`Network error (${error.message}) — retry ${attempt + 1}/${MAX_ATTEMPTS} in ${wait / 1000}s...`);
                await new Promise(resolve => setTimeout(resolve, wait));
            }
        }
    }
    throw lastError;
}
async function data_request(dataURL) {
    let session_cookie = await set_sc();
    
    let response = await do_request(dataURL,
        "POST",
        { cookie: session_cookie },
        `start=${moment().subtract(1, "month").format("YYYY-MM-DD")}&end=${moment().add(1, "year").format("YYYY")}-12-31&resType=104&calView=month&federationIds%5B%5D=${credentials.id}`
    );

    return await response.json();
}

// MARK: - Stuff manager

function get_rvt(text) {
    return text.split('<input name="__RequestVerificationToken" type="hidden" value="')[1].split('" /></form>')[0];
}
async function get_antiforgerystuff() {
    for (let attempt = 1; attempt <= 3; attempt++) {
        let response = await do_request(settings.antiforgeryStuff_url);

        if (response.ok) {
            let cookie = response.headers.get("set-cookie");
            let token = get_rvt(await response.text());

            if (cookie && token) {
                return [cookie.split(";")[0], token];
            }
            console.log(`Anti-forgery incomplete (cookie: ${!!cookie}, token: ${!!token}) — retry ${attempt}/3...`);
        } else {
            console.log(`Anti-forgery page: HTTP ${response.status} — retry ${attempt}/3...`);
        }

        await new Promise(resolve => setTimeout(resolve, attempt * 2000));
    }

    throw new Error("CELCAT did not return the anti-forgery token after 3 attempts");
}
function get_ac(response) {
    let cookie = response.headers.get("set-cookie");
    if (!cookie) {
        throw new Error("No session cookie returned after login (bad credentials or CELCAT hiccup)");
    }
    return cookie.split(";")[0];
}
async function set_sc() {
    console.log("Reaching website.");
    let antiforgery_stuff = await get_antiforgerystuff();
    
    console.log("Sign in...");
    let response = await do_request(settings.signIn_url,
        "POST",
        {
            cookie: antiforgery_stuff[0],
            "content-type": "application/x-www-form-urlencoded"
        },
        `Name=${encodeURIComponent(credentials.username)}&Password=${encodeURIComponent(credentials.password)}&__RequestVerificationToken=${encodeURIComponent(antiforgery_stuff[1])}`
    );

    return `${antiforgery_stuff[0]};${get_ac(response)}`;
}

module.exports = { do_request, data_request };