/* =========================================================
   SNK SMART BOARD
   WIRELESS CONTROLLER
   CONTROLLER.JS
   ========================================================= */

(() => {
  "use strict";

  /* =======================================================
     CONFIG
  ======================================================= */

  const CONFIG = {
    storageKey: "snkSmartBoardController",
    pairingKey: "snkSmartBoardPairing",
    demoMode: true,

    /*
      Firebase integration can be connected later.

      The controller currently creates and stores the
      pairing session locally so the complete UI can be
      tested before Firebase is connected.
    */
  };


  /* =======================================================
     STATE
  ======================================================= */

  const state = {
    connected: false,

    pairingCode: "",

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


  /* =======================================================
     DOM HELPER
  ======================================================= */

  const $ = (selector) => {
    return document.querySelector(selector);
  };

  const $$ = (selector) => {
    return Array.from(
      document.querySelectorAll(selector)
    );
  };


  /* =======================================================
     DOM REFERENCES
  ======================================================= */

  const elements = {
    pairCard: $("#pairCard"),

    pairCode: $("#pairCode"),

    connectBtn: $("#connectBtn"),

    pairMessage: $("#pairMessage"),

    controller: $("#controller"),

    connectionStatus: $("#connectionStatus"),

    connectionText: $("#connectionText"),

    toast: $("#toast"),

    undoBtn: $("#undoBtn"),

    redoBtn: $("#redoBtn"),

    clearBtn: $("#clearBtn"),

    newBoardBtn: $("#newBoardBtn"),

    penBtn: $("#penBtn"),

    markerBtn: $("#markerBtn"),

    eraserBtn: $("#eraserBtn"),

    colorPreview: $("#colorPreview"),

    colorButtons: $$(".color-btn"),

    sizeSlider: $("#sizeSlider"),

    sizeValue: $("#sizeValue"),

    zoomOutBtn: $("#zoomOutBtn"),

    zoomResetBtn: $("#zoomResetBtn"),

    zoomInBtn: $("#zoomInBtn"),

    zoomValue: $("#zoomValue"),

    previousPageBtn: $("#previousPageBtn"),

    nextPageBtn: $("#nextPageBtn"),

    pageStatus: $("#pageStatus"),

    cameraToggleBtn: $("#cameraToggleBtn"),

    cameraStatus: $("#cameraStatus"),

    recordToggleBtn: $("#recordToggleBtn"),

    recordButtonText: $("#recordButtonText"),

    recordStatus: $("#recordStatus"),

    recordLight: $("#recordLight"),

    disconnectBtn: $("#disconnectBtn")
  };


  /* =======================================================
     STORAGE
  ======================================================= */

  function saveState() {
    try {
      localStorage.setItem(
        CONFIG.storageKey,
        JSON.stringify({
          tool: state.tool,
          color: state.color,
          size: state.size,
          zoom: state.zoom
        })
      );
    } catch (error) {
      console.warn(
        "Unable to save controller state.",
        error
      );
    }
  }


  function loadState() {
    try {
      const saved = JSON.parse(
        localStorage.getItem(CONFIG.storageKey)
      );

      if (!saved) {
        return;
      }

      if (typeof saved.tool === "string") {
        state.tool = saved.tool;
      }

      if (typeof saved.color === "string") {
        state.color = saved.color;
      }

      if (Number.isFinite(saved.size)) {
        state.size = Math.max(
          1,
          Math.min(40, saved.size)
        );
      }

      if (Number.isFinite(saved.zoom)) {
        state.zoom = Math.max(
          50,
          Math.min(200, saved.zoom)
        );
      }

    } catch (error) {
      console.warn(
        "Unable to load controller state.",
        error
      );
    }
  }


  /* =======================================================
     TOAST
  ======================================================= */

  let toastTimer = null;

  function showToast(message) {
    if (!elements.toast) {
      return;
    }

    elements.toast.textContent = message;

    elements.toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
      elements.toast.classList.remove("show");
    }, 2200);
  }


  /* =======================================================
     PAIRING CODE
  ======================================================= */

  function normalizeCode(value) {
    return String(value || "")
      .replace(/\D/g, "")
      .slice(0, 6);
  }


  function generatePairingCode() {
    return String(
      Math.floor(
        100000 +
        Math.random() * 900000
      )
    );
  }


  function validatePairingCode(code) {
    return /^\d{6}$/.test(code);
  }


  /* =======================================================
     CONNECTION UI
  ======================================================= */

  function setConnectionUI(connected) {
    state.connected = connected;

    if (connected) {

      elements.connectionStatus?.classList.add(
        "connected"
      );

      if (elements.connectionText) {
        elements.connectionText.textContent =
          "Connected";
      }

      if (elements.pairCard) {
        elements.pairCard.style.display = "none";
      }

      if (elements.controller) {
        elements.controller.hidden = false;
      }

    } else {

      elements.connectionStatus?.classList.remove(
        "connected"
      );

      if (elements.connectionText) {
        elements.connectionText.textContent =
          "Not Connected";
      }

      if (elements.pairCard) {
        elements.pairCard.style.display = "";
      }

      if (elements.controller) {
        elements.controller.hidden = true;
      }
    }
  }


  /* =======================================================
     PAIR MESSAGE
  ======================================================= */

  function setPairMessage(
    message,
    type = ""
  ) {
    if (!elements.pairMessage) {
      return;
    }

    elements.pairMessage.textContent = message;

    elements.pairMessage.classList.remove(
      "success",
      "error"
    );

    if (type) {
      elements.pairMessage.classList.add(type);
    }
  }


  /* =======================================================
     PAIRING
  ======================================================= */

  function connectToBoard() {

    const code = normalizeCode(
      elements.pairCode?.value
    );

    if (elements.pairCode) {
      elements.pairCode.value = code;
    }

    if (!validatePairingCode(code)) {

      setPairMessage(
        "Please enter a valid 6-digit pairing code.",
        "error"
      );

      showToast(
        "Enter a 6-digit pairing code."
      );

      elements.pairCode?.focus();

      return;
    }


    state.pairingCode = code;

    state.connectedAt =
      new Date().toISOString();


    /*
      Store pairing information.

      This allows the controller UI to work
      before realtime Firebase integration.
    */

    try {

      localStorage.setItem(
        CONFIG.pairingKey,
        JSON.stringify({
          code,
          connectedAt: state.connectedAt
        })
      );

    } catch (error) {

      console.warn(
        "Unable to save pairing state.",
        error
      );
    }


    setPairMessage(
      "Connected successfully.",
      "success"
    );

    setConnectionUI(true);

    showToast(
      `Connected to board #${code}`
    );


    sendCommand(
      "controller_connected",
      {
        pairingCode: code
      },
      false
    );
  }


  /* =======================================================
     DISCONNECT
  ======================================================= */

  function disconnect() {

    if (
      state.recording
    ) {
      state.recording = false;
      updateRecordingUI();
    }

    sendCommand(
      "controller_disconnected",
      {},
      false
    );

    state.connected = false;
    state.pairingCode = "";
    state.connectedAt = null;

    try {
      localStorage.removeItem(
        CONFIG.pairingKey
      );
    } catch (error) {
      console.warn(error);
    }

    setConnectionUI(false);

    setPairMessage(
      "Disconnected. Enter a pairing code to connect again."
    );

    showToast(
      "Disconnected from Smart Board."
    );
  }


  /* =======================================================
     COMMAND DISPATCH
  ======================================================= */

  function sendCommand(
    type,
    payload = {},
    requireConnection = true
  ) {

    if (
      requireConnection &&
      !state.connected
    ) {
      showToast(
        "Connect to a Smart Board first."
      );

      return false;
    }


    const command = {
      id:
        `cmd_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 8)}`,

      type,

      payload,

      pairingCode:
        state.pairingCode || null,

      timestamp:
        Date.now()
    };


    state.commandsSent += 1;


    /*
      Local event bridge.

      The main Smart Board can listen for this
      event when both pages are running in a
      compatible environment.
    */

    try {

      window.dispatchEvent(
        new CustomEvent(
          "SNKSmartBoardCommand",
          {
            detail: command
          }
        )
      );

    } catch (error) {
      console.warn(
        "Local command dispatch failed.",
        error
      );
    }


    /*
      Save the latest command.

      This is useful for demo/testing and can later
      be replaced by Firebase realtime writes.
    */

    try {

      localStorage.setItem(
        "snkSmartBoardLastCommand",
        JSON.stringify(command)
      );

    } catch (error) {
      console.warn(
        "Unable to save command.",
        error
      );
    }


    /*
      Optional global hook.

      If another script defines:

        window.SNKSmartBoardController.send

      it will receive the command.
    */

    if (
      window.SNKSmartBoardController &&
      typeof
        window.SNKSmartBoardController.send ===
        "function"
    ) {

      try {

        window.SNKSmartBoardController.send(
          command
        );

      } catch (error) {

        console.warn(
          "Controller bridge failed.",
          error
        );
      }
    }


    return true;
  }


  /* =======================================================
     BOARD ACTION
  ======================================================= */

  function boardAction(action) {

    const success = sendCommand(
      action,
      {}
    );

    if (!success) {
      return;
    }

    const messages = {
      undo: "Undo sent",
      redo: "Redo sent",
      clear: "Clear command sent",
      new: "New board command sent"
    };

    showToast(
      messages[action] ||
      "Command sent."
    );
  }


  /* =======================================================
     TOOL
  ======================================================= */

  function setTool(tool) {

    const validTools = [
      "pen",
      "marker",
      "eraser"
    ];

    if (!validTools.includes(tool)) {
      return;
    }

    state.tool = tool;

    $$(".tool-btn").forEach(
      (button) => {

        button.classList.toggle(
          "active",
          button.dataset.tool === tool
        );

      }
    );


    saveState();


    sendCommand(
      "tool",
      {
        tool
      }
    );


    const names = {
      pen: "Pen",
      marker: "Marker",
      eraser: "Eraser"
    };

    showToast(
      `${names[tool]} selected`
    );
  }


  /* =======================================================
     COLOR
  ======================================================= */

  function setColor(color) {

    if (!color) {
      return;
    }

    state.color = color;


    elements.colorButtons.forEach(
      (button) => {

        button.classList.toggle(
          "active",
          button.dataset.color === color
        );

      }
    );


    if (elements.colorPreview) {
      elements.colorPreview.style.background =
        color;
    }


    saveState();


    sendCommand(
      "color",
      {
        color
      }
    );


    showToast(
      "Pen color updated."
    );
  }


  /* =======================================================
     SIZE
  ======================================================= */

  function setSize(value) {

    const size = Math.max(
      1,
      Math.min(
        40,
        Number(value) || 1
      )
    );

    state.size = size;


    if (elements.sizeSlider) {
      elements.sizeSlider.value = size;
    }

    if (elements.sizeValue) {
      elements.sizeValue.textContent =
        `${size} px`;
    }


    saveState();


    sendCommand(
      "size",
      {
        size
      }
    );
  }


  /* =======================================================
     ZOOM
  ======================================================= */

  function setZoom(
    value,
    send = true
  ) {

    const zoom = Math.max(
      50,
      Math.min(
        200,
        Math.round(value / 10) * 10
      )
    );

    state.zoom = zoom;


    if (elements.zoomValue) {
      elements.zoomValue.textContent =
        `${zoom}%`;
    }


    if (elements.zoomResetBtn) {
      elements.zoomResetBtn.textContent =
        `${zoom}%`;
    }


    saveState();


    if (send) {

      sendCommand(
        "zoom",
        {
          zoom
        }
      );

    }
  }


  function zoomIn() {

    setZoom(
      state.zoom + 10
    );

    showToast(
      `Zoom ${state.zoom}%`
    );
  }


  function zoomOut() {

    setZoom(
      state.zoom - 10
    );

    showToast(
      `Zoom ${state.zoom}%`
    );
  }


  function resetZoom() {

    setZoom(100);

    showToast(
      "Zoom reset to 100%"
    );
  }


  /* =======================================================
     PDF / SLIDES
  ======================================================= */

  function updatePageUI() {

    if (elements.pageStatus) {

      elements.pageStatus.textContent =
        `Page ${state.currentPage}` +
        (
          state.totalPages > 1
            ? ` / ${state.totalPages}`
            : ""
        );

    }
  }


  function previousPage() {

    if (
      state.currentPage <= 1
    ) {

      showToast(
        "Already on the first page."
      );

      return;
    }


    state.currentPage -= 1;

    updatePageUI();


    sendCommand(
      "previous_page",
      {
        page: state.currentPage
      }
    );


    showToast(
      `Page ${state.currentPage}`
    );
  }


  function nextPage() {

    if (
      state.currentPage >=
      state.totalPages
    ) {

      /*
        If the total number of pages is not known,
        continue sending the next command.
      */

      if (
        state.totalPages === 1
      ) {

        state.currentPage += 1;

      } else {

        showToast(
          "Already on the last page."
        );

        return;
      }

    } else {

      state.currentPage += 1;
    }


    updatePageUI();


    sendCommand(
      "next_page",
      {
        page: state.currentPage
      }
    );


    showToast(
      `Page ${state.currentPage}`
    );
  }


  /* =======================================================
     CAMERA
  ======================================================= */

  function toggleCamera() {

    state.cameraOn =
      !state.cameraOn;


    sendCommand(
      "camera",
      {
        enabled:
          state.cameraOn
      }
    );


    updateCameraUI();


    showToast(
      state.cameraOn
        ? "Camera ON command sent."
        : "Camera OFF command sent."
    );
  }


  function updateCameraUI() {

    if (elements.cameraStatus) {

      elements.cameraStatus.textContent =
        state.cameraOn
          ? "Camera On"
          : "Camera Off";

    }


    if (elements.cameraToggleBtn) {

      elements.cameraToggleBtn.textContent =
        state.cameraOn
          ? "🎥 Camera Off"
          : "🎥 Camera On";

      elements.cameraToggleBtn.classList.toggle(
        "active",
        state.cameraOn
      );

    }
  }


  /* =======================================================
     RECORDING
  ======================================================= */

  function toggleRecording() {

    state.recording =
      !state.recording;


    sendCommand(
      "recording",
      {
        recording:
          state.recording
      }
    );


    updateRecordingUI();


    showToast(
      state.recording
        ? "Recording start command sent."
        : "Recording stop command sent."
    );
  }


  function updateRecordingUI() {

    if (elements.recordStatus) {

      elements.recordStatus.textContent =
        state.recording
          ? "Recording"
          : "Not Recording";

    }


    if (elements.recordLight) {

      elements.recordLight.classList.toggle(
        "active",
        state.recording
      );

    }


    if (elements.recordToggleBtn) {

      elements.recordToggleBtn.classList.toggle(
        "recording",
        state.recording
      );

    }


    if (elements.recordButtonText) {

      elements.recordButtonText.textContent =
        state.recording
          ? "Stop Recording"
          : "Start Recording";

    }
  }


  /* =======================================================
     KEYBOARD
  ======================================================= */

  function handleKeyboard(event) {

    const target =
      event.target;

    const isInput =
      target &&
      (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT"
      );


    if (isInput) {
      return;
    }


    if (
      (event.ctrlKey || event.metaKey) &&
      event.key.toLowerCase() === "z"
    ) {

      event.preventDefault();

      boardAction(
        event.shiftKey
          ? "redo"
          : "undo"
      );

      return;
    }


    if (
      event.key === "+"
    ) {

      zoomIn();

      return;
    }


    if (
      event.key === "-"
    ) {

      zoomOut();

      return;
    }


    if (
      event.key === "0"
    ) {

      resetZoom();

      return;
    }


    if (
      event.key === "ArrowLeft"
    ) {

      previousPage();

      return;
    }


    if (
      event.key === "ArrowRight"
    ) {

      nextPage();

      return;
    }
  }


  /* =======================================================
     PAIR CODE INPUT
  ======================================================= */

  function handlePairInput() {

    if (!elements.pairCode) {
      return;
    }

    elements.pairCode.value =
      normalizeCode(
        elements.pairCode.value
      );
  }


  function handlePairKeydown(event) {

    if (
      event.key === "Enter"
    ) {

      event.preventDefault();

      connectToBoard();
    }
  }


  /* =======================================================
     BUTTON BINDINGS
  ======================================================= */

  function bindEvents() {

    /* Pairing */

    elements.connectBtn?.addEventListener(
      "click",
      connectToBoard
    );


    elements.pairCode?.addEventListener(
      "input",
      handlePairInput
    );


    elements.pairCode?.addEventListener(
      "keydown",
      handlePairKeydown
    );


    /* Board */

    elements.undoBtn?.addEventListener(
      "click",
      () => boardAction("undo")
    );

    elements.redoBtn?.addEventListener(
      "click",
      () => boardAction("redo")
    );

    elements.clearBtn?.addEventListener(
      "click",
      () => boardAction("clear")
    );

    elements.newBoardBtn?.addEventListener(
      "click",
      () => boardAction("new")
    );


    /* Tools */

    elements.penBtn?.addEventListener(
      "click",
      () => setTool("pen")
    );

    elements.markerBtn?.addEventListener(
      "click",
      () => setTool("marker")
    );

    elements.eraserBtn?.addEventListener(
      "click",
      () => setTool("eraser")
    );


    /* Colors */

    elements.colorButtons.forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            setColor(
              button.dataset.color
            );

          }
        );

      }
    );


    /* Size */

    elements.sizeSlider?.addEventListener(
      "input",
      (event) => {

        setSize(
          event.target.value
        );

      }
    );


    /* Zoom */

    elements.zoomInBtn?.addEventListener(
      "click",
      zoomIn
    );

    elements.zoomOutBtn?.addEventListener(
      "click",
      zoomOut
    );

    elements.zoomResetBtn?.addEventListener(
      "click",
      resetZoom
    );


    /* PDF */

    elements.previousPageBtn?.addEventListener(
      "click",
      previousPage
    );

    elements.nextPageBtn?.addEventListener(
      "click",
      nextPage
    );


    /* Camera */

    elements.cameraToggleBtn?.addEventListener(
      "click",
      toggleCamera
    );


    /* Recording */

    elements.recordToggleBtn?.addEventListener(
      "click",
      toggleRecording
    );


    /* Disconnect */

    elements.disconnectBtn?.addEventListener(
      "click",
      disconnect
    );


    /* Keyboard */

    document.addEventListener(
      "keydown",
      handleKeyboard
    );
  }


  /* =======================================================
     RESTORE UI
  ======================================================= */

  function restoreUI() {

    setTool(
      state.tool
    );


    /*
      setTool sends a command, so we do not want
      a command during initial page restoration.
      Therefore manually update active state again.
    */

    $$(".tool-btn").forEach(
      (button) => {

        button.classList.toggle(
          "active",
          button.dataset.tool === state.tool
        );

      }
    );


    elements.colorButtons.forEach(
      (button) => {

        button.classList.toggle(
          "active",
          button.dataset.color === state.color
        );

      }
    );


    if (elements.colorPreview) {
      elements.colorPreview.style.background =
        state.color;
    }


    if (elements.sizeSlider) {
      elements.sizeSlider.value =
        state.size;
    }

    if (elements.sizeValue) {
      elements.sizeValue.textContent =
        `${state.size} px`;
    }


    setZoom(
      state.zoom,
      false
    );


    updatePageUI();

    updateCameraUI();

    updateRecordingUI();
  }


  /* =======================================================
     RESTORE PREVIOUS PAIRING
  ======================================================= */

  function restorePairing() {

    try {

      const saved =
        JSON.parse(
          localStorage.getItem(
            CONFIG.pairingKey
          )
        );


      if (
        saved &&
        validatePairingCode(
          saved.code
        )
      ) {

        /*
          We intentionally do not automatically
          connect to a live board.

          The saved code is placed into the field
          for convenience.
        */

        if (elements.pairCode) {

          elements.pairCode.value =
            saved.code;

        }

        setPairMessage(
          "Previous pairing code restored. Press Connect to reconnect."
        );
      }

    } catch (error) {

      console.warn(
        "Unable to restore pairing.",
        error
      );
    }
  }


  /* =======================================================
     PUBLIC CONTROLLER API
  ======================================================= */

  window.SNKSmartBoardController = {

    getState() {
      return {
        ...state
      };
    },

    connect(code) {

      if (elements.pairCode) {
        elements.pairCode.value =
          normalizeCode(code);
      }

      connectToBoard();
    },

    disconnect,

    send(command) {

      if (!command) {
        return false;
      }

      return sendCommand(
        command.type ||
          command.action ||
          "custom",
        command.payload ||
          {}
      );
    },

    setTool,

    setColor,

    setSize,

    setZoom,

    nextPage,

    previousPage,

    toggleCamera,

    toggleRecording
  };


  /* =======================================================
     INIT
  ======================================================= */

  function init() {

    loadState();

    bindEvents();

    restoreUI();

    restorePairing();

    setConnectionUI(false);


    /*
      Generate a demo code only when no code
      has previously been entered.
    */

    if (
      !elements.pairCode?.value
    ) {

      const demoCode =
        generatePairingCode();

      /*
        The generated code is NOT a real
        Firebase pairing session yet.
        It is only useful for UI testing.
      */

      if (
        CONFIG.demoMode
      ) {

        elements.pairCode.value =
          demoCode;

      }
    }


    console.log(
      "SNK Smart Board Controller initialized."
    );
  }


  /* =======================================================
     START
  ======================================================= */

  if (
    document.readyState === "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      init,
      {
        once: true
      }
    );

  } else {

    init();
  }

})();
