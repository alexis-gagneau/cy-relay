const settings = require('./../configs/settings.json');
const { event_type, begin_VCalendar, begin_VCalendar_cm, begin_VCalendar_td, begin_VCalendar_tp, begin_VCalendar_cc, begin_VCalendar_exams, begin_VCalendar_others, begin_VEvent, end_VEvent, end_VCalendar } = require('./../configs/constants');

const fs = require("fs");
const path = require("path");

function generateICSCalendars(calendar) {
    // Make sure the output directory exists (fresh container, first run...).
    fs.mkdirSync(path.dirname(settings.ics_path), { recursive: true });

    let icsCalendar = begin_VCalendar;
    let icsCalendar_cm = begin_VCalendar_cm;
    let icsCalendar_td = begin_VCalendar_td;
    let icsCalendar_tp = begin_VCalendar_tp;
    let icsCalendar_cc = begin_VCalendar_cc;
    let icsCalendar_exams = begin_VCalendar_exams;
    let icsCalendar_others = begin_VCalendar_others;

    calendar.forEach(event => {
        let builings_desc = event.rooms.buildings.length ? `🏢 ${event.rooms.buildings.join(" / ")}\\n` : undefined;
        let rooms_desc = event.rooms.rooms.length ? `🏷️ ${event.rooms.rooms.join(" / ")}\\n` : undefined;
        let roomTypes_desc = event.rooms.roomTypes.length ? `🛋️ ${event.rooms.roomTypes.join(" / ")}\\n` : undefined;
        let roomCapacities_desc = event.rooms.roomCapacities.length ? `👥 ${event.rooms.roomCapacities.map(roomCapacity => `${roomCapacity} ${roomCapacity > 1 ? "personnes" : "personne"}`).join(" / ")}\\n` : undefined;
        let professors_desc = event.professors.length ? `👩🏻‍🏫 ${event.professors.join(" / ")}\\n` : undefined;
        let notes_desc = event.notes ? `✏️ ${event.notes}\\n` : undefined
        
        let icsEvent = begin_VEvent;
        icsEvent += `UID:${event.id || Math.random().toString(36).substr(2, 9)}\n`;
        icsEvent += `SUMMARY:${event.title || "Unknown event"}\n`;
        icsEvent += `DTSTART;${event.isAllDay ? "VALUE=DATE" : "TZID=Europe/Paris"}:${event.startDate}\n`;
        icsEvent += `DTEND;${event.isAllDay ? "VALUE=DATE" : "TZID=Europe/Paris"}:${event.endDate}\n`;
        event.location ? icsEvent += `LOCATION:${event.location.name}\\n${event.location.address}\n${event.location.apple_structured_location}\n` : null;
        event.url ? icsEvent += `URL;VALUE=URI:${event.url}\n` : null;
        builings_desc || rooms_desc || roomTypes_desc || roomCapacities_desc || professors_desc || notes_desc ? icsEvent += `DESCRIPTION:${builings_desc ?? ""}${rooms_desc ?? ""}${roomTypes_desc ?? ""}${roomCapacities_desc ?? ""}${professors_desc ?? ""}${notes_desc ?? ""}\n` : null;
        icsEvent += end_VEvent;

        icsCalendar += icsEvent;
        if (event.type == event_type.cm) {
            icsCalendar_cm += icsEvent;
        } else if (event.type == event_type.td) {
            icsCalendar_td += icsEvent;
        } else if (event.type == event_type.tp) {
            icsCalendar_tp += icsEvent;
        } else if (event.type == event_type.cc) {
            icsCalendar_cc += icsEvent;
        } else if (event.type == event_type.exam) {
            icsCalendar_exams += icsEvent;
        } else {
            icsCalendar_others += icsEvent;
        }
    });
    icsCalendar += end_VCalendar;
    icsCalendar_cm += end_VCalendar;
    icsCalendar_td += end_VCalendar;
    icsCalendar_tp += end_VCalendar;
    icsCalendar_cc += end_VCalendar;
    icsCalendar_exams += end_VCalendar;
    icsCalendar_others += end_VCalendar;

    fs.writeFileSync(`${settings.ics_path}.ics`, icsCalendar, "utf8");
    fs.writeFileSync(`${settings.ics_path}_cm.ics`, icsCalendar_cm, "utf8");
    fs.writeFileSync(`${settings.ics_path}_td.ics`, icsCalendar_td, "utf8");
    fs.writeFileSync(`${settings.ics_path}_tp.ics`, icsCalendar_tp, "utf8");
    fs.writeFileSync(`${settings.ics_path}_cc.ics`, icsCalendar_cc, "utf8");
    fs.writeFileSync(`${settings.ics_path}_exams.ics`, icsCalendar_exams, "utf8");
    fs.writeFileSync(`${settings.ics_path}_others.ics`, icsCalendar_others, "utf8");

    console.log("file saved.");
}

module.exports = { generateICSCalendars };