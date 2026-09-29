(function () {
  "use strict";

  /* =========================================================
     SNK SMART BOARD
     FIREBASE PAIRING + CONNECTION STATUS
     
     File:
     firebase-pairing.js

     STEP 13.13
     
     Features:
     - 6 digit pairing code
     - Firebase session creation
     - Controller connection detection
     - Controller disconnect detection
     - Smart Board online status
     - Pairing events
     - Session cleanup
     ========================================================= */

  const SESSION_ROOT =
    "smartBoardSessions";

  const SESSION_LENGTH = 6;

  const SESSION_TIMEOUT =
    24 * 60 * 60 * 1000;

  const state = {
    pairingCode: null,

    sessionPath: null,

    connected: false,

    controllerConnected: false,

    createdAt: null,

    lastActivity: null,

    sessionUnsubscribe: null
  };

  /* =======================================================
     FIREBASE READY
     ======================================================= */

  function firebaseReady() {
    return Boolean(
      window.SNKFirebase &&
      window.SNKFirebase.database &&
      window.SNKFirebase.ref &&
      window.SNKFirebase.set &&
      window.SNKFirebase.onValue
    );
  }

  /* =======================================================
     GENERATE PAIRING CODE
     ======================================================= */

  function generatePairingCode() {
    const min =
      100000;

    const max =
      999999;

    const number =
      Math.floor(
        Math.random() *
          (max - min + 1)
      ) + min;

    return String(number);
  }

  /* =======================================================
     SESSION DATA
     ======================================================= */

  function createSessionData(
    code
  ) {
    const now =
      Date.now();

    return {
      pairingCode: code,

      createdAt: now,

      connected: false,

      controllerConnected:
        false,

      boardOnline: true,

      lastActivity: now,

      boardName:
        "SNK Smart Board",

      version:
        "13.13"
    };
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

    /*
      Make sure an old listener/session
      is not left active.
    */

    stopSessionMonitor();

    let code =
      generatePairingCode();

    let sessionRef =
      window.SNKFirebase.ref(
        window.SNKFirebase.database,
        `${SESSION_ROOT}/${code}`
      );

    /*
      Check whether generated code already
      exists.

      Collision is very unlikely, but this
      makes the pairing safer.
    */

    try {
      const existing =
        await new Promise(
          (resolve, reject) => {
            let completed =
              false;

            const finish = (
              callback,
              value
            ) => {
              if (completed) return;

              completed = true;

              callback(value);
            };

            try {
              window.SNKFirebase.onValue(
                sessionRef,
                (snapshot) => {
                  finish(
                    resolve,
                    snapshot.exists()
                  );
                },
                {
                  onlyOnce: true
                }
              );
            } catch (error) {
              finish(
                reject,
                error
              );
            }
          }
        );

      if (existing) {
        code =
          generatePairingCode();

        sessionRef =
          window.SNKFirebase.ref(
            window.SNKFirebase.database,
            `${SESSION_ROOT}/${code}`
          );
      }
    } catch (error) {
      console.warn(
        "Could not check pairing-code collision:",
        error
      );
    }

    const sessionData =
      createSessionData(
        code
      );

    await window.SNKFirebase.set(
      sessionRef,
      sessionData
    );

    state.pairingCode =
      code;

    state.sessionPath =
      `${SESSION_ROOT}/${code}`;

    state.connected =
      true;

    state.controllerConnected =
      false;

    state.createdAt =
      sessionData.createdAt;

    state.lastActivity =
      sessionData.lastActivity;

    exposePairingAPI();

    savePairingState();

    /*
      Start listening for Controller
      connection changes.
    */

    startSessionMonitor();

    return {
      code,

      sessionPath:
        state.sessionPath,

      createdAt:
        state.createdAt
    };
  }

  /* =======================================================
     START SESSION MONITOR
     ======================================================= */

  function startSessionMonitor() {
    if (!firebaseReady()) {
      return false;
    }

    if (!state.sessionPath) {
      return false;
    }

    stopSessionMonitor();

    try {
      const sessionRef =
        window.SNKFirebase.ref(
          window.SNKFirebase.database,
          state.sessionPath
        );

      const unsubscribe =
        window.SNKFirebase.onValue(
          sessionRef,
          (snapshot) => {
            handleSessionSnapshot(
              snapshot
            );
          }
        );

      state.sessionUnsubscribe =
        typeof unsubscribe ===
        "function"
          ? unsubscribe
          : null;

      return true;
    } catch (error) {
      console.error(
        "Could not monitor Smart Board session:",
        error
      );

      return false;
    }
  }

  /* =======================================================
     STOP SESSION MONITOR
     ======================================================= */

  function stopSessionMonitor() {
    if (
      state.sessionUnsubscribe
    ) {
      try {
        state.sessionUnsubscribe();
      } catch (error) {
        console.warn(
          error
        );
      }
    }

    state.sessionUnsubscribe =
      null;
  }

  /* =======================================================
     HANDLE SESSION SNAPSHOT
     ======================================================= */

  function handleSessionSnapshot(
    snapshot
  ) {
    if (!snapshot.exists()) {
      /*
        Session was removed.

        This can happen when the Smart Board
        closes the session.
      */

      state.controllerConnected =
        false;

      dispatchControllerDisconnected();

      return;
    }

    const data =
      snapshot.val();

    if (!data) {
      return;
    }

    const previous =
      state.controllerConnected;

    const current =
      Boolean(
        data.controllerConnected ||
        data.connected
      );

    state.controllerConnected =
      current;

    state.lastActivity =
      data.lastActivity ||
      state.lastActivity;

    /*
      Controller just connected.
    */

    if (
      !previous &&
      current
    ) {
      dispatchControllerConnected(
        data
      );
    }

    /*
      Controller just disconnected.
    */

    if (
      previous &&
      !current
    ) {
      dispatchControllerDisconnected(
        data
      );
    }

    updatePairingStatusUI();
  }

  /* =======================================================
     CONTROLLER CONNECTED EVENT
     ======================================================= */

  function dispatchControllerConnected(
    data = {}
  ) {
    state.controllerConnected =
      true;

    updatePairingStatusUI();

    console.log(
      "SNK Smart Board: Controller connected."
    );

    window.dispatchEvent(
      new CustomEvent(
        "SNKControllerConnected",
        {
          detail: {
            pairingCode:
              state.pairingCode,

            sessionPath:
              state.sessionPath,

            boardName:
              data.boardName ||
              "SNK Smart Board"
          }
        }
      )
    );

    showConnectionToast(
      "Controller connected",
      "success"
    );
  }

  /* =======================================================
     CONTROLLER DISCONNECTED EVENT
     ======================================================= */

  function dispatchControllerDisconnected(
    data = {}
  ) {
    const wasConnected =
      state.controllerConnected;

    state.controllerConnected =
      false;

    updatePairingStatusUI();

    /*
      Only announce a disconnect if
      there really was a connected
      Controller before.
    */

    if (wasConnected) {
      console.log(
        "SNK Smart Board: Controller disconnected."
      );

      window.dispatchEvent(
        new CustomEvent(
          "SNKControllerDisconnected",
          {
            detail: {
              pairingCode:
                state.pairingCode,

              sessionPath:
                state.sessionPath,

              boardName:
                data.boardName ||
                "SNK Smart Board"
            }
          }
        )
      );

      showConnectionToast(
        "Controller disconnected",
        "info"
      );
    }
  }

  /* =======================================================
     PAIRING UI
     ======================================================= */

  function displayPairingCode(
    code
  ) {
    const selectors = [
      "#pairingCode",
      "#pairCodeDisplay",
      "#boardPairingCode",
      "[data-pairing-code]"
    ];

    for (
      const selector of selectors
    ) {
      const elements =
        document.querySelectorAll(
          selector
        );

      elements.forEach(
        (element) => {
          element.textContent =
            code;

          if (
            "value" in element
          ) {
            element.value =
              code;
          }

          element.dataset.pairingCode =
            code;
        }
      );
    }
  }

  /* =======================================================
     CONNECTION STATUS UI
     ======================================================= */

  function updatePairingStatusUI() {
    const status =
      $("#pairingStatus");

    const dot =
      status?.querySelector(
        ".pairing-status-dot"
      );

    if (!status) {
      return;
    }

    status.classList.toggle(
      "connected",
      state.controllerConnected
    );

    if (dot) {
      dot.classList.toggle(
        "connected",
        state.controllerConnected
      );
    }

    if (
      state.controllerConnected
    ) {
      status.innerHTML =
        `
          <span class="pairing-status-dot connected"></span>
          Controller Connected
        `;
    } else {
      status.innerHTML =
        `
          <span class="pairing-status-dot"></span>
          Waiting for controller...
        `;
    }

    /*
      Optional status elements outside
      the pairing modal.
    */

    const statusElements = [
      "#controllerStatus",
      "#controllerConnectionStatus",
      "#wirelessStatus",
      "#wirelessConnectionStatus"
    ];

    statusElements.forEach(
      (selector) => {
        const element =
          document.querySelector(
            selector
          );

        if (!element) return;

        element.textContent =
          state.controllerConnected
            ? "Controller Connected"
            : "Waiting for Controller";

        element.classList.toggle(
          "connected",
          state.controllerConnected
        );

        element.classList.toggle(
          "offline",
          !state.controllerConnected
        );
      }
    );
  }

  /* =======================================================
     TOAST
     ======================================================= */

  function showConnectionToast(
    message,
    type = "info"
  ) {
    let toast =
      document.querySelector(
        "#smartBoardToast"
      ) ||
      document.querySelector(
        "#toast"
      ) ||
      document.querySelector(
        ".toast"
      );

    if (!toast) {
      return;
    }

    toast.textContent =
      message;

    toast.classList.remove(
      "success",
      "error",
      "show"
    );

    if (
      type === "success" ||
      type === "error"
    ) {
      toast.classList.add(
        type
      );
    }

    requestAnimationFrame(
      () => {
        toast.classList.add(
          "show"
        );
      }
    );

    clearTimeout(
      showConnectionToast.timer
    );

    showConnectionToast.timer =
      setTimeout(() => {
        toast.classList.remove(
          "show"
        );
      }, 2400);
  }

  /* =======================================================
     COPY PAIRING CODE
     ======================================================= */

  async function copyPairingCode() {
    const code =
      state.pairingCode;

    if (!code) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        code
      );

      showConnectionToast(
        "Pairing code copied",
        "success"
      );
    } catch (error) {
      /*
        Clipboard API may not work on
        some browsers / contexts.
      */

      const textarea =
        document.createElement(
          "textarea"
        );

      textarea.value =
        code;

      textarea.style.position =
        "fixed";

      textarea.style.opacity =
        "0";

      document.body.appendChild(
        textarea
      );

      textarea.select();

      try {
        document.execCommand(
          "copy"
        );

        showConnectionToast(
          "Pairing code copied",
          "success"
        );
      } catch (
        copyError
      ) {
        console.warn(
          copyError
        );
      }

      textarea.remove();
    }
  }

  /* =======================================================
     SAVE PAIRING STATE
     ======================================================= */

  function savePairingState() {
    try {
      if (
        state.pairingCode
      ) {
        localStorage.setItem(
          "SNKSmartBoardPairingCode",
          state.pairingCode
        );
      }

      if (
        state.sessionPath
      ) {
        localStorage.setItem(
          "SNKSmartBoardSessionPath",
          state.sessionPath
        );
      }
    } catch (error) {
      console.warn(
        "Could not save pairing state.",
        error
      );
    }
  }

  /* =======================================================
     CLEAR PAIRING STATE
     ======================================================= */

  function clearPairingState() {
    try {
      localStorage.removeItem(
        "SNKSmartBoardPairingCode"
      );

      localStorage.removeItem(
        "SNKSmartBoardSessionPath"
      );
    } catch (error) {
      console.warn(
        "Could not clear pairing state.",
        error
      );
    }
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

    stopSessionMonitor();

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

    state.pairingCode =
      null;

    state.sessionPath =
      null;

    state.connected =
      false;

    state.controllerConnected =
      false;

    state.createdAt =
      null;

    state.lastActivity =
      null;

    clearPairingState();

    updatePairingStatusUI();

    window.dispatchEvent(
      new CustomEvent(
        "SNKPairingClosed"
      )
    );
  }

  /* =======================================================
     GETTERS
     ======================================================= */

  function getPairingCode() {
    return state.pairingCode;
  }

  function getSessionPath() {
    return state.sessionPath;
  }

  function isConnected() {
    return state.connected;
  }

  function isControllerConnected() {
    return state.controllerConnected;
  }

  /* =======================================================
     PUBLIC API
     ======================================================= */

  function exposePairingAPI() {
    window.SNKSmartBoardPairing = {
      state,

      createSession,

      startBoardPairing,

      getPairingCode,

      getSessionPath,

      isConnected,

      isControllerConnected,

      closeSession,

      displayPairingCode,

      startSessionMonitor,

      stopSessionMonitor
    };
  }

  exposePairingAPI();

  /* =======================================================
     START BOARD PAIRING
     ======================================================= */

  async function startBoardPairing() {
    try {
      const result =
        await createSession();

      displayPairingCode(
        result.code
      );

      updatePairingStatusUI();

      console.log(
        "SNK Smart Board pairing code:",
        result.code
      );

      console.log(
        "Firebase session:",
        result.sessionPath
      );

      window.dispatchEvent(
        new CustomEvent(
          "SNKPairingCodeCreated",
          {
            detail:
              result
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

    startBoardPairing()
      .catch(
        (error) => {
          console.error(
            "Unable to start Smart Board pairing:",
            error
          );
        }
      );
  }

  window.addEventListener(
    "SNKFirebaseReady",
    handleFirebaseReady
  );

  /* =======================================================
     COPY BUTTON
     ======================================================= */

  document.addEventListener(
    "click",
    (event) => {
      const button =
        event.target.closest(
          "#copyPairCodeBtn"
        );

      if (!button) {
        return;
      }

      copyPairingCode();
    }
  );

  /* =======================================================
     PAGE READY FALLBACK
     ======================================================= */

  if (firebaseReady()) {
    setTimeout(
      () => {
        if (
          !state.pairingCode
        ) {
          startBoardPairing()
            .catch(
              (error) => {
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

  /* =======================================================
     BEFORE PAGE CLOSE
     ======================================================= */

  window.addEventListener(
    "beforeunload",
    () => {
      /*
        We intentionally do NOT perform an
        asynchronous Firebase write here.

        Browser unload can terminate it.

        The actual session remains available
        until explicitly closed or cleaned up.
      */
    }
  );

  /* =======================================================
     DEBUG API
     ======================================================= */

  window.SNKSmartBoardPairingDebug = {
    getState() {
      return {
        pairingCode:
          state.pairingCode,

        sessionPath:
          state.sessionPath,

        boardConnected:
          state.connected,

        controllerConnected:
          state.controllerConnected,

        createdAt:
          state.createdAt,

        lastActivity:
          state.lastActivity
      };
    }
  };
})();
