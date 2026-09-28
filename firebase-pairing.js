/* =========================================================
   SNK SMART BOARD
   FIREBASE REALTIME PAIRING SYSTEM
   STEP 13.9
   ========================================================= */

(function () {
  "use strict";


  /* =======================================================
     CONFIG
     ======================================================= */

  const SESSION_ROOT = "smartBoardSessions";

  const SESSION_LENGTH = 6;

  const SESSION_TIMEOUT = 24 * 60 * 60 * 1000;


  /* =======================================================
     STATE
     ======================================================= */

  const state = {

    pairingCode: null,

    sessionPath: null,

    connected: false,

    createdAt: null

  };


  /* =======================================================
     GENERATE 6 DIGIT CODE
     ======================================================= */

  function generatePairingCode() {

    const min = 100000;

    const max = 999999;

    const number =
      Math.floor(
        Math.random() *
        (max - min + 1)
      ) + min;

    return String(number);

  }


  /* =======================================================
     CHECK FIREBASE
     ======================================================= */

  function firebaseReady() {

    return Boolean(
      window.SNKFirebase &&
      window.SNKFirebase.database &&
      window.SNKFirebase.ref &&
      window.SNKFirebase.set
    );

  }


  /* =======================================================
     CREATE SESSION
     ======================================================= */

  async function createSession() {

    if (!firebaseReady()) {

      throw new Error(
        "Firebase is not ready."
      );

    }


    let code =
      generatePairingCode();


    /*
     * Session path
     */

    let sessionRef =
      window.SNKFirebase.ref(
        window.SNKFirebase.database,
        `${SESSION_ROOT}/${code}`
      );


    /*
     * Try to create a unique code.
     *
     * For the initial browser implementation
     * we generate a new 6-digit code.
     */

    const sessionData = {

      pairingCode: code,

      createdAt:
        Date.now(),

      connected: false,

      controllerConnected: false,

      boardOnline: true,

      lastActivity:
        Date.now()

    };


    await window.SNKFirebase.set(
      sessionRef,
      sessionData
    );


    /*
     * Save local state
     */

    state.pairingCode =
      code;

    state.sessionPath =
      `${SESSION_ROOT}/${code}`;

    state.connected =
      false;

    state.createdAt =
      sessionData.createdAt;


    /*
     * Public global state
     */

    window.SNKSmartBoardPairing = {

      state,

      createSession,

      getPairingCode,

      getSessionPath,

      isConnected,

      closeSession

    };


    /*
     * Save locally
     */

    try {

      localStorage.setItem(
        "SNKSmartBoardPairingCode",
        code
      );

      localStorage.setItem(
        "SNKSmartBoardSessionPath",
        state.sessionPath
      );

    } catch (error) {

      console.warn(
        "Could not save pairing state.",
        error
      );

    }


    return {

      code,

      sessionPath:
        state.sessionPath

    };

  }


  /* =======================================================
     GET PAIRING CODE
     ======================================================= */

  function getPairingCode() {

    return state.pairingCode;

  }


  /* =======================================================
     GET SESSION PATH
     ======================================================= */

  function getSessionPath() {

    return state.sessionPath;

  }


  /* =======================================================
     CONNECTION STATE
     ======================================================= */

  function isConnected() {

    return state.connected;

  }


  /* =======================================================
     CLOSE SESSION
     ======================================================= */

  async function closeSession() {

    if (!firebaseReady()) {
      return;
    }


    if (!state.sessionPath) {
      return;
    }


    try {

      const sessionRef =
        window.SNKFirebase.ref(
          window.SNKFirebase.database,
          state.sessionPath
        );


      await window.SNKFirebase.set(
        sessionRef,
        null
      );

    } catch (error) {

      console.error(
        "Could not close Firebase session:",
        error
      );

    }


    state.pairingCode = null;

    state.sessionPath = null;

    state.connected = false;

    state.createdAt = null;


    try {

      localStorage.removeItem(
        "SNKSmartBoardPairingCode"
      );

      localStorage.removeItem(
        "SNKSmartBoardSessionPath"
      );

    } catch (error) {

      console.warn(
        "Could not clear local pairing state.",
        error
      );

    }

  }


  /* =======================================================
     DISPLAY PAIRING CODE
     ======================================================= */

  function displayPairingCode(code) {

    /*
     * If a pairing code element already exists,
     * update it automatically.
     */

    const selectors = [

      "#pairingCode",

      "#pairCodeDisplay",

      "#boardPairingCode",

      "[data-pairing-code]"

    ];


    for (const selector of selectors) {

      const element =
        document.querySelector(
          selector
        );


      if (!element) {
        continue;
      }


      element.textContent =
        code;

      element.value =
        code;

      element.dataset.pairingCode =
        code;

    }

  }


  /* =======================================================
     START BOARD SESSION
     ======================================================= */

  async function startBoardPairing() {

    try {

      const result =
        await createSession();


      displayPairingCode(
        result.code
      );


      console.log(
        "SNK Smart Board pairing code:",
        result.code
      );


      console.log(
        "Firebase session:",
        result.sessionPath
      );


      /*
       * Dispatch event for the main Smart Board UI.
       */

      window.dispatchEvent(
        new CustomEvent(
          "SNKPairingCodeCreated",
          {
            detail: result
          }
        )
      );


      return result;

    } catch (error) {

      console.error(
        "SNK Smart Board pairing failed:",
        error
      );


      window.dispatchEvent(
        new CustomEvent(
          "SNKPairingError",
          {
            detail: {
              error
            }
          }
        )
      );


      throw error;

    }

  }


  /* =======================================================
     FIREBASE READY
     ======================================================= */

  function handleFirebaseReady() {

    console.log(
      "SNK Firebase is ready for pairing."
    );


    /*
     * Automatically create a session
     * when the Smart Board page loads.
     */

    startBoardPairing()
      .catch(
        function (error) {

          console.error(
            "Unable to start Smart Board pairing:",
            error
          );

        }
      );

  }


  /* =======================================================
     EXPOSE API
     ======================================================= */

  window.SNKSmartBoardPairing = {

    state,

    createSession,

    startBoardPairing,

    getPairingCode,

    getSessionPath,

    isConnected,

    closeSession,

    displayPairingCode

  };


  /* =======================================================
     FIREBASE EVENT
     ======================================================= */

  window.addEventListener(
    "SNKFirebaseReady",
    handleFirebaseReady
  );


  /* =======================================================
     FALLBACK
     ======================================================= */

  /*
   * If Firebase was already initialized before
   * this script loaded, start pairing immediately.
   */

  if (firebaseReady()) {

    setTimeout(
      function () {

        if (!state.pairingCode) {

          startBoardPairing()
            .catch(
              function (error) {

                console.error(
                  error
                );

              }
            );

        }

      },
      0
    );

  }


})();
