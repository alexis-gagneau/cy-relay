const settings = require('./../configs/settings.json');
const { default_headers } = require('./../configs/constants');

const fetch = require('node-fetch');
const moment = require('moment');

// MARK: - Requests manager

async function do_request(url, method = "GET", headers = {}, body = null) {
    let response = await fetch((body && method === "GET") ? url + body : url, {
        headers: Object.assign(default_headers, headers),
        method: method,
        redirect: "manual",
        body: method === "POST" ? body : null
    });

    return response;
}
async function data_request(dataURL) {
    let session_cookie = await set_sc();
    
    let response = await do_request(dataURL,
        "POST",
        { cookie: session_cookie },
        `start=${moment().subtract(1, "month").format("YYYY-MM-DD")}&end=${moment().add(1, "year").format("YYYY")}-12-31&resType=104&calView=month&federationIds%5B%5D=${settings.id}`
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
        `Name=${encodeURIComponent(settings.username)}&Password=${encodeURIComponent(settings.password)}&__RequestVerificationToken=${encodeURIComponent(antiforgery_stuff[1])}`
    );

    return `${antiforgery_stuff[0]};${get_ac(response)}`;
}

module.exports = { do_request, data_request };