const { google } = require('googleapis');
const logger = require("firebase-functions/logger");
const { defineString } = require('firebase-functions/params');

const CALENDAR_ID = defineString('CALENDAR_ID');

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

    return new Promise((resolve, reject) => {
        gcal.events.insert({
            calendarId: CALENDAR_ID.value(),
            resource: eventCal,
        }, function (err, event) {
            if (err) {
                if (err.code === 409) {
                    logger.info('Event already exists, attempting to update instead');
                    gcal.events.update({
                        calendarId: CALENDAR_ID.value(),
                        eventId: `${eventData.id}`,
                        resource: eventCal,
                    }, function (updateErr, updatedEvent) {
                        if (updateErr) {
                            logger.error('Failed to update existing event: ', updateErr);
                            reject(updateErr);
                            return;
                        }
                        logger.info('Successfully updated existing event: ', updatedEvent.data);
                        resolve(updatedEvent.data);
                    });
                } else {
                    logger.error('There was an error contacting the Calendar service: ', err);
                    logger.info('Event data was:', eventCal);
                    reject(err);
                }
                return;
            }
            logger.info('Event created: ', event.data);
            resolve(event.data);
        });
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
    return new Promise((resolve, reject) => {
        gcal.events.update({
            calendarId: CALENDAR_ID.value(),
            eventId: `${eventData.id}`,
            resource: eventCal,
        }, function (err, event) {
            if (err) {
                logger.error('There was an error contacting the Calendar service: ', err)
                logger.info('Event data was:', eventCal)
                reject(err);
                return;
            }
            logger.info('Event updated: ', event.data);
            resolve(event.data);
        });
    });
}


module.exports.deleteEvent = function (eventData) {
    return new Promise((resolve, reject) => {
        gcal.events.delete({
            calendarId: CALENDAR_ID.value(),
            eventId: `${eventData.id}`,
        }, function (err, event) {
            if (err) {
                logger.error('There was an error contacting the Calendar service: ', err)
                logger.info('Event data was:', eventData)
                reject(err);
                return;
            }
            logger.info('Event deleted: ', eventData);
            resolve();
        });
    });
}
