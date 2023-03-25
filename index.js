const functions = require("firebase-functions");
const admin = require('firebase-admin');
const axios = require('axios');

const calendar = require("./calendar")

admin.initializeApp();

const db = admin.firestore();
const eventsCollection = db.collection("events");

exports.eventChecker = functions
    .runWith({ timeoutSeconds: 300 })
    .pubsub.schedule('0 0 * * *')
    .onRun(async (context) => {
        
        const startDate = new Date(2023, 2, 1).toISOString().substring(0, 10);
        const endDate = new Date(Date.now() + 52 * 7 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);

        var data = { "links": { "next": `https://gdsc.community.dev/api/event/?fields=id,chapter,title,status,start_date,end_date,url&status=Published&start_date=${startDate}&end_date=${endDate}` } };

        const savedIds = (await eventsCollection.get()).docs.map(function (doc) {
            return doc.id;
        });


        while (data["links"]["next"] != null) {
            const batch = db.batch();

            var resp = await axios.get(data["links"]["next"]);
            var data = resp.data;
            functions.logger.debug(data["links"]["next"]);


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
    });

exports.databaseOnCreate = functions.firestore
    .document("events/{eventId}")
    .onCreate((snap, context) => {
        const eventData = snap.data();
        calendar.createEvent(eventData);
        return null;
    });

exports.databaseOnUpdate = functions.firestore
    .document("events/{eventId}")
    .onUpdate((change, context) => {
        const newEventData = change.after.data();
        calendar.updateEvent(newEventData);
        return null;
    });

exports.databaseOnDelete = functions.firestore
    .document("events/{eventId}")
    .onDelete((snap, context) => {
        const deletedData = snap.data();
        calendar.deleteEvent(deletedData);
        return null;
    });