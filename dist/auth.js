// auth.js — semplice: init + redirect se non loggato
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Inizializza Firebase solo una volta
const firebaseConfig = {
  apiKey: "AIzaSyD0tDQQepdvj_oZPcQuUrEKpoNOd4zF0nE",
  authDomain: "agenda-carmenmauro.firebaseapp.com",
  projectId: "agenda-carmenmauro",
  storageBucket: "agenda-carmenmauro.appspot.com",
  messagingSenderId: "959324976221",
  appId: "1:959324976221:web:780c8e9195965cea0749b4"
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Controlla se è loggato
const FILE = location.pathname.split("/").pop().toLowerCase();
const PAGINE_LIBERE = new Set(["login.html", "signup.html", "forgot.html"]);

onAuthStateChanged(auth, user => {
  if (!user && !PAGINE_LIBERE.has(FILE)) {
    // Non loggato e sta su pagina protetta → torna al login
    location.href = "login.html";
  }
});