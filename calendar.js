const { google } = require('googleapis');
const logger = require("firebase-functions/logger");

const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/calendar'],
})

const gcal = google.calendar({ version: 'v3', auth });

module.exports.createEvent = function (eventData) {
    const eventCal = {
        'summary': `${eventData.title}`,
        'id': `${eventData.id}`,
        'description': `This event organized by ${eventData.chapter.title}<br><a href="${eventData.url}">Event Page</a>`,
        'start': {
            'dateTime': eventData.start_date,
            'timeZone': 'America/Los_Angeles',
        },
        'end': {
            'dateTime': eventData.end_date,
            'timeZone': 'America/Los_Angeles',
        },
    };
    gcal.events.insert({
        calendarId: process.env.CALENDAR_ID,
        resource: eventCal,
    }, function (err, event) {
        if (err) {
            logger.error('There was an error contacting the Calendar service: ', err)
            logger.info('Event data was:', eventCal)
            return;
        }
        logger.info('Event created: ', event.data);
    });

}


module.exports.updateEvent = function (eventData) {
    const eventCal = {
        'summary': `${eventData.title}`,
        'description': `This event organized by ${eventData.chapter.title}<br><a href="${eventData.url}">Event Page</a>`,
        'start': {
            'dateTime': eventData.start_date,
            'timeZone': 'America/Los_Angeles',
        },
        'end': {
            'dateTime': eventData.end_date,
            'timeZone': 'America/Los_Angeles',
        },
    };
    gcal.events.update({
        calendarId: process.env.CALENDAR_ID,
        eventId: `${eventData.id}`,
        resource: eventCal,
    }, function (err, event) {
        if (err) {
            logger.error('There was an error contacting the Calendar service: ', err)
            logger.info('Event data was:', eventCal)
            return;
        }
        logger.info('Event updated: ', event.data);
    });

}


module.exports.deleteEvent = function (eventData) {
    gcal.events.delete({
        calendarId: process.env.CALENDAR_ID,
        eventId: `${eventData.id}`,
    }, function (err, event) {
        if (err) {
            logger.error('There was an error contacting the Calendar service: ', err)
            logger.info('Event data was:', eventData)
            return;
        }
        logger.info('Event deleted: ', eventData);
    });

}
