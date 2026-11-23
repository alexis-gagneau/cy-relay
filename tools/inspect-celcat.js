// Diagnostic tool: dumps the raw CELCAT data and every distinct
// "Event category" label, so the shaping rules can be checked against
// reality. Run from the project root:
//     node tools/inspect-celcat.js
const settings = require('../configs/settings.json');
const { do_request, data_request } = require('../managers/networkManager');

(async () => {
    const events = await data_request(settings.calendarData_url);
    console.log(`Calendar events received: ${events.length}`);
    console.log('--- raw event sample ---');
    console.log(JSON.stringify(events[0], null, 2).slice(0, 900));

    const categories = {};
    const tpSample = [];
    for (const event of events) {
        try {
            const response = await do_request(settings.sidebarData_url, "POST", {}, `eventid=${event.id}`);
            const data = await response.json();
            const elements = data.elements || [];
            const category = elements.find(e => e.label === "Event category");
            const key = category ? category.content : "(no category)";
            categories[key] = (categories[key] || 0) + 1;
            if (String(key).toUpperCase().includes("TP") && tpSample.length < 2) {
                tpSample.push({ id: event.id, label: key, elements });
            }
        } catch (error) {
            console.error(`sidebar KO for ${event.id}: ${error.message}`);
        }
    }

    console.log('--- distinct event categories ---');
    console.log(JSON.stringify(categories, null, 2));
    if (tpSample.length) {
        console.log(`--- TP sample (${tpSample[0].label}) ---`);
        console.log(JSON.stringify(tpSample[0].elements, null, 2).slice(0, 900));
    }
})();
