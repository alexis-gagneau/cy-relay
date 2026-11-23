// MARK: - Event

const event_type = {
    cm: {
        name: "Cours Magistraux",
        abreviation: "CM"
    },
    td: {
        name: "Travaux Dirigés",
        abreviation: "TD"
    },
    tp: {
        name: "Travaux Pratiques",
        abreviation: "TP"
    },
    cc: {
        name: "Contrôles Continues",
        abreviation: "CC"
    },
    exam: {
        name: "Partiels",
        abreviation: "Partiel"
    },
    other: {
        name: "Autres",
        abreviation: ""
    }
};
const site_buildings = {
    "CAU": ["Cauchy", "CY"],
    "CON": ["Condorcet", "CT"],
    "FER": ["Fermat", "FT"],
    "TUR": ["Turing", "TG"],
    "STM": ["Saint-Martin", "STM"],
    "CHE1": ["Chênes 1", "CHE1"],
    "PAU": ["Pau", "PAU"]
};
const sites_location = {
    "CHENES": {
        name: "CY Cergy Paris Université - Site Les Chênes",
        address: "33 Boulevard du Port\\, 95300 Pontoise\\, France",
        apple_structured_location: `X-APPLE-STRUCTURED-LOCATION;VALUE=URI;X-ADDRESS="33 Boulevard du Port, 95
 011 Cergy-Pontoise, France";X-APPLE-MAPKIT-HANDLE=CAESxAIIrk0Q0fTHz4749a
 f6ARoSCbHp97MOhUhAEYBts2eFmABAImwKBkZyYW5jZRICRlIaDsOObGUtZGUtRnJhbmNlKg
 pWYWwtZCdPaXNlMg5DZXJneS1Qb250b2lzZToFOTUwMTFSEUJvdWxldmFyZCBkdSBQb3J0Wg
 IzM2IUMzMgQm91bGV2YXJkIGR1IFBvcnQqGkNZIENlcmd5IFBhcmlzIFVuaXZlcnNpdMOpMh
 QzMyBCb3VsZXZhcmQgZHUgUG9ydDIUOTUwMTEgQ2VyZ3ktUG9udG9pc2UyBkZyYW5jZTgvUA
 FaXgooCNH0x8+O+PWn+gESEgmx6fezDoVIQBGAbbNnhZgAQBiuTZADAZgDAaIfMQjR9MfPjv
 j1p/oBGiQKGkNZIENlcmd5IFBhcmlzIFVuaXZlcnNpdMOpEAAqAmZyQAA=;X-APPLE-RADIU
 S=206.5943271868443;X-APPLE-REFERENCEFRAME=0;X-TITLE="CY Cergy Paris Uni
 versité":geo:49.039511,2.074473`
    },
    "PORT": {
        name: "CY Tech - Site du Port",
        address: "Chemin des Paradis",
        apple_structured_location: `X-APPLE-STRUCTURED-LOCATION;VALUE=URI;X-ADDRESS=Chemin des Paradis;X-APPL
 E-MAPKIT-HANDLE=CAESrgIIrk0QvIOo3qzM46wHGhIJtdSL6ymESEARph6z/XWIAEAiZwoG
 RnJhbmNlEgJGUhoOw45sZS1kZS1GcmFuY2UqClZhbC1kJ09pc2UyDkNlcmd5LVBvbnRvaXNl
 OgU5NTAwMFISQ2hlbWluIGRlcyBQYXJhZGlzYhJDaGVtaW4gZGVzIFBhcmFkaXMqFUNZIFRl
 Y2ggLSBTaXRlIEZlcm1hdDIuQ2hlbWluIGRlcyBQYXJhZGlzCjk1MDAwIENlcmd5LVBvbnRv
 aXNlCkZyYW5jZTgvUAFaVwonCLyDqN6szOOsBxISCbXUi+sphEhAEaYes/11iABAGK5NkAMB
 mAMBoh8rCLyDqN6szOOsBxofChVDWSBUZWNoIC0gU2l0ZSBGZXJtYXQQACoCZnJAAA==;X-A
 PPLE-RADIUS=141.1750546875714;X-APPLE-REFERENCEFRAME=0;X-TITLE=CY Tech -
  Site du Port:geo:49.032529,2.066631`
    },
    "PARC": {
        name: "CY Tech - Site du Parc",
        address: "Avenue du Parc",
        apple_structured_location : `X-APPLE-STRUCTURED-LOCATION;VALUE=URI;X-ADDRESS=Avenue du Parc;X-APPLE-MA
 PKIT-HANDLE=CAESpAIIrk0Q4OCqluT/ubtPGhIJkqEZenqESEARIg+Oo4OPAEAiXwoGRnJh
 bmNlEgJGUhoOw45sZS1kZS1GcmFuY2UqClZhbC1kJ09pc2UyDkNlcmd5LVBvbnRvaXNlOgU5
 NTAwMFIOQXZlbnVlIGR1IFBhcmNiDkF2ZW51ZSBkdSBQYXJjKhZDWSBUZWNoIC0gU2l0ZSBk
 dSBQYXJjMipBdmVudWUgZHUgUGFyYwo5NTAwMCBDZXJneS1Qb250b2lzZQpGcmFuY2U4L1AB
 WlgKJwjg4KqW5P+5u08SEgmSoRl6eoRIQBEiD46jg48AQBiuTZADAZgDAaIfLAjg4KqW5P+5
 u08aIAoWQ1kgVGVjaCAtIFNpdGUgZHUgUGFyYxAAKgJlbkAA;X-APPLE-RADIUS=170.4421
 70658364;X-APPLE-REFERENCEFRAME=0;X-TITLE=CY Tech - Site du Parc:geo:49.
 034988,2.070075`
    },
    "PAU": {
        name: "CY Tech",
        address: "2 Boulevard Lucien Favre\\, 64000 Pau\\, France",
        apple_structured_location: `X-APPLE-STRUCTURED-LOCATION;VALUE=URI;X-ADDRESS="2 Boulevard Lucien Favre
 , 64000 Pau, France";X-APPLE-MAPKIT-HANDLE=CAESoQIIrk0Q87eMsvD8vuMJGhIJp
 dsSueCoRUAR3h/vVSsT178ieQoGRnJhbmNlEgJGUhoSTm91dmVsbGUtQXF1aXRhaW5lKhZQe
 XLDqW7DqWVzLUF0bGFudGlxdWVzMgNQYXU6BTY0MDAwUhZCb3VsZXZhcmQgTHVjaWVuIEZhd
 nJlWgEyYhgyIEJvdWxldmFyZCBMdWNpZW4gRmF2cmUqB0NZIFRlY2gyGDIgQm91bGV2YXJkI
 Ex1Y2llbiBGYXZyZTIJNjQwMDAgUGF1MgZGcmFuY2U4L1ABWkkKJwjzt4yy8Py+4wkSEgml2
 xK54KhFQBHeH+9VKxPXvxiuTZADAZgDAaIfHQjzt4yy8Py+4wkaEQoHQ1kgVGVjaBAAKgJmc
 kAA;X-APPLE-RADIUS=141.1749392090978;X-APPLE-REFERENCEFRAME=0;X-TITLE=CY
  Tech:geo:43.319358,-0.360545`
    },
    "SAINT MARTIN": {
        name: "CY Tech - Site de Saint-Martin",
        address: "2 Rue Adolphe Chauvin\\, 95300 Pontoise\\, France",
        apple_structured_location: `X-APPLE-STRUCTURED-LOCATION;VALUE=URI;X-ADDRESS="2 Rue Adolphe Chauvin, 9
 5300 Pontoise, France";X-APPLE-MAPKIT-HANDLE=CAESwAIIrk0Q4Kyq/8WEmutbGhI
 JEXzCyIGFSEAR1M7V+zKtAEAiaAoGRnJhbmNlEgJGUhoOw45sZS1kZS1GcmFuY2UqClZhbC1
 kJ09pc2UyCFBvbnRvaXNlOgU5NTMwMFITUnVlIEFkb2xwaGUgQ2hhdXZpbloBMmIVMiBSdWU
 gQWRvbHBoZSBDaGF1dmluKh5DWSBUZWNoIC0gU2l0ZSBkZSBTYWludC1NYXJ0aW4yFTIgUnV
 lIEFkb2xwaGUgQ2hhdXZpbjIOOTUzMDAgUG9udG9pc2UyBkZyYW5jZTgvUAFaYAonCOCsqv/
 FhJrrWxISCRF8wsiBhUhAEdTO1fsyrQBAGK5NkAMBmAMBoh80COCsqv/FhJrrWxooCh5DWSB
 UZWNoIC0gU2l0ZSBkZSBTYWludC1NYXJ0aW4QACoCZnJAAA==;X-APPLE-RADIUS=141.175
 0549242353;X-APPLE-REFERENCEFRAME=0;X-TITLE=CY Tech - Site de Saint-Mart
 in:geo:49.043023,2.084570`
    }
};

// MARK: - ICS

// The academic year runs from September 1 to June 30: from September 2026 on,
// the feeds switch to "2026/2027" (and July 2027 still belongs to it).
function academic_year(now = new Date()) {
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1 = janvier
    return month >= 9 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
}

const YEAR = academic_year();
const GROUP = "Groupe 1";

const begin_VCalendar = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:PRODID:-//CY Cal Software//NONSGML v1.0//FR\nX-WR-CALNAME:CY Tech - EDT ${YEAR}\nX-WR-CALDESC:CY Tech - EDT Ing 1 GIA\nX-APPLE-CALENDAR-COLOR:#2760ab\n`;
const begin_VCalendar_cm = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:PRODID:-//CY Cal Software//NONSGML v1.0//FR\nX-WR-CALNAME:CY Tech - Cours Magistraux ${YEAR}\nX-WR-CALDESC:CY Tech - EDT Ing 1 GIA - Cours Magistraux - ${YEAR} - ${GROUP}\nX-APPLE-CALENDAR-COLOR:#D5E1DE\n`;
const begin_VCalendar_td = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:PRODID:-//CY Cal Software//NONSGML v1.0//FR\nX-WR-CALNAME:CY Tech - Travaux Dirigés ${YEAR}\nX-WR-CALDESC:CY Tech - EDT Ing 1 GIA - Travaux Dirigés - ${YEAR} - ${GROUP}\nX-APPLE-CALENDAR-COLOR:#D1DCEB\n`;
const begin_VCalendar_tp = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:PRODID:-//CY Cal Software//NONSGML v1.0//FR\nX-WR-CALNAME:CY Tech - Travaux Pratiques ${YEAR}\nX-WR-CALDESC:CY Tech - EDT Ing 1 GIA - Travaux Pratiques - ${YEAR} - ${GROUP}\nX-APPLE-CALENDAR-COLOR:#CDE8D8\n`;
const begin_VCalendar_cc = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:PRODID:-//CY Cal Software//NONSGML v1.0//FR\nX-WR-CALNAME:CY Tech - Contrôles Continues ${YEAR}\nX-WR-CALDESC:CY Tech - EDT Ing 1 GIA - Contrôles Continues - ${YEAR} - ${GROUP}\nX-APPLE-CALENDAR-COLOR:#D9C5F8\n`;
const begin_VCalendar_exams = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:PRODID:-//CY Cal Software//NONSGML v1.0//FR\nX-WR-CALNAME:CY Tech - Partiels ${YEAR}\nX-WR-CALDESC:CY Tech - EDT Ing 1 GIA - Partiels - ${YEAR} - ${GROUP}\nX-APPLE-CALENDAR-COLOR:#D4CDE7\n`;
const begin_VCalendar_others = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:PRODID:-//CY Cal Software//NONSGML v1.0//FR\nX-WR-CALNAME:CY Tech - Autres évènements ${YEAR}\nX-WR-CALDESC:CY Tech - EDT Ing 1 GIA - Autres évènements - ${YEAR} - ${GROUP}\nX-APPLE-CALENDAR-COLOR:#D9CCD9\n`;
const begin_VEvent = `BEGIN:VEVENT\n`;
const end_VEvent = `END:VEVENT\n`;
const end_VCalendar = "END:VCALENDAR";

// MARK: - Network

const default_headers = {
    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
    "accept-language": "en-US,en;q=0.9",
    "upgrade-insecure-requests": "1",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.90 Safari/537.36"
};

module.exports = {
    event_type, site_buildings, sites_location,
    begin_VCalendar, begin_VCalendar_cm, begin_VCalendar_td, begin_VCalendar_tp, begin_VCalendar_cc, begin_VCalendar_exams, begin_VCalendar_others, begin_VEvent, end_VEvent, end_VCalendar,
    default_headers
};