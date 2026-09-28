/* =========================================================
   SNK SMART BOARD
   FIREBASE CONFIGURATION
   ========================================================= */

const SNK_FIREBASE_CONFIG = {

  /*
   * Replace every value below with the configuration
   * from your Firebase Web App.
   */

  apiKey: "YOUR_API_KEY",

  authDomain:
    "YOUR_PROJECT_ID.firebaseapp.com",

  databaseURL:
    "https://YOUR_DATABASE_NAME-default-rtdb.firebaseio.com",

  projectId:
    "YOUR_PROJECT_ID",

  storageBucket:
    "YOUR_PROJECT_ID.firebasestorage.app",

  messagingSenderId:
    "YOUR_MESSAGING_SENDER_ID",

  appId:
    "YOUR_APP_ID"

};


/* =========================================================
   GLOBAL CONFIG
   ========================================================= */

window.SNKFirebaseConfig =
  SNK_FIREBASE_CONFIG;
