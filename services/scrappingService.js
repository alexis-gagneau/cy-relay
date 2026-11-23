const settings = require('./../configs/settings.json');
const { event_shapper } = require('./../managers/eventShapeManager');
const { do_request, data_request } = require('./../managers/networkManager');
const { stringToDate } = require('./../utils/dateUtils');

async function event_scrapper() {
    let celcatEvents = await data_request(settings.calendarData_url);
    let calendar = [];

    for (let celcatEvent of celcatEvents) {
        let sidebar_elements;
        try {
            sidebar_elements = await fetch_sidebar_data(celcatEvent.id);
        } catch (error) {
            // One flaky sidebar request should not kill the whole run.
            console.error(`Sidebar KO for event ${celcatEvent.id} — event skipped (${error.message})`);
            continue;
        }
        let shaped_event = event_shapper(celcatEvent, sidebar_elements);
        calendar.push(shaped_event);
    };

    calendar = calendar.sort((a, b) => {
        const dateA = stringToDate(a.startDate);
        const dateB = stringToDate(b.startDate);
        return dateA - dateB;
    });

    return calendar;
}

async function fetch_sidebar_data(event_id) {
    let response = await do_request(settings.sidebarData_url,
        "POST",
        {},
        `eventid=${event_id}`
    );
    let sidebar_data = await response.json();

    return sidebar_data.elements;
}

module.exports = { event_scrapper };