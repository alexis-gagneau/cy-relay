function stringToDate(dateString) {
    if (dateString.length === 15) {
        const day = dateString.slice(0, 2);
        const month = dateString.slice(2, 4);
        const year = dateString.slice(4, 8);
        const hours = dateString.slice(9, 11);
        const minutes = dateString.slice(11, 13);
        const seconds = dateString.slice(13, 15);

        return new Date(`${year}-${month}-${day}T${hours}:${minutes}:${seconds}`);
    }
    else if (dateString.length === 8) {
        const day = dateString.slice(0, 2);
        const month = dateString.slice(2, 4);
        const year = dateString.slice(4, 8);

        return new Date(`${year}-${month}-${day}`);
    }

    return new Date();
}

module.exports = { stringToDate };