const { setGlobalOptions, logger } = require("firebase-functions/v2");
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { get } = require('axios');
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentCreated, onDocumentUpdated, onDocumentDeleted } = require("firebase-functions/v2/firestore");

const { createEvent, updateEvent, deleteEvent } = require("./calendar");

initializeApp();
setGlobalOptions({ maxInstances: 5 });

const db = getFirestore();
const eventsCollection = db.collection("events");

const startDate = new Date(2023, 8, 1).toISOString().substring(0, 10);
const endDate = new Date(Date.now() + 52 * 7 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);

const fetchEvents = async (context) => {
    try {
        var data = { "links": { "next": `https://gdsc.community.dev/api/event/?fields=id,chapter,title,status,start_date,end_date,url&status=Published&start_date=${startDate}&end_date=${endDate}` } };

        const savedIds = (await eventsCollection.get()).docs.map(doc => doc.id);
        const processedIds = new Set();

        while (data["links"]["next"] != null) {
            const batch = db.batch();

            const resp = await get(data["links"]["next"]);
            data = resp.data;
            logger.debug(data["links"]["next"]);

            for (const event of data["results"]) {
                if (event["chapter"]["country"] === "TR") {
                    batch.set(eventsCollection.doc(event["id"].toString()), event);
                    processedIds.add(event["id"].toString());
                }
            }

            await batch.commit();
        }

        const idsToDelete = savedIds.filter(id => !processedIds.has(id));
        for (const id of idsToDelete) {
            await eventsCollection.doc(id).delete();
        }

        return null;
    } catch (error) {
        logger.error('Error in fetchEvents:', error);
        throw error;
    }
};

const fetchEventsWithoutCalendar = async (context) => {
    try {
        const snapshot = await eventsCollection.where("isAddedToCalendar", "==", false).get();
        const updatePromises = snapshot.docs.map(async (doc) => {
            const eventData = doc.data();
            try {
                await createEvent(eventData);
                await doc.ref.update({ isAddedToCalendar: true });
            } catch (error) {
                logger.error(`Failed to process event ${eventData.id}:`, error);
            }
        });
        await Promise.all(updatePromises);
        return null;
    } catch (error) {
        logger.error('Error in fetchEventsWithoutCalendar:', error);
        throw error;
    }
};

// Function Configurations
const functionConfig = {
    memory: '256MiB',
    region: 'us-central1',
    minInstances: 0,
    maxInstances: 1,
    timeoutSeconds: 120
};

// Scheduled Functions
exports.eventChecker = onSchedule({
    ...functionConfig,
    schedule: '0 0 * * *',
    retryCount: 1,
    labels: {
        deployment: 'scheduled'
    }
}, fetchEvents);


exports.eventWithoutCalenderChecker = onSchedule({
    ...functionConfig,
    schedule: '0 12 * * *',
    retryCount: 1,
    labels: {
        deployment: 'scheduled'
    }
}, fetchEventsWithoutCalendar);

// Firestore Trigger Functions
exports.databaseOnCreate = onDocumentCreated({
    ...functionConfig,
    document: "events/{eventId}"
}, async (event) => {
    try {
        const eventData = event.data.data();
        await createEvent(eventData);
        await event.data.ref.update({ isAddedToCalendar: true });
    } catch (error) {
        logger.error('Error in databaseOnCreate:', error);
        await event.data.ref.update({ isAddedToCalendar: false });
    }
});

exports.databaseOnUpdate = onDocumentUpdated({
    ...functionConfig,
    document: "events/{eventId}"
}, async (event) => {
    try {
        if (event.data.before.data().isAddedToCalendar === false && 
            event.data.after.data().isAddedToCalendar === true) {
            const newEventData = event.data.after.data();
            await updateEvent(newEventData);
        }
    } catch (error) {
        logger.error('Error in databaseOnUpdate:', error);
        await event.data.after.ref.update({ isAddedToCalendar: false });
    }
});

exports.databaseOnDelete = onDocumentDeleted({
    ...functionConfig,
    document: "events/{eventId}"
}, async (event) => {
    try {
        const deletedData = event.data.data();
        if (deletedData.isAddedToCalendar === true) {
            await deleteEvent(deletedData);
        }
    } catch (error) {
        logger.error('Error in databaseOnDelete:', error);
    }
});
