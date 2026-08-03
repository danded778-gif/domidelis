// ============================================
// firebase-config.js — Inicialización de Firebase
// ============================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getMessaging } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCfQGtf-7NBSO3j23crjhMsxggCHToqwYQ",
  authDomain: "domidelis-app.firebaseapp.com",
  projectId: "domidelis-app",
  storageBucket: "domidelis-app.firebasestorage.app",
  messagingSenderId: "942295492847",
  appId: "1:942295492847:web:9183f67bec7c71ee4f931a",
  measurementId: "G-P9PCQS31F9"
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);
const db = getFirestore(app);

export { messaging, db };