// auth.js — con cache offline persistente per Firestore + fix Safari
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  initializeFirestore,
  persistentLocalCache
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Config Firebase
const firebaseConfig = {
  apiKey: "AIzaSyD0tDQQepdvj_oZPcQuUrEKpoNOd4zF0nE",
  authDomain: "agenda-carmenmauro.firebaseapp.com",
  projectId: "agenda-carmenmauro",
  storageBucket: "agenda-carmenmauro.appspot.com",
  messagingSenderId: "959324976221",
  appId: "1:959324976221:web:780c8e9195965cea0749b4"
};

// Inizializza Firebase app una sola volta
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Inizializza Firestore con cache offline persistente
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache()
});

// Inizializza Auth
export const auth = getAuth(app);

// Esportazioni comuni
export {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
};

// Ricava nome file (compatibile anche con Safari/iOS)
let FILE = location.pathname.split("/").pop()?.toLowerCase() || "index.html";
if (!FILE.endsWith(".html")) FILE += ".html";

// Pagine accessibili senza login
const PAGINE_LIBERE = new Set(["login.html", "signup.html", "forgot.html"]);

// Se non loggato e non sei su una pagina libera → vai a login
onAuthStateChanged(auth, user => {
  if (!user && !PAGINE_LIBERE.has(FILE)) {
    location.href = "login.html";
  }
});