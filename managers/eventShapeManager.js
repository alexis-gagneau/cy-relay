const settings = require('./../configs/settings.json');
const { event_type, site_buildings, sites_location } = require('./../configs/constants');

const moment = require('moment');

let notes = undefined;

function event_shapper(celcatEvent, sidebar_elements) {
    let category = undefined;
    let course = undefined;
    let roomData = [];
    let professors = [];
    notes = undefined;
    let type = event_type.other;
    
    for (const sidebar_element of sidebar_elements) {
        if (sidebar_element.label === "Event category") {
            switch (sidebar_element.content) {
                case "CM":
                case "CM à distance":
                case "CM par groupe de TD":
                    category = sidebar_element.content;
                    type = event_type.cm;
                    break;
                case "TD":
                case "TD à distance":
                    category = sidebar_element.content;
                    type = event_type.td;
                    break;
                case "TP":
                case "TP à distance":
                    category = sidebar_element.content;
                    type = event_type.tp;
                    break;
                case "Contrôle continu":
                    category = "CC";
                    type = event_type.cc;
                    break;
                case "Examens":
                    category = sidebar_element.content;
                    type = event_type.exam;
                    break;
                default:
                    category = sidebar_element.content;
                    type = event_type.other;
            }
        } else if (sidebar_element.entityType === 100) {
            course = sidebar_element.content;
        } else if (sidebar_element.entityType === 101) {
            professors.push(sidebar_element.content?.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) || "");
        } else if (sidebar_element.entityType === 102) {
            roomData.push(sidebar_element.content);
        } else if (sidebar_element.label === "Name" && course === undefined) {
            course = sidebar_element.content;
        }
    }

    let id = celcatEvent.id;
    let title = setTitle(category, course, type);
    let location = celcatEvent.sites && celcatEvent.sites.length > 0 ? sites_location[celcatEvent.sites[0].toUpperCase().replace(/^SITE DE\s+/i, "").replace(/^SITE DU\s+/i, "").replace(/^ST/i, "SAINT")] : undefined;
    
    let startDate;
    let endDate;
    if(title?.toLowerCase().includes("anglais")) {
        if (moment(celcatEvent.start).week() % 2 === 0) {
            startDate = moment(celcatEvent.start).format('YYYYMMDDTHHmmss');
            endDate = moment(celcatEvent.start).add(1, 'hour').add(30, 'minutes').format('YYYYMMDDTHHmmss');
        } else {
            endDate = (celcatEvent.end
                ? moment(celcatEvent.end)
                : moment(celcatEvent.start)
            ).format('YYYYMMDDTHHmmss');
            startDate = moment(celcatEvent.end).subtract(1, 'hour').subtract(30, 'minutes').format('YYYYMMDDTHHmmss');
        }
    } else {
        startDate = celcatEvent.allDay
            ? moment(celcatEvent.start).format('YYYYMMDD')
            : moment(celcatEvent.start).format('YYYYMMDDTHHmmss');
        endDate = celcatEvent.allDay
            ? (celcatEvent.end
                ? moment(celcatEvent.end).add(1, 'day')
                : moment(celcatEvent.start).add(1, 'day')
            ).format('YYYYMMDD')
            : (celcatEvent.end
                ? moment(celcatEvent.end)
                : moment(celcatEvent.start)
            ).format('YYYYMMDDTHHmmss');
    }

    let isAllDay = celcatEvent.allDay;
    let url = settings.calendar_url;
    let rooms = shapeRoomData(roomData);

    return {
        id,
        title,
        location,
        startDate,
        endDate,
        isAllDay,
        url,
        rooms,
        professors,
        notes,
        type
    };

}

function setTitle(category, course, type) {
    const categoriesPattern = ["CM", "TD"];
    const modulesPattern = /\[.*[A-Z]+.*\]/;

    if (course) {
        const foundCategory = categoriesPattern.find(cat => course.includes(cat));

        if (foundCategory) {
            const parts = course.split(foundCategory);
            course = parts.join(" ").replace(/\s+/g, ' ').trim();
        }

        course = course.replace(modulesPattern, "").trim();
        course = course.charAt(0).toUpperCase() + course.slice(1).toLowerCase();

        if (type !== event_type.other && course != undefined) {
            return `${type.abreviation} - ${course}`;
        } else if (category && !category.includes("Indisponibilité")) {
            notes = course;
            return category;
        } else {
            return course;
        }
    }

    return undefined;
}

function shapeRoomData(roomData) {
    let buildings = [];
    let rooms = [];
    let roomTypes = [];
    let roomCapacities = [];

    roomData.forEach(data => {
        if (data) {
            let splitData = data.split(" ");
            let buildingInitials = null;

            if (splitData.length > 0) {
                let buildingDiminutive = splitData[0];

                if (site_buildings[buildingDiminutive]) {
                    buildings.push(site_buildings[buildingDiminutive][0]);
                    buildingInitials = site_buildings[buildingDiminutive][1];
                }

                splitData.shift();
            }

            if (splitData.length > 0) {
                let capacity = splitData[splitData.length - 1];
                let capacityValue = parseInt(capacity.slice(0, -1));

                if (!isNaN(capacityValue)) {
                    roomCapacities.push(capacityValue);
                    splitData.pop();
                }
            }

            if (splitData.length > 0) {
                if (splitData[0] == buildingInitials) {
                    splitData.shift();
                }
                if (splitData[0].includes(buildingInitials)) {
                    splitData[0] = splitData[0].replace(buildingInitials, "")
                }

                if(splitData[1] == '-') {
                    splitData.splice(0, 3, splitData.slice(0, 3).join(""));
                }

                let room = splitData[0];

                if (!isNaN(room) || (!isNaN(room.split('-')[0]) && !isNaN(room.split('-')[1]))) {
                    if (buildingInitials) {
                        rooms.push(`${buildingInitials} ${room}`);
                    } else {
                        rooms.push(room);
                    }
                    splitData.shift();

                    let roomType = splitData.join(" ").toLowerCase();
                    roomType = roomType.charAt(0).toUpperCase() + roomType.slice(1);
                    roomTypes.push(roomType);
                } else {
                    let roomName = splitData
                        .filter(word => word !== "AMPHITHÉÂTRE")
                        .join(" ")
                        .replace(/AMPHITHEATRE/g, "Amphithéâtre")
                        .toLowerCase();
                    roomName = roomName.charAt(0).toUpperCase() + roomName.slice(1);

                    rooms.push(roomName);
                    roomTypes.push("Amphithéâtre");
                }
            }
        }
    });

    return {
        buildings,
        rooms,
        roomTypes,
        roomCapacities
    };
}

module.exports = { event_shapper };
