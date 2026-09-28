/* =========================================================
   SNK SMART BOARD
   WIRELESS CONTROLLER
   STEP 11.2.5
   PDF / PAGE / ZOOM / CAMERA / RECORDING CONTROL
   ========================================================= */

"use strict";

/* =========================================================
   STATE
   ========================================================= */

const controllerState = {
  connected: false,
  sessionCode: "",
  tool: "pen",
  color: "#1e88ff",
  size: 4,

  page: 1,
  totalPages: 1,

  zoom: 100,

  camera: false,
  recording: false,

  mirror: false,

  pointBuffer: [],
  flushTimer: null,

  lastPointerTime: 0,

  device: "Unknown"
};


/* =========================================================
   ELEMENTS
   ========================================================= */

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];


/* =========================================================
   TOAST
   ========================================================= */

function showToast(message) {

  const toast = $("#toast");

  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 1800);
}


/* =========================================================
   FIREBASE
   ========================================================= */

function getFirebase() {

  if (window.SNKFirebase) {
    return window.SNKFirebase;
  }

  return null;
}


/* =========================================================
   SESSION PATH
   ========================================================= */

function getSessionPath() {

  if (
    window.SNKSmartBoardPairing &&
    window.SNKSmartBoardPairing.state &&
    window.SNKSmartBoardPairing.state.sessionPath
  ) {

    return window.SNKSmartBoardPairing.state.sessionPath;
  }

  if (!controllerState.sessionCode) {
    return "";
  }

  return `smartBoardSessions/${controllerState.sessionCode}`;
}


/* =========================================================
   DATABASE REFERENCE
   ========================================================= */

function getDatabaseReference(path = "") {

  const firebase = getFirebase();

  if (!firebase) {
    return null;
  }

  try {

    if (firebase.ref) {
      return firebase.ref(path);
    }

    if (
      firebase.database &&
      typeof firebase.database.ref === "function"
    ) {
      return firebase.database.ref(path);
    }

  } catch (error) {

    console.error("Firebase reference error:", error);
  }

  return null;
}


/* =========================================================
   SEND COMMAND
   ========================================================= */

async function sendCommand(type, payload = {}) {

  if (!controllerState.connected) {

    showToast("Laptop connected নেই");

    return false;
  }

  const sessionPath = getSessionPath();

  if (!sessionPath) {

    showToast("Session পাওয়া যায়নি");

    return false;
  }

  const firebase = getFirebase();

  if (!firebase) {

    showToast("Firebase connection নেই");

    console.error("SNKFirebase not found.");

    return false;
  }

  const commandId =
    `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const command = {

    id: commandId,

    type,

    payload,

    device: "tablet",

    timestamp: Date.now()

  };

  try {

    const commandRef =
      getDatabaseReference(
        `${sessionPath}/commands/${commandId}`
      );

    if (!commandRef) {

      showToast("Command path পাওয়া যায়নি");

      return false;
    }

    await commandRef.set(command);

    return true;

  } catch (error) {

    console.error("Command send error:", error);

    showToast("Command পাঠানো যায়নি");

    return false;
  }
}


/* =========================================================
   CONNECT
   ========================================================= */

async function connectController() {

  const input =
    $("#sessionCode") ||
    $("#pairCode") ||
    $("#connectionCode");

  let code = input ? input.value.trim() : "";

  if (!code) {

    code =
      window.prompt(
        "Laptop-এর 6 digit pairing code দিন:"
      ) || "";
  }

  code = code.replace(/\D/g, "").slice(0, 6);

  if (code.length !== 6) {

    showToast("6 digit pairing code দিন");

    return;
  }

  controllerState.sessionCode = code;

  const sessionPath =
    `smartBoardSessions/${code}`;

  const sessionRef =
    getDatabaseReference(sessionPath);

  if (!sessionRef) {

    showToast("Firebase প্রস্তুত নয়");

    return;
  }

  try {

    const snapshot = await sessionRef.get();

    if (!snapshot.exists()) {

      showToast("এই pairing code পাওয়া যায়নি");

      return;
    }

    const session = snapshot.val();

    if (session.laptopConnected !== true) {

      showToast("Laptop এখনো connected নয়");

      return;
    }

    controllerState.connected = true;

    updateConnectionUI(true);

    await sessionRef.update({

      controllerConnected: true,

      controllerLastSeen: Date.now()

    });

    showToast("Laptop connected ✓");

    startHeartbeat();

  } catch (error) {

    console.error(error);

    showToast("Connection failed");
  }
}


/* =========================================================
   DISCONNECT
   ========================================================= */

async function disconnectController() {

  controllerState.connected = false;

  stopHeartbeat();

  updateConnectionUI(false);

  const sessionPath = getSessionPath();

  if (sessionPath) {

    const sessionRef =
      getDatabaseReference(sessionPath);

    if (sessionRef) {

      try {

        await sessionRef.update({

          controllerConnected: false,

          controllerLastSeen: Date.now()

        });

      } catch (error) {

        console.warn(error);
      }
    }
  }

  showToast("Disconnected");
}


/* =========================================================
   CONNECTION UI
   ========================================================= */

function updateConnectionUI(connected) {

  const status =
    $("#connectionStatus") ||
    $(".connection-status");

  const button =
    $("#connectBtn") ||
    $("#connectButton");

  if (status) {

    status.textContent =
      connected
        ? "Connected"
        : "Disconnected";

    status.classList.toggle(
      "connected",
      connected
    );

    status.classList.toggle(
      "offline",
      !connected
    );
  }

  if (button) {

    button.textContent =
      connected
        ? "Disconnect"
        : "Connect";
  }
}


/* =========================================================
   CONNECT BUTTON
   ========================================================= */

function handleConnectButton() {

  if (controllerState.connected) {

    disconnectController();

  } else {

    connectController();
  }
}


/* =========================================================
   HEARTBEAT
   ========================================================= */

let heartbeatTimer = null;

function startHeartbeat() {

  stopHeartbeat();

  heartbeatTimer =
    setInterval(async () => {

      if (!controllerState.connected) return;

      const sessionPath = getSessionPath();

      if (!sessionPath) return;

      const sessionRef =
        getDatabaseReference(sessionPath);

      if (!sessionRef) return;

      try {

        await sessionRef.update({

          controllerConnected: true,

          controllerLastSeen: Date.now()

        });

      } catch (error) {

        console.warn("Heartbeat failed:", error);
      }

    }, 5000);
}


function stopHeartbeat() {

  if (heartbeatTimer) {

    clearInterval(heartbeatTimer);

    heartbeatTimer = null;
  }
}


/* =========================================================
   TOOL CONTROL
   ========================================================= */

function setTool(tool) {

  controllerState.tool = tool;

  sendCommand(
    "tool",
    {
      tool
    }
  );

  updateActiveTool();

  showToast(
    `Tool: ${tool}`
  );
}


function updateActiveTool() {

  $$("[data-tool]").forEach(button => {

    const active =
      button.dataset.tool ===
      controllerState.tool;

    button.classList.toggle(
      "active",
      active
    );

  });
}


/* =========================================================
   COLOR CONTROL
   ========================================================= */

function setColor(color) {

  controllerState.color = color;

  sendCommand(
    "color",
    {
      color
    }
  );

  $$("[data-color]").forEach(button => {

    button.classList.toggle(
      "active",
      button.dataset.color === color
    );

  });
}


/* =========================================================
   SIZE CONTROL
   ========================================================= */

function setSize(size) {

  controllerState.size =
    Number(size) || 4;

  sendCommand(
    "size",
    {
      size: controllerState.size
    }
  );

  const value =
    $("#brushSizeValue");

  if (value) {

    value.textContent =
      `${controllerState.size}px`;
  }
}


/* =========================================================
   GENERIC COMMAND
   ========================================================= */

function command(type, payload = {}) {

  sendCommand(
    type,
    payload
  );
}


/* =========================================================
   PAGE CONTROL
   ========================================================= */

function previousPage() {

  command("previousPage");

  if (controllerState.page > 1) {

    controllerState.page--;
  }

  updatePageUI();
}


function nextPage() {

  command("nextPage");

  controllerState.page++;

  updatePageUI();
}


function addPage() {

  command("new");

  controllerState.page++;

  controllerState.totalPages =
    Math.max(
      controllerState.totalPages,
      controllerState.page
    );

  updatePageUI();
}


function deletePage() {

  command("deletePage");

  if (controllerState.page > 1) {

    controllerState.page--;
  }

  updatePageUI();
}


function updatePageUI() {

  const pageNumber =
    $("#pageNumber");

  const totalPages =
    $("#totalPages");

  if (pageNumber) {

    pageNumber.textContent =
      controllerState.page;
  }

  if (totalPages) {

    totalPages.textContent =
      controllerState.totalPages;
  }
}


/* =========================================================
   PDF / SLIDE CONTROL
   ========================================================= */

function previousSlide() {

  command("previousSlide");

  showToast("Previous PDF/Slide");
}


function nextSlide() {

  command("nextSlide");

  showToast("Next PDF/Slide");
}


function openPDF() {

  const input =
    $("#pdfInput");

  if (input) {

    input.click();

    return;
  }

  command("openPDF");

  showToast("Open PDF");
}


/* =========================================================
   ZOOM
   ========================================================= */

function zoomIn() {

  command("zoomIn");

  controllerState.zoom += 10;

  controllerState.zoom =
    Math.min(
      controllerState.zoom,
      300
    );

  updateZoomUI();
}


function zoomOut() {

  command("zoomOut");

  controllerState.zoom -= 10;

  controllerState.zoom =
    Math.max(
      controllerState.zoom,
      30
    );

  updateZoomUI();
}


function resetZoom() {

  command(
    "zoomReset"
  );

  controllerState.zoom = 100;

  updateZoomUI();
}


function updateZoomUI() {

  const zoomValue =
    $("#zoomValue");

  if (zoomValue) {

    zoomValue.textContent =
      `${controllerState.zoom}%`;
  }
}


/* =========================================================
   CAMERA CONTROL
   ========================================================= */

function cameraOn() {

  controllerState.camera = true;

  command(
    "cameraOn"
  );

  updateCameraUI();

  showToast("Camera ON");
}


function cameraOff() {

  controllerState.camera = false;

  command(
    "cameraOff"
  );

  updateCameraUI();

  showToast("Camera OFF");
}


function toggleCamera() {

  if (controllerState.camera) {

    cameraOff();

  } else {

    cameraOn();
  }
}


function toggleMirror() {

  controllerState.mirror =
    !controllerState.mirror;

  command(
    "cameraMirror",
    {
      enabled:
        controllerState.mirror
    }
  );

  updateCameraUI();

  showToast(
    controllerState.mirror
      ? "Mirror ON"
      : "Mirror OFF"
  );
}


function cameraMove(direction) {

  command(
    "cameraMove",
    {
      direction
    }
  );
}


function cameraResize(action) {

  command(
    "cameraResize",
    {
      action
    }
  );
}


function updateCameraUI() {

  const cameraStatus =
    $("#cameraStatus");

  if (cameraStatus) {

    cameraStatus.textContent =
      controllerState.camera
        ? "ON"
        : "OFF";
  }

  const cameraButton =
    $("#cameraToggle");

  if (cameraButton) {

    cameraButton.textContent =
      controllerState.camera
        ? "Camera OFF"
        : "Camera ON";
  }

  const mirrorButton =
    $("#mirrorBtn");

  if (mirrorButton) {

    mirrorButton.classList.toggle(
      "active",
      controllerState.mirror
    );
  }
}


/* =========================================================
   RECORDING CONTROL
   ========================================================= */

function startRecording() {

  controllerState.recording = true;

  command(
    "startRecording"
  );

  updateRecordingUI();

  showToast("Recording started");
}


function pauseRecording() {

  command(
    "pauseRecording"
  );

  showToast("Recording paused");
}


function resumeRecording() {

  command(
    "resumeRecording"
  );

  showToast("Recording resumed");
}


function stopRecording() {

  controllerState.recording = false;

  command(
    "stopRecording"
  );

  updateRecordingUI();

  showToast("Recording stopped");
}


function updateRecordingUI() {

  const status =
    $("#recordingStatus");

  if (status) {

    status.textContent =
      controllerState.recording
        ? "RECORDING"
        : "READY";

    status.classList.toggle(
      "recording",
      controllerState.recording
    );
  }
}


/* =========================================================
   FAST DRAWING
   ========================================================= */

function normalizedPoint(event) {

  const rect =
    event.currentTarget.getBoundingClientRect();

  let x =
    (event.clientX - rect.left) /
    rect.width;

  let y =
    (event.clientY - rect.top) /
    rect.height;

  x = Math.max(
    0,
    Math.min(1, x)
  );

  y = Math.max(
    0,
    Math.min(1, y)
  );

  return {

    x,
    y,

    pressure:
      event.pressure > 0
        ? event.pressure
        : 0.5

  };
}


/* =========================================================
   POINT BUFFER
   ========================================================= */

function queuePoint(point) {

  controllerState.pointBuffer.push(
    point
  );

  if (
    controllerState.pointBuffer.length >= 12
  ) {

    flushPoints();
  }
}


function flushPoints() {

  if (
    controllerState.pointBuffer.length === 0
  ) {

    return;
  }

  const points =
    controllerState.pointBuffer.splice(
      0,
      12
    );

  command(
    "pointerbatch",
    {
      points
    }
  );
}


function startFlushTimer() {

  stopFlushTimer();

  controllerState.flushTimer =
    setInterval(
      flushPoints,
      35
    );
}


function stopFlushTimer() {

  if (controllerState.flushTimer) {

    clearInterval(
      controllerState.flushTimer
    );

    controllerState.flushTimer = null;
  }
}


/* =========================================================
   DRAWING SURFACE
   ========================================================= */

function getDrawingSurface() {

  return (
    $("#controllerDrawingSurface") ||
    $("#drawingSurface") ||
    $(".drawing-surface")
  );
}


/* =========================================================
   POINTER DOWN
   ========================================================= */

function handlePointerDown(event) {

  const surface =
    getDrawingSurface();

  if (!surface) return;

  event.preventDefault();

  try {

    surface.setPointerCapture(
      event.pointerId
    );

  } catch (_) {}

  const point =
    normalizedPoint(event);

  command(
    "pointerdown",
    {
      ...point,

      tool:
        controllerState.tool,

      color:
        controllerState.color,

      size:
        controllerState.size

    }
  );

  controllerState.pointBuffer = [];

  controllerState.lastPointerTime =
    performance.now();

  startFlushTimer();
}


/* =========================================================
   POINTER MOVE
   ========================================================= */

function handlePointerMove(event) {

  const surface =
    getDrawingSurface();

  if (!surface) return;

  if (
    !controllerState.connected
  ) {
    return;
  }

  if (
    event.buttons === 0 &&
    event.pointerType !== "pen"
  ) {
    return;
  }

  event.preventDefault();

  const now =
    performance.now();

  if (
    now -
    controllerState.lastPointerTime <
    12
  ) {

    return;
  }

  controllerState.lastPointerTime =
    now;

  queuePoint(
    normalizedPoint(event)
  );
}


/* =========================================================
   POINTER UP
   ========================================================= */

function handlePointerUp(event) {

  const surface =
    getDrawingSurface();

  if (!surface) return;

  event.preventDefault();

  flushPoints();

  stopFlushTimer();

  command(
    "pointerup"
  );

  try {

    surface.releasePointerCapture(
      event.pointerId
    );

  } catch (_) {}
}


/* =========================================================
   POINTER CANCEL
   ========================================================= */

function handlePointerCancel(event) {

  flushPoints();

  stopFlushTimer();

  command(
    "pointerup"
  );

  try {

    const surface =
      getDrawingSurface();

    if (surface) {

      surface.releasePointerCapture(
        event.pointerId
      );
    }

  } catch (_) {}
}


/* =========================================================
   DRAWING SURFACE SETUP
   ========================================================= */

function setupDrawingSurface() {

  const surface =
    getDrawingSurface();

  if (!surface) {

    console.warn(
      "Drawing surface not found."
    );

    return;
  }

  surface.style.touchAction =
    "none";

  surface.addEventListener(
    "pointerdown",
    handlePointerDown
  );

  surface.addEventListener(
    "pointermove",
    handlePointerMove
  );

  surface.addEventListener(
    "pointerup",
    handlePointerUp
  );

  surface.addEventListener(
    "pointercancel",
    handlePointerCancel
  );

  surface.addEventListener(
    "pointerleave",
    event => {

      if (
        event.buttons !== 0
      ) {

        handlePointerMove(event);
      }
    }
  );
}


/* =========================================================
   COMMAND BUTTON MAPPING
   ========================================================= */

function setupCommandButtons() {

  $$("[data-command]").forEach(
    button => {

      button.addEventListener(
        "click",
        () => {

          const type =
            button.dataset.command;

          if (!type) return;

          switch (type) {

            case "previousPage":
              previousPage();
              break;

            case "nextPage":
              nextPage();
              break;

            case "new":
              addPage();
              break;

            case "deletePage":
              deletePage();
              break;

            case "previousSlide":
              previousSlide();
              break;

            case "nextSlide":
              nextSlide();
              break;

            case "openPDF":
              openPDF();
              break;

            case "zoomIn":
              zoomIn();
              break;

            case "zoomOut":
              zoomOut();
              break;

            case "zoomReset":
              resetZoom();
              break;

            case "cameraOn":
              cameraOn();
              break;

            case "cameraOff":
              cameraOff();
              break;

            case "cameraToggle":
              toggleCamera();
              break;

            case "cameraMirror":
              toggleMirror();
              break;

            case "startRecording":
              startRecording();
              break;

            case "pauseRecording":
              pauseRecording();
              break;

            case "resumeRecording":
              resumeRecording();
              break;

            case "stopRecording":
              stopRecording();
              break;

            default:

              command(type);

              showToast(
                `${type} sent`
              );

          }

        }
      );

    }
  );
}


/* =========================================================
   TOOL BUTTONS
   ========================================================= */

function setupToolButtons() {

  $$("[data-tool]").forEach(
    button => {

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
}


/* =========================================================
   COLOR BUTTONS
   ========================================================= */

function setupColorButtons() {

  $$("[data-color]").forEach(
    button => {

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
}


/* =========================================================
   BRUSH SIZE
   ========================================================= */

function setupBrushSize() {

  const slider =
    $("#brushSize");

  if (!slider) return;

  slider.addEventListener(
    "input",
    () => {

      setSize(
        slider.value
      );

    }
  );

  setSize(
    slider.value
  );
}


/* =========================================================
   CAMERA BUTTONS
   ========================================================= */

function setupCameraButtons() {

  const cameraToggle =
    $("#cameraToggle");

  if (cameraToggle) {

    cameraToggle.addEventListener(
      "click",
      toggleCamera
    );
  }

  const mirror =
    $("#mirrorBtn");

  if (mirror) {

    mirror.addEventListener(
      "click",
      toggleMirror
    );
  }

  $$("[data-camera-direction]").forEach(
    button => {

      button.addEventListener(
        "click",
        () => {

          cameraMove(
            button.dataset.cameraDirection
          );

        }
      );
    }
  );

  $$("[data-camera-resize]").forEach(
    button => {

      button.addEventListener(
        "click",
        () => {

          cameraResize(
            button.dataset.cameraResize
          );

        }
      );
    }
  );
}


/* =========================================================
   RECORDING BUTTONS
   ========================================================= */

function setupRecordingButtons() {

  const start =
    $("#recordStart");

  const pause =
    $("#recordPause");

  const resume =
    $("#recordResume");

  const stop =
    $("#recordStop");


  if (start) {

    start.addEventListener(
      "click",
      startRecording
    );
  }


  if (pause) {

    pause.addEventListener(
      "click",
      pauseRecording
    );
  }


  if (resume) {

    resume.addEventListener(
      "click",
      resumeRecording
    );
  }


  if (stop) {

    stop.addEventListener(
      "click",
      stopRecording
    );
  }
}


/* =========================================================
   DEVICE DETECTION
   ========================================================= */

function detectDevice() {

  const ua =
    navigator.userAgent.toLowerCase();

  if (
    /ipad|tablet|android/.test(ua)
  ) {

    controllerState.device =
      "Tablet";

  } else if (
    /iphone|mobile/.test(ua)
  ) {

    controllerState.device =
      "Phone";

  } else {

    controllerState.device =
      "Desktop";
  }


  const deviceName =
    $("#deviceName");

  if (deviceName) {

    deviceName.textContent =
      controllerState.device;
  }
}


/* =========================================================
   PAIRING CODE UI
   ========================================================= */

function setupPairing() {

  const connectButton =
    $("#connectBtn") ||
    $("#connectButton");

  if (connectButton) {

    connectButton.addEventListener(
      "click",
      handleConnectButton
    );
  }


  const codeInput =
    $("#sessionCode") ||
    $("#pairCode") ||
    $("#connectionCode");

  if (codeInput) {

    codeInput.maxLength = 6;

    codeInput.inputMode = "numeric";

    codeInput.addEventListener(
      "input",
      () => {

        codeInput.value =
          codeInput.value
            .replace(/\D/g, "")
            .slice(0, 6);

      }
    );

    codeInput.addEventListener(
      "keydown",
      event => {

        if (
          event.key === "Enter"
        ) {

          connectController();
        }

      }
    );
  }
}


/* =========================================================
   KEEP SCREEN AWAKE
   ========================================================= */

let wakeLock = null;

async function requestWakeLock() {

  if (
    !("wakeLock" in navigator)
  ) {

    return;
  }

  try {

    wakeLock =
      await navigator.wakeLock.request(
        "screen"
      );

  } catch (error) {

    console.warn(
      "Wake Lock unavailable:",
      error
    );
  }
}


/* =========================================================
   STARTUP
   ========================================================= */

function initController() {

  detectDevice();

  setupPairing();

  setupToolButtons();

  setupColorButtons();

  setupBrushSize();

  setupCommandButtons();

  setupCameraButtons();

  setupRecordingButtons();

  setupDrawingSurface();

  updateActiveTool();

  updateCameraUI();

  updateRecordingUI();

  updatePageUI();

  updateZoomUI();

  requestWakeLock();

  console.log(
    "SNK Smart Board Wireless Controller loaded."
  );
}


/* =========================================================
   PAGE VISIBILITY
   ========================================================= */

document.addEventListener(
  "visibilitychange",
  () => {

    if (
      document.visibilityState ===
      "visible"
    ) {

      requestWakeLock();
    }

  }
);


/* =========================================================
   CLEANUP
   ========================================================= */

window.addEventListener(
  "beforeunload",
  () => {

    stopFlushTimer();

    stopHeartbeat();

  }
);


/* =========================================================
   GLOBAL EXPORTS
   ========================================================= */

window.SNKWirelessController = {

  connect:
    connectController,

  disconnect:
    disconnectController,

  sendCommand,

  setTool,

  setColor,

  setSize,

  previousPage,

  nextPage,

  addPage,

  deletePage,

  previousSlide,

  nextSlide,

  zoomIn,

  zoomOut,

  resetZoom,

  cameraOn,

  cameraOff,

  toggleCamera,

  toggleMirror,

  startRecording,

  pauseRecording,

  resumeRecording,

  stopRecording

};


/* =========================================================
   INIT
   ========================================================= */

if (
  document.readyState ===
  "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    initController
  );

} else {

  initController();
}
