const { setGlobalOptions, logger } = require("firebase-functions/v2");
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { get } = require('axios');
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentCreated, onDocumentUpdated, onDocumentDeleted } = require("firebase-functions/v2/firestore");

const { createEvent, updateEvent, deleteEvent } = require("./calendar");

initializeApp();
setGlobalOptions({ maxInstances: 5 })

const db = getFirestore();
const eventsCollection = db.collection("events");

const startDate = new Date(2023, 5, 1).toISOString().substring(0, 10);
const endDate = new Date(Date.now() + 52 * 7 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);

const fetchEvents = async (context) => {
    var data = { "links": { "next": `https://gdsc.community.dev/api/event/?fields=id,chapter,title,status,start_date,end_date,url&status=Published&start_date=${startDate}&end_date=${endDate}` } };

    const savedIds = (await eventsCollection.get()).docs.map(function (doc) {
        return doc.id;
    });

    while (data["links"]["next"] != null) {
        const batch = db.batch();

        var resp = await get(data["links"]["next"]);
        var data = resp.data;
        logger.debug(data["links"]["next"]);


        data["results"].forEach(function (event) {
            if (event["chapter"]["country"] == "TR") {
                batch.set(eventsCollection.doc(event["id"].toString()), event)
                if (savedIds.includes(event["id"].toString())) {
                    savedIds.splice(savedIds.indexOf(event["id"].toString()), 1);
                }
            }
        });

        await batch.commit();
    }
    for (let i = 0; i < savedIds.length; i++) {
        await eventsCollection.doc(savedIds[i]).delete();
    }
    return null;
}

// fetch events that could not be added to the calendar due to error
const fetchEventsWithoutCalendar = async (event) => {
    const snapshot = await db.collection("events").where("isAddedToCalendar", "==", false).get()
    snapshot.docs.map(async function (doc) {
        const eventData = doc.data();
        await createEvent(eventData);
        await doc.ref.update({ isAddedToCalendar: true });
    });
    return null;
}

exports.eventChecker = onSchedule({ schedule: '0 0 * * *', timeoutSeconds: 300 }, fetchEvents)

exports.eventWithoutCalenderChecker = onSchedule({ schedule: '0 12 * * *', timeoutSeconds: 300 }, fetchEventsWithoutCalendar)

exports.databaseOnCreate = onDocumentCreated("events/{eventId}", async (event) => {
    const eventData = event.data.data();
    try {
        await createEvent(eventData);
        await event.data.ref.update({ isAddedToCalendar: true });
    } catch (e) {
        logger.error(e);
        await event.data.ref.update({ isAddedToCalendar: false });
    }
    return null;
})

exports.databaseOnUpdate = onDocumentUpdated("events/{eventId}", (event) => {
    if (event.data.before.data().isAddedToCalendar == false && event.data.after.data().isAddedToCalendar == true) {
        const newEventData = event.data.after.data();
        updateEvent(newEventData);
    }
    return null;
})

exports.databaseOnDelete = onDocumentDeleted("events/{eventId}", (event) => {
    const deletedData = event.data.data();
    if (deletedData.isAddedToCalendar == true)
        deleteEvent(deletedData);
    return null;
})
