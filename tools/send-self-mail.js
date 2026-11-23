// End-to-end relay test: sends a message to your own CYU inbox, so the next
// mail tick sees it as new + unread and transfers it to MAIL_NOTIFY_TO.
// Run a normal `node index.js` (or wait for the next tick) right after.
//
//   node tools/send-self-mail.js

const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");
const settings = require("../configs/settings.json");
const credentials = require("../configs/env");

(async () => {
    const jar = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "runtime", "mail-cookies.json"), "utf8"));
    const token = (jar.find(c => c.name === "ZM_AUTH_TOKEN") || {}).value;
    if (!token) throw new Error("no ZM_AUTH_TOKEN — run index.js once first (it saves the session)");

    const soap_body =
        '<SendMsgRequest xmlns="urn:zimbraMail"><m>' +
        `<e t="t" a="${credentials.mail_address}"/>` +
        "<su>CY Relay — end-to-end test</su>" +
        '<mp ct="text/plain"><content>Message sent by tools/send-self-mail.js: the relay should transfer it ' +
        "to MAIL_NOTIFY_TO with Reply-To pointing at the CYU address.</content></mp>" +
        "</m></SendMsgRequest>";
    const envelope =
        '<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">' +
        '<soap:Header><context xmlns="urn:zimbra">' +
        `<authToken>${token}</authToken>` +
        "</context></soap:Header>" +
        "<soap:Body>" + soap_body + "</soap:Body></soap:Envelope>";

    const response = await fetch(settings.mail_url + settings.mail_soap_path, {
        method: "POST",
        headers: { "content-type": "text/xml; charset=utf-8", cookie: `ZM_AUTH_TOKEN=${token}` },
        body: envelope
    });
    const text = await response.text();
    if (response.status === 200 && text.includes("SendMsgResponse")) {
        console.log("Self-mail sent to the CYU inbox — run `node index.js` (or wait for the next tick) to see the transfer.");
    } else {
        console.error(`Failed (HTTP ${response.status}): ${text.slice(0, 200)}`);
        process.exit(1);
    }
})().catch(error => { console.error(error.message); process.exit(1); });
