/* =========================================================
   SNK SMART BOARD
   WIRELESS CONTROLLER
   controller.js
   STEP 13.11 — FIREBASE PAIRING
   ========================================================= */

(function () {
  "use strict";

  /* =========================================================
     STATE
     ========================================================= */

  const state = {
    connected: false,
    pairingCode: "",
    sessionPath: "",
    tool: "pen",
    color: "#111827",
    size: 5,
    zoom: 100,
    currentPage: 1,
    totalPages: 1,
    cameraOn: false,
    recording: false,
    commandsSent: 0,
    connectedAt: null
  };

  /* =========================================================
     DOM HELPERS
     ========================================================= */

  const $ = (selector) =>
    document.querySelector(selector);

  const $$ = (selector) =>
    document.querySelectorAll(selector);

  /* =========================================================
     ELEMENTS
     ========================================================= */

  const pairCard = $("#pairCard");
  const controller = $("#controller");

  const pairCodeInput = $("#pairCode");
  const connectBtn = $("#connectBtn");
  const pairMessage = $("#pairMessage");

  const connectionStatus = $("#connectionStatus");
  const connectionText = $("#connectionText");

  const connectedBoardName = $("#connectedBoardName");
  const connectedSession = $("#connectedSession");

  const toast = $("#toast");

  const commandsSentElement = $("#commandsSent");
  const connectedTimeElement = $("#connectedTime");
  const sessionConnectionType = $("#sessionConnectionType");

  /* =========================================================
     LOCAL STORAGE
     ========================================================= */

  const STORAGE_KEY =
    "SNKSmartBoardControllerState";

  function saveState() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          tool: state.tool,
          color: state.color,
          size: state.size,
          zoom: state.zoom
        })
      );
    } catch (error) {
      console.warn(
        "Could not save controller state.",
        error
      );
    }
  }

  function loadState() {
    try {
      const saved =
        localStorage.getItem(STORAGE_KEY);

      if (!saved) return;

      const data = JSON.parse(saved);

      if (data.tool) {
        state.tool = data.tool;
      }

      if (data.color) {
        state.color = data.color;
      }

      if (Number.isFinite(data.size)) {
        state.size = data.size;
      }

      if (Number.isFinite(data.zoom)) {
        state.zoom = data.zoom;
      }
    } catch (error) {
      console.warn(
        "Could not load controller state.",
        error
      );
    }
  }

  loadState();

  /* =========================================================
     FIREBASE HELPERS
     ========================================================= */

  function firebaseReady() {
    return Boolean(
      window.SNKFirebase &&
      window.SNKFirebase.database &&
      window.SNKFirebase.ref &&
      window.SNKFirebase.set &&
      window.SNKFirebase.push
    );
  }

  function getSessionReference() {
    if (!firebaseReady()) {
      throw new Error(
        "Firebase is not ready."
      );
    }

    if (!state.sessionPath) {
      throw new Error(
        "No active Smart Board session."
      );
    }

    return window.SNKFirebase.ref(
      window.SNKFirebase.database,
      state.sessionPath
    );
  }

  /* =========================================================
     TOAST
     ========================================================= */

  let toastTimer = null;

  function showToast(message) {
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
      toast.classList.remove("show");
    }, 2200);
  }

  /* =========================================================
     PAIR MESSAGE
     ========================================================= */

  function showPairMessage(
    message,
    type = "normal"
  ) {
    if (!pairMessage) return;

    pairMessage.textContent = message;

    pairMessage.classList.remove(
      "error",
      "success"
    );

    if (type === "error") {
      pairMessage.classList.add("error");
    }

    if (type === "success") {
      pairMessage.classList.add("success");
    }
  }

  /* =========================================================
     CONNECTION UI
     ========================================================= */

  function setConnectionUI(
    connected,
    message
  ) {
    if (connectionStatus) {
      connectionStatus.classList.toggle(
        "connected",
        connected
      );

      connectionStatus.classList.toggle(
        "disconnected",
        !connected
      );
    }

    if (connectionText) {
      connectionText.textContent =
        message ||
        (connected
          ? "Connected"
          : "Not Connected");
    }
  }

  function updateConnectedUI() {
    if (pairCard) {
      pairCard.hidden = state.connected;
    }

    if (controller) {
      controller.hidden = !state.connected;
    }

    if (connectedBoardName) {
      connectedBoardName.textContent =
        "SNK Smart Board";
    }

    if (connectedSession) {
      connectedSession.textContent =
        state.pairingCode || "------";
    }

    if (sessionConnectionType) {
      sessionConnectionType.textContent =
        "Firebase Realtime";
    }

    setConnectionUI(
      state.connected,
      state.connected
        ? "Connected"
        : "Not Connected"
    );

    updateStatistics();
  }

  /* =========================================================
     STATISTICS
     ========================================================= */

  function updateStatistics() {
    if (commandsSentElement) {
      commandsSentElement.textContent =
        String(state.commandsSent);
    }

    if (connectedTimeElement) {
      if (!state.connectedAt) {
        connectedTimeElement.textContent =
          "--";
      } else {
        connectedTimeElement.textContent =
          formatElapsed(
            Date.now() -
              state.connectedAt
          );
      }
    }
  }

  function formatElapsed(milliseconds) {
    const seconds = Math.max(
      0,
      Math.floor(milliseconds / 1000)
    );

    const minutes =
      Math.floor(seconds / 60);

    const remainingSeconds =
      seconds % 60;

    if (minutes < 1) {
      return `${remainingSeconds}s`;
    }

    return `${minutes}m ${String(
      remainingSeconds
    ).padStart(2, "0")}s`;
  }

  setInterval(
    updateStatistics,
    1000
  );

  /* =========================================================
     PAIRING CODE VALIDATION
     ========================================================= */

  function cleanPairingCode(value) {
    return String(value || "")
      .replace(/\D/g, "")
      .slice(0, 6);
  }

  function validPairingCode(code) {
    return /^\d{6}$/.test(code);
  }

  if (pairCodeInput) {
    pairCodeInput.addEventListener(
      "input",
      function () {
        this.value =
          cleanPairingCode(
            this.value
          );

        if (
          validPairingCode(
            this.value
          )
        ) {
          showPairMessage(
            "Code is ready. Tap Connect."
          );
        } else {
          showPairMessage(
            "Enter the 6-digit code shown on the Smart Board."
          );
        }
      }
    );

    pairCodeInput.addEventListener(
      "keydown",
      function (event) {
        if (
          event.key === "Enter"
        ) {
          event.preventDefault();

          connectToBoard();
        }
      }
    );
  }

  /* =========================================================
     FIREBASE SESSION CHECK
     ========================================================= */

  async function connectToBoard() {
    const code =
      cleanPairingCode(
        pairCodeInput
          ? pairCodeInput.value
          : ""
      );

    if (!validPairingCode(code)) {
      showPairMessage(
        "Please enter a valid 6-digit pairing code.",
        "error"
      );

      if (pairCodeInput) {
        pairCodeInput.focus();
      }

      return;
    }

    if (!firebaseReady()) {
      showPairMessage(
        "Firebase is not ready. Please wait a moment and try again.",
        "error"
      );

      showToast(
        "Firebase connection not ready."
      );

      return;
    }

    if (connectBtn) {
      connectBtn.disabled = true;
      connectBtn.textContent =
        "Connecting...";
    }

    showPairMessage(
      "Checking Smart Board session..."
    );

    try {
      const sessionPath =
        `smartBoardSessions/${code}`;

      const sessionRef =
        window.SNKFirebase.ref(
          window.SNKFirebase.database,
          sessionPath
        );

      let sessionData = null;

      /*
       * Use Firebase onValue once when available.
       * This avoids requiring get() in the existing
       * Firebase wrapper.
       */

      if (
        typeof window.SNKFirebase.onValue ===
        "function"
      ) {
        sessionData =
          await readFirebaseOnce(
            sessionRef
          );
      } else {
        throw new Error(
          "Firebase realtime listener is unavailable."
        );
      }

      if (!sessionData) {
        throw new Error(
          "No Smart Board session found for this code."
        );
      }

      /*
       * Save connection state.
       */

      state.connected = true;
      state.pairingCode = code;
      state.sessionPath = sessionPath;
      state.connectedAt = Date.now();
      state.commandsSent = 0;

      /*
       * Update Firebase session.
       */

      await window.SNKFirebase.set(
        sessionRef,
        {
          ...sessionData,
          connected: true,
          controllerConnected: true,
          lastActivity: Date.now()
        }
      );

      updateConnectedUI();

      showPairMessage(
        "Connected successfully.",
        "success"
      );

      showToast(
        "Smart Board connected."
      );

      /*
       * Tell the Smart Board page that
       * the controller is connected.
       */

      window.dispatchEvent(
        new CustomEvent(
          "SNKControllerConnected",
          {
            detail: {
              code,
              sessionPath,
              session: sessionData
            }
          }
        )
      );

      /*
       * Save locally.
       */

      try {
        localStorage.setItem(
          "SNKSmartBoardControllerCode",
          code
        );

        localStorage.setItem(
          "SNKSmartBoardControllerSession",
          sessionPath
        );
      } catch (error) {
        console.warn(
          "Could not save controller session.",
          error
        );
      }

      /*
       * Focus controller area.
       */

      if (controller) {
        setTimeout(() => {
          controller.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });
        }, 100);
      }
    } catch (error) {
      console.error(
        "Smart Board pairing failed:",
        error
      );

      state.connected = false;
      state.pairingCode = "";
      state.sessionPath = "";
      state.connectedAt = null;

      updateConnectedUI();

      showPairMessage(
        error.message ||
          "Could not connect to Smart Board.",
        "error"
      );

      showToast(
        "Connection failed."
      );
    } finally {
      if (connectBtn) {
        connectBtn.disabled = false;
        connectBtn.textContent =
          "Connect";
      }
    }
  }

  /* =========================================================
     READ FIREBASE VALUE ONCE
     ========================================================= */

  function readFirebaseOnce(
    reference
  ) {
    return new Promise(
      (resolve, reject) => {
        let finished = false;

        const finish = (
          callback,
          value
        ) => {
          if (finished) return;

          finished = true;

          callback(value);
        };

        try {
          const unsubscribe =
            window.SNKFirebase.onValue(
              reference,
              (snapshot) => {
                try {
                  const value =
                    typeof snapshot.val ===
                    "function"
                      ? snapshot.val()
                      : null;

                  finish(
                    resolve,
                    value
                  );

                  /*
                   * Stop listener after first read.
                   */

                  if (
                    typeof unsubscribe ===
                    "function"
                  ) {
                    unsubscribe();
                  }
                } catch (error) {
                  finish(
                    reject,
                    error
                  );
                }
              },
              (error) => {
                finish(
                  reject,
                  error
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
  }

  /* =========================================================
     SEND COMMAND TO SMART BOARD
     ========================================================= */

  async function sendCommand(
    type,
    payload = {}
  ) {
    if (!state.connected) {
      showToast(
        "Connect to Smart Board first."
      );

      return false;
    }

    if (!firebaseReady()) {
      showToast(
        "Firebase is not ready."
      );

      return false;
    }

    if (!state.sessionPath) {
      showToast(
        "Smart Board session is missing."
      );

      return false;
    }

    try {
      const commandsRef =
        window.SNKFirebase.ref(
          window.SNKFirebase.database,
          `${state.sessionPath}/commands`
        );

      const commandRef =
        window.SNKFirebase.push(
          commandsRef
        );

      const commandData = {
        type: String(type),
        payload:
          payload &&
          typeof payload === "object"
            ? payload
            : {},
        timestamp: Date.now(),
        controller: "mobile"
      };

      await window.SNKFirebase.set(
        commandRef,
        commandData
      );

      state.commandsSent += 1;

      updateStatistics();

      /*
       * Update session activity.
       */

      try {
        const sessionRef =
          getSessionReference();

        await window.SNKFirebase.set(
          sessionRef,
          {
            connected: true,
            controllerConnected: true,
            lastActivity: Date.now()
          }
        );
      } catch (activityError) {
        console.warn(
          "Could not update session activity.",
          activityError
        );
      }

      /*
       * Also dispatch locally.
       * Useful when Board + Controller are
       * opened in the same browser.
       */

      window.dispatchEvent(
        new CustomEvent(
          "SNKSmartBoardCommand",
          {
            detail: commandData
          }
        )
      );

      return true;
    } catch (error) {
      console.error(
        "Command send failed:",
        error
      );

      showToast(
        "Could not send command."
      );

      return false;
    }
  }

  /* =========================================================
     BUTTON HELPER
     ========================================================= */

  function bindClick(
    selector,
    callback
  ) {
    const element = $(selector);

    if (!element) return;

    element.addEventListener(
      "click",
      function (event) {
        event.preventDefault();

        callback(event);
      }
    );
  }

  /* =========================================================
     BOARD CONTROLS
     ========================================================= */

  bindClick(
    "#undoBtn",
    function () {
      sendCommand("undo");
    }
  );

  bindClick(
    "#redoBtn",
    function () {
      sendCommand("redo");
    }
  );

  bindClick(
    "#clearBtn",
    function () {
      sendCommand("clear");
    }
  );

  bindClick(
    "#newBoardBtn",
    function () {
      sendCommand("newBoard");
    }
  );

  /* =========================================================
     DRAWING TOOLS
     ========================================================= */

  function setTool(tool) {
    state.tool = tool;

    saveState();

    $$(".tool-btn").forEach(
      function (button) {
        button.classList.toggle(
          "active",
          button.dataset.tool ===
            tool
        );
      }
    );

    sendCommand(
      "tool",
      {
        tool
      }
    );
  }

  bindClick(
    "#penBtn",
    function () {
      setTool("pen");
    }
  );

  bindClick(
    "#markerBtn",
    function () {
      setTool("marker");
    }
  );

  bindClick(
    "#eraserBtn",
    function () {
      setTool("eraser");
    }
  );

  /* =========================================================
     COLOR
     ========================================================= */

  function setColor(color) {
    if (!color) return;

    state.color = color;

    saveState();

    const preview =
      $("#colorPreview");

    if (preview) {
      preview.style.background =
        color;
    }

    $$(".color-btn").forEach(
      function (button) {
        button.classList.toggle(
          "active",
          button.dataset.color ===
            color
        );
      }
    );

    sendCommand(
      "color",
      {
        color
      }
    );
  }

  $$(".color-btn").forEach(
    function (button) {
      button.addEventListener(
        "click",
        function () {
          setColor(
            button.dataset.color
          );
        }
      );
    }
  );

  /* =========================================================
     PEN SIZE
     ========================================================= */

  const sizeSlider =
    $("#sizeSlider");

  const sizeValue =
    $("#sizeValue");

  function setSize(size) {
    const numericSize =
      Number(size);

    if (
      !Number.isFinite(
        numericSize
      )
    ) {
      return;
    }

    state.size =
      Math.max(
        1,
        Math.min(
          50,
          numericSize
        )
      );

    if (sizeSlider) {
      sizeSlider.value =
        String(state.size);
    }

    if (sizeValue) {
      sizeValue.textContent =
        `${state.size}px`;
    }

    saveState();

    sendCommand(
      "size",
      {
        size: state.size
      }
    );
  }

  if (sizeSlider) {
    sizeSlider.addEventListener(
      "input",
      function () {
        const numericSize =
          Number(
            sizeSlider.value
          );

        state.size =
          numericSize;

        if (sizeValue) {
          sizeValue.textContent =
            `${numericSize}px`;
        }
      }
    );

    sizeSlider.addEventListener(
      "change",
      function () {
        setSize(
          sizeSlider.value
        );
      }
    );
  }

  /* =========================================================
     ZOOM
     ========================================================= */

  const zoomValue =
    $("#zoomValue");

  const zoomDisplay =
    $("#zoomDisplay");

  function updateZoomUI() {
    if (zoomValue) {
      zoomValue.textContent =
        `${state.zoom}%`;
    }

    if (zoomDisplay) {
      zoomDisplay.textContent =
        `${state.zoom}%`;
    }
  }

  function setZoom(zoom) {
    state.zoom =
      Math.max(
        25,
        Math.min(
          300,
          Number(zoom)
        )
      );

    updateZoomUI();
    saveState();

    sendCommand(
      "zoom",
      {
        zoom: state.zoom
      }
    );
  }

  bindClick(
    "#zoomOutBtn",
    function () {
      setZoom(
        state.zoom - 10
      );
    }
  );

  bindClick(
    "#zoomResetBtn",
    function () {
      setZoom(100);
    }
  );

  bindClick(
    "#zoomInBtn",
    function () {
      setZoom(
        state.zoom + 10
      );
    }
  );

  /* =========================================================
     PDF / SLIDES
     ========================================================= */

  bindClick(
    "#previousPageBtn",
    function () {
      if (
        state.currentPage <= 1
      ) {
        showToast(
          "Already on first page."
        );

        return;
      }

      state.currentPage -= 1;

      updatePageStatus();

      sendCommand(
        "previousPage",
        {
          page:
            state.currentPage
        }
      );
    }
  );

  bindClick(
    "#nextPageBtn",
    function () {
      if (
        state.currentPage >=
        state.totalPages
      ) {
        sendCommand(
          "nextPage"
        );

        return;
      }

      state.currentPage += 1;

      updatePageStatus();

      sendCommand(
        "nextPage",
        {
          page:
            state.currentPage
        }
      );
    }
  );

  function updatePageStatus() {
    const pageStatus =
      $("#pageStatus");

    if (pageStatus) {
      pageStatus.textContent =
        `Page ${state.currentPage} / ${state.totalPages}`;
    }
  }

  /* =========================================================
     CAMERA
     ========================================================= */

  function toggleCamera() {
    state.cameraOn =
      !state.cameraOn;

    const cameraStatus =
      $("#cameraStatus");

    const cameraButton =
      $("#cameraToggleBtn");

    if (cameraStatus) {
      cameraStatus.textContent =
        state.cameraOn
          ? "Camera On"
          : "Camera Off";
    }

    if (cameraButton) {
      cameraButton.classList.toggle(
        "active",
        state.cameraOn
      );
    }

    sendCommand(
      "camera",
      {
        enabled:
          state.cameraOn
      }
    );
  }

  bindClick(
    "#cameraToggleBtn",
    function () {
      toggleCamera();
    }
  );

  /* =========================================================
     RECORDING
     ========================================================= */

  function toggleRecording() {
    state.recording =
      !state.recording;

    const recordButtonText =
      $("#recordButtonText");

    const recordStatus =
      $("#recordStatus");

    const recordLight =
      $("#recordLight");

    const recordButton =
      $("#recordToggleBtn");

    if (recordButtonText) {
      recordButtonText.textContent =
        state.recording
          ? "Stop Recording"
          : "Start Recording";
    }

    if (recordStatus) {
      recordStatus.textContent =
        state.recording
          ? "Recording..."
          : "Ready";
    }

    if (recordLight) {
      recordLight.classList.toggle(
        "active",
        state.recording
      );
    }

    if (recordButton) {
      recordButton.classList.toggle(
        "active",
        state.recording
      );
    }

    sendCommand(
      "recording",
      {
        enabled:
          state.recording
      }
    );
  }

  bindClick(
    "#recordToggleBtn",
    function () {
      toggleRecording();
    }
  );

  /* =========================================================
     DISCONNECT
     ========================================================= */

  async function disconnect() {
    const oldSessionPath =
      state.sessionPath;

    const oldCode =
      state.pairingCode;

    try {
      if (
        firebaseReady() &&
        oldSessionPath
      ) {
        const sessionRef =
          window.SNKFirebase.ref(
            window.SNKFirebase.database,
            oldSessionPath
          );

        /*
         * Do not delete the complete session.
         * Only update controller connection.
         */

        const sessionData =
          await readFirebaseOnce(
            sessionRef
          );

        if (sessionData) {
          await window.SNKFirebase.set(
            sessionRef,
            {
              ...sessionData,
              connected:
                false,
              controllerConnected:
                false,
              lastActivity:
                Date.now()
            }
          );
        }
      }
    } catch (error) {
      console.warn(
        "Could not update disconnect state.",
        error
      );
    }

    state.connected = false;
    state.pairingCode = "";
    state.sessionPath = "";
    state.connectedAt = null;
    state.commandsSent = 0;

    updateConnectedUI();

    if (pairCodeInput) {
      pairCodeInput.value = "";
    }

    showPairMessage(
      "Disconnected. Enter a new code to connect again."
    );

    showToast(
      "Smart Board disconnected."
    );

    try {
      localStorage.removeItem(
        "SNKSmartBoardControllerCode"
      );

      localStorage.removeItem(
        "SNKSmartBoardControllerSession"
      );
    } catch (error) {
      console.warn(error);
    }

    window.dispatchEvent(
      new CustomEvent(
        "SNKControllerDisconnected",
        {
          detail: {
            code: oldCode
          }
        }
      )
    );
  }

  bindClick(
    "#disconnectBtnBottom",
    function () {
      disconnect();
    }
  );

  bindClick(
    "#disconnectBtn",
    function () {
      disconnect();
    }
  );

  /* =========================================================
     KEYBOARD SHORTCUTS
     ========================================================= */

  document.addEventListener(
    "keydown",
    function (event) {
      /*
       * Do not trigger shortcuts while
       * typing the pairing code.
       */

      if (
        document.activeElement ===
        pairCodeInput
      ) {
        return;
      }

      if (
        event.ctrlKey &&
        event.key.toLowerCase() ===
          "z"
      ) {
        event.preventDefault();

        sendCommand(
          event.shiftKey
            ? "redo"
            : "undo"
        );
      }

      if (
        event.key === "Escape" &&
        state.connected
      ) {
        disconnect();
      }
    }
  );

  /* =========================================================
     PUBLIC API
     ========================================================= */

  window.SNKSmartBoardController = {
    getState: function () {
      return {
        ...state
      };
    },

    connect:
      connectToBoard,

    disconnect,

    send:
      sendCommand,

    setTool,

    setColor,

    setSize,

    setZoom,

    nextPage: function () {
      const button =
        $("#nextPageBtn");

      if (button) {
        button.click();
      }
    },

    previousPage: function () {
      const button =
        $("#previousPageBtn");

      if (button) {
        button.click();
      }
    },

    toggleCamera,

    toggleRecording
  };

  /* =========================================================
     FIREBASE READY
     ========================================================= */

  function handleFirebaseReady() {
    console.log(
      "SNK Controller Firebase ready."
    );

    if (sessionConnectionType) {
      sessionConnectionType.textContent =
        "Firebase Ready";
    }
  }

  window.addEventListener(
    "SNKFirebaseReady",
    handleFirebaseReady
  );

  /* =========================================================
     CONNECT BUTTON
     ========================================================= */

  if (connectBtn) {
    connectBtn.addEventListener(
      "click",
      function () {
        connectToBoard();
      }
    );
  }

  /* =========================================================
     INITIAL UI
     ========================================================= */

  updateZoomUI();

  if (sizeSlider) {
    sizeSlider.value =
      String(state.size);
  }

  if (sizeValue) {
    sizeValue.textContent =
      `${state.size}px`;
  }

  const initialColorPreview =
    $("#colorPreview");

  if (initialColorPreview) {
    initialColorPreview.style.background =
      state.color;
  }

  updatePageStatus();
  updateConnectedUI();

  console.log(
    "SNK Smart Board Controller loaded."
  );
})();
