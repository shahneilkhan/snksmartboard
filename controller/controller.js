/* =========================================================
   SNK SMART BOARD
   WIRELESS CONTROLLER JAVASCRIPT

   File:
   controller/controller.js

   STEP 13.12

   Features:
   - 6 digit Smart Board pairing
   - Firebase session connection
   - Real-time command sending
   - Pen / Marker / Eraser
   - Color / Size
   - Undo / Redo / Clear / New Board
   - Zoom
   - PDF previous / next
   - Camera
   - Recording
   - Connection status
   - Command counter
   - Disconnect
   ========================================================= */

(() => {
  "use strict";

  /* =======================================================
     STATE
     ======================================================= */

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

    connectedAt: null,

    connectionType: "Firebase",

    boardName: "SNK Smart Board",

    firebaseReady: false
  };

  /* =======================================================
     DOM HELPERS
     ======================================================= */

  const $ = (selector, parent = document) =>
    parent.querySelector(selector);

  const $$ = (selector, parent = document) =>
    [...parent.querySelectorAll(selector)];

  /* =======================================================
     ELEMENTS
     ======================================================= */

  const connectionStatus =
    $("#connectionStatus");

  const connectionText =
    $("#connectionText");

  const pairCard =
    $("#pairCard");

  const controllerPanel =
    $("#controller");

  const pairCodeInput =
    $("#pairCode");

  const connectButton =
    $("#connectBtn");

  const pairMessage =
    $("#pairMessage");

  const connectedBoardName =
    $("#connectedBoardName");

  const connectedSession =
    $("#connectedSession");

  const commandsSentElement =
    $("#commandsSent");

  const connectedTimeElement =
    $("#connectedTime");

  const sessionConnectionType =
    $("#sessionConnectionType");

  const toast =
    $("#toast");

  /* =======================================================
     LOCAL STORAGE
     ======================================================= */

  const STORAGE_KEY =
    "SNKSmartBoardController";

  function saveLocalState() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          pairingCode:
            state.pairingCode,

          sessionPath:
            state.sessionPath,

          tool:
            state.tool,

          color:
            state.color,

          size:
            state.size,

          zoom:
            state.zoom
        })
      );
    } catch (error) {
      console.warn(
        "Could not save controller state.",
        error
      );
    }
  }

  function loadLocalState() {
    try {
      const raw =
        localStorage.getItem(
          STORAGE_KEY
        );

      if (!raw) return;

      const saved =
        JSON.parse(raw);

      if (
        typeof saved !==
        "object"
      ) {
        return;
      }

      if (
        typeof saved.tool ===
        "string"
      ) {
        state.tool =
          saved.tool;
      }

      if (
        typeof saved.color ===
        "string"
      ) {
        state.color =
          saved.color;
      }

      if (
        Number.isFinite(
          Number(saved.size)
        )
      ) {
        state.size =
          Number(saved.size);
      }

      if (
        Number.isFinite(
          Number(saved.zoom)
        )
      ) {
        state.zoom =
          Number(saved.zoom);
      }
    } catch (error) {
      console.warn(
        "Could not load controller state.",
        error
      );
    }
  }

  /* =======================================================
     TOAST
     ======================================================= */

  function showToast(
    message,
    type = "info"
  ) {
    if (!toast) {
      console.log(
        `[SNK Controller] ${message}`
      );
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

    requestAnimationFrame(() => {
      toast.classList.add(
        "show"
      );
    });

    clearTimeout(
      showToast.timer
    );

    showToast.timer =
      setTimeout(() => {
        toast.classList.remove(
          "show"
        );
      }, 2400);
  }

  /* =======================================================
     FIREBASE CHECK
     ======================================================= */

  function isFirebaseReady() {
    return Boolean(
      window.SNKFirebase &&
      window.SNKFirebase.database &&
      window.SNKFirebase.ref &&
      window.SNKFirebase.set &&
      window.SNKFirebase.push &&
      window.SNKFirebase.onValue
    );
  }

  /* =======================================================
     UI STATUS
     ======================================================= */

  function updateConnectionUI() {
    if (connectionStatus) {
      connectionStatus.classList.toggle(
        "connected",
        state.connected
      );

      connectionStatus.classList.toggle(
        "offline",
        !state.connected
      );
    }

    if (connectionText) {
      connectionText.textContent =
        state.connected
          ? "Connected"
          : "Not Connected";
    }

    if (pairCard) {
      pairCard.hidden =
        state.connected;
    }

    if (controllerPanel) {
      controllerPanel.hidden =
        !state.connected;
    }

    if (
      connectedBoardName
    ) {
      connectedBoardName.textContent =
        state.boardName;
    }

    if (
      connectedSession
    ) {
      connectedSession.textContent =
        state.sessionPath ||
        "—";
    }

    if (
      sessionConnectionType
    ) {
      sessionConnectionType.textContent =
        state.connectionType;
    }
  }

  /* =======================================================
     TIME
     ======================================================= */

  function updateConnectedTime() {
    if (
      !connectedTimeElement
    ) {
      return;
    }

    if (!state.connectedAt) {
      connectedTimeElement.textContent =
        "—";
      return;
    }

    const seconds =
      Math.floor(
        (Date.now() -
          state.connectedAt) /
          1000
      );

    const hours =
      Math.floor(
        seconds / 3600
      );

    const minutes =
      Math.floor(
        (seconds % 3600) / 60
      );

    const secs =
      seconds % 60;

    if (hours > 0) {
      connectedTimeElement.textContent =
        `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      connectedTimeElement.textContent =
        `${minutes}m ${secs}s`;
    } else {
      connectedTimeElement.textContent =
        `${secs}s`;
    }
  }

  setInterval(
    updateConnectedTime,
    1000
  );

  /* =======================================================
     COMMAND COUNTER
     ======================================================= */

  function updateCommandCounter() {
    if (
      commandsSentElement
    ) {
      commandsSentElement.textContent =
        String(
          state.commandsSent
        );
    }
  }

  /* =======================================================
     PAIRING CODE VALIDATION
     ======================================================= */

  function normalizePairingCode(
    value
  ) {
    return String(
      value || ""
    )
      .replace(/\D/g, "")
      .slice(0, 6);
  }

  function isValidPairingCode(
    code
  ) {
    return /^\d{6}$/.test(
      code
    );
  }

  function updatePairInput() {
    if (!pairCodeInput) {
      return;
    }

    pairCodeInput.value =
      normalizePairingCode(
        pairCodeInput.value
      );

    if (
      pairCodeInput.value.length ===
      6
    ) {
      pairCodeInput.classList.add(
        "ready"
      );
    } else {
      pairCodeInput.classList.remove(
        "ready"
      );
    }
  }

  /* =======================================================
     SHOW PAIR MESSAGE
     ======================================================= */

  function setPairMessage(
    message,
    type = ""
  ) {
    if (!pairMessage) {
      return;
    }

    pairMessage.textContent =
      message;

    pairMessage.classList.remove(
      "error",
      "success",
      "loading"
    );

    if (type) {
      pairMessage.classList.add(
        type
      );
    }
  }

  /* =======================================================
     FIREBASE SESSION LOOKUP
     ======================================================= */

  async function findSmartBoardSession(
    code
  ) {
    if (!isFirebaseReady()) {
      throw new Error(
        "Firebase is not ready yet."
      );
    }

    const firebase =
      window.SNKFirebase;

    const sessionRef =
      firebase.ref(
        firebase.database,
        `smartBoardSessions/${code}`
      );

    return new Promise(
      (resolve, reject) => {
        let finished =
          false;

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
            firebase.onValue(
              sessionRef,
              (snapshot) => {
                try {
                  const data =
                    snapshot.val();

                  if (!data) {
                    finish(
                      resolve,
                      null
                    );
                    return;
                  }

                  /*
                    The Smart Board session
                    exists.
                  */

                  finish(
                    resolve,
                    {
                      data,
                      sessionRef,
                      unsubscribe
                    }
                  );
                } catch (error) {
                  finish(
                    reject,
                    error
                  );
                }
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

  /* =======================================================
     CONNECT TO SMART BOARD
     ======================================================= */

  async function connect(
    providedCode = ""
  ) {
    if (state.connected) {
      showToast(
        "Already connected.",
        "info"
      );
      return true;
    }

    const code =
      normalizePairingCode(
        providedCode ||
          pairCodeInput?.value
      );

    if (
      !isValidPairingCode(code)
    ) {
      setPairMessage(
        "Please enter the 6-digit pairing code.",
        "error"
      );

      showToast(
        "Enter a valid 6-digit code.",
        "error"
      );

      pairCodeInput?.focus();

      return false;
    }

    if (!isFirebaseReady()) {
      setPairMessage(
        "Firebase is not ready. Please wait a moment.",
        "error"
      );

      showToast(
        "Firebase is not ready.",
        "error"
      );

      return false;
    }

    connectButton &&
      (connectButton.disabled =
        true);

    setPairMessage(
      "Connecting to Smart Board...",
      "loading"
    );

    try {
      const result =
        await findSmartBoardSession(
          code
        );

      if (!result) {
        throw new Error(
          "No Smart Board found with this pairing code."
        );
      }

      const data =
        result.data;

      state.connected =
        true;

      state.pairingCode =
        code;

      state.sessionPath =
        `smartBoardSessions/${code}`;

      state.connectedAt =
        Date.now();

      state.boardName =
        data.boardName ||
        data.name ||
        "SNK Smart Board";

      state.connectionType =
        "Firebase";

      /*
        The session is valid.

        The current Firebase wrapper does
        not expose update(), so we use set()
        with the existing session data plus
        the controller connection fields.
      */

      const updatedSession = {
        ...data,

        pairingCode:
          data.pairingCode ||
          code,

        connected:
          true,

        controllerConnected:
          true,

        boardOnline:
          true,

        lastActivity:
          Date.now(),

        controllerConnectedAt:
          Date.now()
      };

      const firebase =
        window.SNKFirebase;

      await firebase.set(
        result.sessionRef,
        updatedSession
      );

      saveLocalState();

      updateConnectionUI();

      updateConnectedTime();

      setPairMessage(
        "Connected successfully.",
        "success"
      );

      showToast(
        "Smart Board connected.",
        "success"
      );

      /*
        Notify any local UI components.
      */

      window.dispatchEvent(
        new CustomEvent(
          "SNKControllerConnected",
          {
            detail: {
              code,
              sessionPath:
                state.sessionPath,
              boardName:
                state.boardName
            }
          }
        )
      );

      /*
        Tell the Smart Board that the
        controller is connected.

        This is a command inside the same
        Firebase session.
      */

      await sendCommand(
        "controllerConnected",
        {
          pairingCode: code,
          boardName:
            state.boardName,
          timestamp:
            Date.now()
        },
        {
          count: false,
          silent: true
        }
      );

      return true;
    } catch (error) {
      console.error(
        "Smart Board connection failed:",
        error
      );

      state.connected =
        false;

      state.sessionPath =
        "";

      state.pairingCode =
        "";

      state.connectedAt =
        null;

      updateConnectionUI();

      setPairMessage(
        error.message ||
          "Could not connect to Smart Board.",
        "error"
      );

      showToast(
        error.message ||
          "Could not connect.",
        "error"
      );

      return false;
    } finally {
      if (connectButton) {
        connectButton.disabled =
          false;
      }
    }
  }

  /* =======================================================
     SEND COMMAND TO FIREBASE
     ======================================================= */

  async function sendCommand(
    type,
    payload = {},
    options = {}
  ) {
    const {
      count = true,
      silent = false
    } = options;

    if (!state.connected) {
      if (!silent) {
        showToast(
          "Connect to a Smart Board first.",
          "error"
        );
      }

      return false;
    }

    if (!isFirebaseReady()) {
      if (!silent) {
        showToast(
          "Firebase is not ready.",
          "error"
        );
      }

      return false;
    }

    if (!state.sessionPath) {
      if (!silent) {
        showToast(
          "Smart Board session is missing.",
          "error"
        );
      }

      return false;
    }

    try {
      const firebase =
        window.SNKFirebase;

      const commandsRef =
        firebase.ref(
          firebase.database,
          `${state.sessionPath}/commands`
        );

      const commandRef =
        firebase.push(
          commandsRef
        );

      const commandData = {
        type,

        payload:
          payload || {},

        timestamp:
          Date.now(),

        source:
          "controller"
      };

      await firebase.set(
        commandRef,
        commandData
      );

      if (count) {
        state.commandsSent++;

        updateCommandCounter();
      }

      if (!silent) {
        showToast(
          getCommandLabel(type),
          "success"
        );
      }

      return true;
    } catch (error) {
      console.error(
        "Could not send command:",
        error
      );

      if (!silent) {
        showToast(
          "Command could not be sent.",
          "error"
        );
      }

      return false;
    }
  }

  /* =======================================================
     COMMAND LABELS
     ======================================================= */

  function getCommandLabel(
    type
  ) {
    const labels = {
      undo: "Undo",
      redo: "Redo",
      clear: "Board cleared",
      newBoard: "New board",
      pen: "Pen selected",
      marker: "Marker selected",
      eraser: "Eraser selected",
      zoomIn: "Zoom in",
      zoomOut: "Zoom out",
      zoomReset: "Zoom reset",
      nextPage: "Next page",
      previousPage: "Previous page",
      cameraOn: "Camera on",
      cameraOff: "Camera off",
      startRecording:
        "Recording started",
      stopRecording:
        "Recording stopped"
    };

    return (
      labels[type] ||
      "Command sent"
    );
  }

  /* =======================================================
     BOARD COMMANDS
     ======================================================= */

  function undo() {
    return sendCommand(
      "undo"
    );
  }

  function redo() {
    return sendCommand(
      "redo"
    );
  }

  function clearBoard() {
    return sendCommand(
      "clear"
    );
  }

  function newBoard() {
    return sendCommand(
      "newBoard"
    );
  }

  /* =======================================================
     TOOL COMMANDS
     ======================================================= */

  function setTool(
    tool
  ) {
    const allowed = [
      "pen",
      "marker",
      "eraser"
    ];

    if (
      !allowed.includes(tool)
    ) {
      return false;
    }

    state.tool =
      tool;

    saveLocalState();

    updateToolUI();

    return sendCommand(
      "tool",
      {
        tool
      }
    );
  }

  function updateToolUI() {
    $$(
      "[data-tool], .tool-btn"
    ).forEach(
      (button) => {
        const value =
          button.dataset.tool;

        if (
          value ===
          state.tool
        ) {
          button.classList.add(
            "active"
          );
        } else if (
          button.hasAttribute(
            "data-tool"
          )
        ) {
          button.classList.remove(
            "active"
          );
        }
      }
    );
  }

  /* =======================================================
     COLOR
     ======================================================= */

  function setColor(
    color
  ) {
    if (!color) {
      return false;
    }

    state.color =
      color;

    saveLocalState();

    updateColorUI();

    return sendCommand(
      "color",
      {
        color
      }
    );
  }

  function updateColorUI() {
    $$(
      "[data-color], .color-btn"
    ).forEach(
      (button) => {
        const value =
          button.dataset.color;

        if (
          value &&
          value.toLowerCase() ===
            state.color.toLowerCase()
        ) {
          button.classList.add(
            "active"
          );
        } else if (
          button.hasAttribute(
            "data-color"
          )
        ) {
          button.classList.remove(
            "active"
          );
        }
      }
    );

    const preview =
      $("#colorPreview");

    if (preview) {
      preview.style.background =
        state.color;
    }

    const colorValue =
      $("#colorValue");

    if (colorValue) {
      colorValue.textContent =
        state.color;
    }
  }

  /* =======================================================
     SIZE
     ======================================================= */

  function setSize(
    size
  ) {
    const number =
      Number(size);

    if (
      !Number.isFinite(
        number
      )
    ) {
      return false;
    }

    state.size =
      Math.max(
        1,
        Math.min(
          80,
          number
        )
      );

    saveLocalState();

    updateSizeUI();

    return sendCommand(
      "size",
      {
        size:
          state.size
      }
    );
  }

  function updateSizeUI() {
    const slider =
      $("#sizeSlider");

    if (slider) {
      slider.value =
        state.size;
    }

    const value =
      $("#sizeValue");

    if (value) {
      value.textContent =
        `${state.size}px`;
    }
  }

  /* =======================================================
     ZOOM
     ======================================================= */

  function setZoom(
    zoom
  ) {
    const number =
      Number(zoom);

    if (
      !Number.isFinite(
        number
      )
    ) {
      return false;
    }

    state.zoom =
      Math.max(
        25,
        Math.min(
          300,
          Math.round(number)
        )
      );

    saveLocalState();

    updateZoomUI();

    return sendCommand(
      "zoom",
      {
        zoom:
          state.zoom
      }
    );
  }

  function zoomIn() {
    return setZoom(
      state.zoom + 10
    );
  }

  function zoomOut() {
    return setZoom(
      state.zoom - 10
    );
  }

  function zoomReset() {
    return setZoom(100);
  }

  function updateZoomUI() {
    const value =
      $("#zoomValue") ||
      $("#zoomDisplay");

    if (value) {
      value.textContent =
        `${state.zoom}%`;
    }
  }

  /* =======================================================
     PDF / SLIDES
     ======================================================= */

  function nextPage() {
    state.currentPage++;

    if (
      state.totalPages > 0 &&
      state.currentPage >
        state.totalPages
    ) {
      state.currentPage =
        state.totalPages;
    }

    updatePageUI();

    return sendCommand(
      "nextPage"
    );
  }

  function previousPage() {
    state.currentPage--;

    if (
      state.currentPage < 1
    ) {
      state.currentPage = 1;
    }

    updatePageUI();

    return sendCommand(
      "previousPage"
    );
  }

  function updatePageUI() {
    const pageStatus =
      $("#pageStatus");

    if (pageStatus) {
      pageStatus.textContent =
        state.totalPages > 1
          ? `${state.currentPage} / ${state.totalPages}`
          : String(
              state.currentPage
            );
    }
  }

  /* =======================================================
     CAMERA
     ======================================================= */

  function toggleCamera() {
    state.cameraOn =
      !state.cameraOn;

    const command =
      state.cameraOn
        ? "cameraOn"
        : "cameraOff";

    updateCameraUI();

    return sendCommand(
      command
    );
  }

  function updateCameraUI() {
    const button =
      $("#cameraToggleBtn");

    if (button) {
      button.classList.toggle(
        "active",
        state.cameraOn
      );
    }

    const status =
      $("#cameraStatus");

    if (status) {
      status.textContent =
        state.cameraOn
          ? "On"
          : "Off";
    }
  }

  /* =======================================================
     RECORDING
     ======================================================= */

  function toggleRecording() {
    state.recording =
      !state.recording;

    const command =
      state.recording
        ? "startRecording"
        : "stopRecording";

    updateRecordingUI();

    return sendCommand(
      command
    );
  }

  function updateRecordingUI() {
    const button =
      $("#recordToggleBtn");

    if (button) {
      button.classList.toggle(
        "active",
        state.recording
      );
    }

    const text =
      $("#recordButtonText");

    if (text) {
      text.textContent =
        state.recording
          ? "Stop Recording"
          : "Start Recording";
    }

    const status =
      $("#recordStatus");

    if (status) {
      status.textContent =
        state.recording
          ? "Recording"
          : "Ready";
    }

    const light =
      $("#recordLight");

    if (light) {
      light.classList.toggle(
        "active",
        state.recording
      );
    }
  }

  /* =======================================================
     DISCONNECT
     ======================================================= */

  async function disconnect() {
    if (!state.connected) {
      return;
    }

    try {
      /*
        Update the Firebase session so the
        Smart Board knows the controller
        disconnected.

        We preserve all existing session
        information.
      */

      if (
        isFirebaseReady() &&
        state.sessionPath
      ) {
        const firebase =
          window.SNKFirebase;

        const sessionRef =
          firebase.ref(
            firebase.database,
            state.sessionPath
          );

        await new Promise(
          (resolve) => {
            firebase.onValue(
              sessionRef,
              async (snapshot) => {
                try {
                  const data =
                    snapshot.val();

                  if (data) {
                    await firebase.set(
                      sessionRef,
                      {
                        ...data,

                        connected:
                          false,

                        controllerConnected:
                          false,

                        lastActivity:
                          Date.now(),

                        controllerDisconnectedAt:
                          Date.now()
                      }
                    );
                  }
                } catch (error) {
                  console.warn(
                    "Could not update disconnect state.",
                    error
                  );
                }

                resolve();
              },
              {
                onlyOnce: true
              }
            );
          }
        );
      }
    } catch (error) {
      console.warn(
        "Disconnect update failed:",
        error
      );
    }

    state.connected =
      false;

    state.sessionPath =
      "";

    state.pairingCode =
      "";

    state.connectedAt =
      null;

    state.commandsSent =
      0;

    updateConnectionUI();

    updateCommandCounter();

    setPairMessage(
      "Enter a new pairing code to connect.",
      ""
    );

    showToast(
      "Disconnected.",
      "info"
    );

    window.dispatchEvent(
      new CustomEvent(
        "SNKControllerDisconnected"
      )
    );
  }

  /* =======================================================
     BUTTON BINDINGS
     ======================================================= */

  function bindButtons() {
    /* -----------------------------------------------------
       CONNECT
       ----------------------------------------------------- */

    connectButton?.addEventListener(
      "click",
      () => {
        connect();
      }
    );

    /* -----------------------------------------------------
       PAIRING INPUT
       ----------------------------------------------------- */

    pairCodeInput?.addEventListener(
      "input",
      updatePairInput
    );

    pairCodeInput?.addEventListener(
      "keydown",
      (event) => {
        if (
          event.key === "Enter"
        ) {
          event.preventDefault();

          connect();
        }
      }
    );

    /* -----------------------------------------------------
       BOARD
       ----------------------------------------------------- */

    $("#undoBtn")?.addEventListener(
      "click",
      undo
    );

    $("#redoBtn")?.addEventListener(
      "click",
      redo
    );

    $("#clearBtn")?.addEventListener(
      "click",
      clearBoard
    );

    $("#newBoardBtn")?.addEventListener(
      "click",
      newBoard
    );

    /* -----------------------------------------------------
       TOOLS
       ----------------------------------------------------- */

    $$("[data-tool]").forEach(
      (button) => {
        button.addEventListener(
          "click",
          () => {
            setTool(
              button.dataset.tool
            );
          }
        );
      }
    );

    $("#penBtn")?.addEventListener(
      "click",
      () => setTool("pen")
    );

    $("#markerBtn")?.addEventListener(
      "click",
      () => setTool("marker")
    );

    $("#eraserBtn")?.addEventListener(
      "click",
      () => setTool("eraser")
    );

    /* -----------------------------------------------------
       COLORS
       ----------------------------------------------------- */

    $$(".color-btn").forEach(
      (button) => {
        button.addEventListener(
          "click",
          () => {
            const color =
              button.dataset.color;

            if (color) {
              setColor(color);
            }
          }
        );
      }
    );

    /* -----------------------------------------------------
       SIZE
       ----------------------------------------------------- */

    $("#sizeSlider")?.addEventListener(
      "input",
      (event) => {
        setSize(
          event.target.value
        );
      }
    );

    /* -----------------------------------------------------
       ZOOM
       ----------------------------------------------------- */

    $("#zoomOutBtn")?.addEventListener(
      "click",
      zoomOut
    );

    $("#zoomResetBtn")?.addEventListener(
      "click",
      zoomReset
    );

    $("#zoomInBtn")?.addEventListener(
      "click",
      zoomIn
    );

    /* -----------------------------------------------------
       PDF
       ----------------------------------------------------- */

    $("#previousPageBtn")?.addEventListener(
      "click",
      previousPage
    );

    $("#nextPageBtn")?.addEventListener(
      "click",
      nextPage
    );

    /* -----------------------------------------------------
       CAMERA
       ----------------------------------------------------- */

    $("#cameraToggleBtn")?.addEventListener(
      "click",
      toggleCamera
    );

    /* -----------------------------------------------------
       RECORDING
       ----------------------------------------------------- */

    $("#recordToggleBtn")?.addEventListener(
      "click",
      toggleRecording
    );

    /* -----------------------------------------------------
       DISCONNECT
       ----------------------------------------------------- */

    $("#disconnectBtnBottom")?.addEventListener(
      "click",
      disconnect
    );
  }

  /* =======================================================
     KEYBOARD
     ======================================================= */

  function bindKeyboard() {
    document.addEventListener(
      "keydown",
      (event) => {
        const target =
          event.target;

        if (
          target &&
          (
            target.tagName ===
              "INPUT" ||
            target.tagName ===
              "TEXTAREA" ||
            target.isContentEditable
          )
        ) {
          return;
        }

        if (
          (event.ctrlKey ||
            event.metaKey) &&
          event.key.toLowerCase() ===
            "z"
        ) {
          event.preventDefault();

          undo();

          return;
        }

        if (
          (event.ctrlKey ||
            event.metaKey) &&
          event.key.toLowerCase() ===
            "y"
        ) {
          event.preventDefault();

          redo();

          return;
        }

        if (
          event.key.toLowerCase() ===
          "p"
        ) {
          setTool("pen");
        }

        if (
          event.key.toLowerCase() ===
          "m"
        ) {
          setTool("marker");
        }

        if (
          event.key.toLowerCase() ===
          "e"
        ) {
          setTool("eraser");
        }

        if (
          event.key === "+"
        ) {
          zoomIn();
        }

        if (
          event.key === "-"
        ) {
          zoomOut();
        }

        if (
          event.key === "0"
        ) {
          zoomReset();
        }
      }
    );
  }

  /* =======================================================
     FIREBASE READY EVENT
     ======================================================= */

  function handleFirebaseReady() {
    state.firebaseReady =
      true;

    console.log(
      "SNK Controller Firebase ready."
    );

    updateConnectionUI();

    setPairMessage(
      "Enter the 6-digit Smart Board code.",
      ""
    );
  }

  /* =======================================================
     INITIALIZE
     ======================================================= */

  function initialize() {
    loadLocalState();

    bindButtons();

    bindKeyboard();

    updateConnectionUI();

    updateCommandCounter();

    updateToolUI();

    updateColorUI();

    updateSizeUI();

    updateZoomUI();

    updatePageUI();

    updateCameraUI();

    updateRecordingUI();

    if (
      isFirebaseReady()
    ) {
      handleFirebaseReady();
    } else {
      setPairMessage(
        "Connecting to Firebase...",
        "loading"
      );
    }

    console.log(
      "SNK Smart Board Controller initialized."
    );
  }

  /* =======================================================
     FIREBASE READY LISTENER
     ======================================================= */

  window.addEventListener(
    "SNKFirebaseReady",
    handleFirebaseReady
  );

  /* =======================================================
     START
     ======================================================= */

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      initialize,
      {
        once: true
      }
    );
  } else {
    initialize();
  }

  /* =======================================================
     PUBLIC API
     ======================================================= */

  window.SNKSmartBoardController = {
    getState() {
      return {
        ...state
      };
    },

    connect,

    disconnect,

    send: sendCommand,

    sendCommand,

    undo,

    redo,

    clearBoard,

    newBoard,

    setTool,

    setColor,

    setSize,

    setZoom,

    zoomIn,

    zoomOut,

    zoomReset,

    nextPage,

    previousPage,

    toggleCamera,

    toggleRecording
  };
})();
