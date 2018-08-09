import * as functions from 'firebase-functions';

import { commandPing, commandHistory, getAll, getGroups, getUser, messageAction } from './functions';

// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
//
export const helloWorld = functions.https.onRequest((_, response) => {
  response.send("Hello from Firebase!");
});

export const command_ping = functions.https.onRequest(commandPing);

export const command_history = functions.https.onRequest(commandHistory
);

export const get_all = functions.https.onRequest(getAll);

export const get_groups = functions.https.onRequest(getGroups);

export const get_user = functions.https.onRequest(getUser);

export const message_action = functions.https.onRequest(messageAction);
