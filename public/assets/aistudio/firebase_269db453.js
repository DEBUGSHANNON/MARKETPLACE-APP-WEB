import { initializeApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import {
  getAuth,
  connectAuthEmulator
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";

import {
  getFirestore,
  connectFirestoreEmulator
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAqn_M6cxGRDWREWvWcN5n_CnnTkWyE7KY",
  authDomain: "campustrade-b9147.firebaseapp.com",
  projectId: "campustrade-b9147",
  storageBucket: "campustrade-b9147.firebasestorage.app",
  messagingSenderId: "815209434388",
  appId: "1:815209434388:web:a9e83e8064ebce8fdd0601",
  measurementId: "G-EZ4VTWVNH3"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
// LOCAL TESTING ONLY
const USE_EMULATORS = true;

if (USE_EMULATORS) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099");
  connectFirestoreEmulator(db, "127.0.0.1", 8080);

  console.log("CampusTrade is connected to Firebase Emulators");
}
export const STUDENT_EMAIL_DOMAIN = "@graduate.utm.my";