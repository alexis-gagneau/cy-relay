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
    let response = await do_request(settings.antiforgeryStuff_url);
    
    if (response.ok) {
        return [
            response.headers.get("set-cookie").split(";")[0],
            get_rvt(await response.text())
        ];
    }
}
function get_ac(response) {
    return response.headers.get("set-cookie").split(";")[0];
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