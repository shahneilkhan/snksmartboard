/* =========================================================
   SNK SMART BOARD
   WIRELESS CONTROLLER
   STEP 11.2.1-C
   controller.js

   Current stage:
   - Tablet/Phone controller UI
   - Touch support
   - Stylus / Pointer Events
   - Tool selection
   - Color
   - Brush size
   - Page controls
   - PDF controls
   - Zoom controls
   - Camera controls
   - Recording controls
   - Local controller state

   STEP 11.2.2 will add:
   - Pairing
   - Realtime connection
   - Laptop command transport
   ========================================================= */


/* =========================================================
   CONTROLLER STATE
   ========================================================= */

const controllerState = {

  connected: false,

  boardName: "SNK Smart Board",

  deviceName: "This Device",

  tool: "pen",

  color: "#111827",

  size: 5,

  page: 1,

  totalPages: 1,

  slide: 1,

  totalSlides: 1,

  zoom: 100,

  cameraOn: false,

  cameraMirror: false,

  recording: false,

  recordingPaused: false,

  recordingSeconds: 0,

  pointerDown: false,

  lastPointer: {
    x: 0,
    y: 0
  }

};


/* =========================================================
   DOM HELPER
   ========================================================= */

function $(id) {
  return document.getElementById(id);
}


/* =========================================================
   DOM ELEMENTS
   ========================================================= */

const connectionStatus =
  $("connectionStatus");

const connectionText =
  $("connectionText");

const connectionButton =
  $("connectButton");

const boardName =
  $("boardName");

const boardStatus =
  $("boardStatus");

const activeToolLabel =
  $("activeToolLabel");

const currentColorPreview =
  $("currentColorPreview");

const sizeRange =
  $("sizeRange");

const sizeValue =
  $("sizeValue");

const sizeDot =
  $("sizeDot");

const pageCounter =
  $("pageCounter");

const mediaStatus =
  $("mediaStatus");

const zoomValue =
  $("zoomValue");

const cameraStatus =
  $("cameraStatus");

const recordingIndicator =
  $("recordingIndicator");

const recordingTime =
  $("recordingTime");

const deviceName =
  $("deviceName");

const deviceInfo =
  $("deviceInfo");

const deviceBadge =
  $("deviceBadge");

const toast =
  $("toast");

const toastIcon =
  $("toastIcon");

const toastMessage =
  $("toastMessage");


/* =========================================================
   TOAST
   ========================================================= */

let toastTimer = null;

function showToast(
  message,
  icon = "✓"
) {

  if (!toast || !toastMessage) {
    return;
  }

  toastMessage.textContent = message;

  if (toastIcon) {
    toastIcon.textContent = icon;
  }

  toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {

    toast.classList.remove("show");

  }, 2200);

}


/* =========================================================
   CONNECTION UI
   ========================================================= */

function updateConnectionUI() {

  if (!connectionStatus) {
    return;
  }

  if (controllerState.connected) {

    connectionStatus.classList.add(
      "connected"
    );

    if (connectionText) {
      connectionText.textContent =
        "Connected";
    }

    if (boardStatus) {
      boardStatus.textContent =
        "Connected to Smart Board";
    }

    if (connectionButton) {
      connectionButton.textContent =
        "Connected";
    }

    if (deviceBadge) {
      deviceBadge.textContent =
        "ONLINE";
    }

  } else {

    connectionStatus.classList.remove(
      "connected"
    );

    if (connectionText) {
      connectionText.textContent =
        "Not Connected";
    }

    if (boardStatus) {
      boardStatus.textContent =
        "Waiting for connection";
    }

    if (connectionButton) {
      connectionButton.textContent =
        "Connect";
    }

    if (deviceBadge) {
      deviceBadge.textContent =
        "LOCAL";
    }

  }

}


/* =========================================================
   CONNECTION DEMO
   ========================================================= */

function toggleConnection() {

  /*
    IMPORTANT:

    This is only the UI connection state.

    Real laptop ↔ tablet communication will be
    implemented in STEP 11.2.2.
  */

  controllerState.connected =
    !controllerState.connected;

  updateConnectionUI();

  if (controllerState.connected) {

    showToast(
      "Controller connected",
      "🟢"
    );

  } else {

    showToast(
      "Controller disconnected",
      "⚪"
    );

  }

}


/* =========================================================
   TOOL SELECTION
   ========================================================= */

function selectTool(tool) {

  const allowedTools = [
    "pen",
    "marker",
    "eraser",
    "text"
  ];

  if (!allowedTools.includes(tool)) {
    return;
  }

  controllerState.tool = tool;

  const buttons =
    document.querySelectorAll(
      ".tool-button"
    );

  buttons.forEach(button => {

    const buttonTool =
      button.dataset.tool;

    button.classList.toggle(
      "active",
      buttonTool === tool
    );

  });


  const labels = {

    pen: "Pen",

    marker: "Marker",

    eraser: "Eraser",

    text: "Text"

  };


  if (activeToolLabel) {

    activeToolLabel.textContent =
      labels[tool] || "Pen";

  }


  showToast(
    `${labels[tool] || "Tool"} selected`,
    "✏️"
  );


  sendCommand({
    type: "tool",
    tool
  });

}


/* =========================================================
   COLOR
   ========================================================= */

function setColor(color) {

  if (!color) {
    return;
  }

  controllerState.color =
    color;

  const buttons =
    document.querySelectorAll(
      ".color-button"
    );

  buttons.forEach(button => {

    button.classList.toggle(
      "active",
      button.dataset.color === color
    );

  });


  if (currentColorPreview) {

    currentColorPreview.style.background =
      color;

  }


  updateSizePreview();


  sendCommand({
    type: "color",
    color
  });

}


/* =========================================================
   BRUSH SIZE
   ========================================================= */

function setBrushSize(value) {

  const size =
    Number(value);

  if (
    !Number.isFinite(size)
  ) {
    return;
  }

  controllerState.size =
    Math.max(
      1,
      Math.min(
        40,
        size
      )
    );


  if (sizeRange) {

    sizeRange.value =
      controllerState.size;

  }


  if (sizeValue) {

    sizeValue.textContent =
      `${controllerState.size} px`;

  }


  updateSizePreview();


  sendCommand({
    type: "size",
    size: controllerState.size
  });

}


/* =========================================================
   SIZE PREVIEW
   ========================================================= */

function updateSizePreview() {

  if (!sizeDot) {
    return;
  }

  const visualSize =
    Math.max(
      5,
      Math.min(
        38,
        controllerState.size
      )
    );

  sizeDot.style.width =
    `${visualSize}px`;

  sizeDot.style.height =
    `${visualSize}px`;

  sizeDot.style.background =
    controllerState.color;

}


/* =========================================================
   QUICK BOARD ACTIONS
   ========================================================= */

function undo() {

  showToast(
    "Undo",
    "↩"
  );

  sendCommand({
    type: "undo"
  });

}


function redo() {

  showToast(
    "Redo",
    "↪"
  );

  sendCommand({
    type: "redo"
  });

}


function clearBoard() {

  const confirmed =
    window.confirm(
      "Clear the current board?"
    );

  if (!confirmed) {
    return;
  }

  showToast(
    "Board clear command sent",
    "🗑"
  );

  sendCommand({
    type: "clear"
  });

}


function createNewBoard() {

  const confirmed =
    window.confirm(
      "Create a new board page?"
    );

  if (!confirmed) {
    return;
  }

  controllerState.page = 1;

  controllerState.totalPages =
    Math.max(
      1,
      controllerState.totalPages + 1
    );

  updatePageUI();

  showToast(
    "New board created",
    "＋"
  );

  sendCommand({
    type: "new-board"
  });

}


/* =========================================================
   PAGE CONTROL
   ========================================================= */

function updatePageUI() {

  if (pageCounter) {

    pageCounter.textContent =
      `${controllerState.page} / ${controllerState.totalPages}`;

  }

}


function previousPage() {

  if (
    controllerState.page <= 1
  ) {

    showToast(
      "Already on first page",
      "ℹ️"
    );

    return;

  }


  controllerState.page--;

  updatePageUI();

  showToast(
    `Page ${controllerState.page}`,
    "←"
  );


  sendCommand({
    type: "page",
    action: "previous",
    page: controllerState.page
  });

}


function nextPage() {

  if (
    controllerState.page >=
    controllerState.totalPages
  ) {

    /*
      For the controller demo,
      allow a new page to be requested.
    */

    controllerState.totalPages++;

  }


  controllerState.page++;

  updatePageUI();

  showToast(
    `Page ${controllerState.page}`,
    "→"
  );


  sendCommand({
    type: "page",
    action: "next",
    page: controllerState.page
  });

}


function addPage() {

  controllerState.totalPages++;

  controllerState.page =
    controllerState.totalPages;

  updatePageUI();

  showToast(
    "Page added",
    "＋"
  );


  sendCommand({
    type: "page",
    action: "add",
    page: controllerState.page
  });

}


function deletePage() {

  if (
    controllerState.totalPages <= 1
  ) {

    showToast(
      "Cannot delete the only page",
      "ℹ️"
    );

    return;

  }


  const confirmed =
    window.confirm(
      "Delete the current page?"
    );

  if (!confirmed) {
    return;
  }


  controllerState.totalPages--;

  controllerState.page =
    Math.min(
      controllerState.page,
      controllerState.totalPages
    );


  updatePageUI();


  showToast(
    "Page deleted",
    "−"
  );


  sendCommand({
    type: "page",
    action: "delete",
    page: controllerState.page
  });

}


/* =========================================================
   PDF / SLIDE CONTROL
   ========================================================= */

function previousSlide() {

  if (
    controllerState.slide <= 1
  ) {

    showToast(
      "Already on first slide",
      "ℹ️"
    );

    return;

  }


  controllerState.slide--;

  updateMediaStatus();


  sendCommand({
    type: "slide",
    action: "previous",
    slide: controllerState.slide
  });

}


function nextSlide() {

  if (
    controllerState.slide <
    controllerState.totalSlides
  ) {

    controllerState.slide++;

  } else {

    controllerState.totalSlides++;

    controllerState.slide =
      controllerState.totalSlides;

  }


  updateMediaStatus();


  sendCommand({
    type: "slide",
    action: "next",
    slide: controllerState.slide
  });

}


function openPDF() {

  showToast(
    "Open PDF command sent",
    "📄"
  );

  sendCommand({
    type: "pdf",
    action: "open"
  });

}


function updateMediaStatus() {

  if (!mediaStatus) {
    return;
  }

  if (
    controllerState.totalSlides > 1
  ) {

    mediaStatus.textContent =
      `Slide ${controllerState.slide} / ${controllerState.totalSlides}`;

  } else {

    mediaStatus.textContent =
      "No PDF";

  }

}


/* =========================================================
   ZOOM
   ========================================================= */

function setZoom(value) {

  controllerState.zoom =
    Math.max(
      25,
      Math.min(
        300,
        value
      )
    );


  if (zoomValue) {

    zoomValue.textContent =
      `${controllerState.zoom}%`;

  }


  sendCommand({
    type: "zoom",
    value: controllerState.zoom
  });

}


function zoomIn() {

  setZoom(
    controllerState.zoom + 10
  );

  showToast(
    `Zoom ${controllerState.zoom}%`,
    "+"
  );

}


function zoomOut() {

  setZoom(
    controllerState.zoom - 10
  );

  showToast(
    `Zoom ${controllerState.zoom}%`,
    "−"
  );

}


function resetZoom() {

  setZoom(100);

  showToast(
    "Zoom reset",
    "100"
  );

}


/* =========================================================
   CAMERA
   ========================================================= */

function updateCameraUI() {

  if (!cameraStatus) {
    return;
  }


  if (controllerState.cameraOn) {

    cameraStatus.textContent =
      "ON";

    cameraStatus.classList.add(
      "on"
    );

  } else {

    cameraStatus.textContent =
      "OFF";

    cameraStatus.classList.remove(
      "on"
    );

  }

}


function toggleCamera() {

  controllerState.cameraOn =
    !controllerState.cameraOn;

  updateCameraUI();


  showToast(
    controllerState.cameraOn
      ? "Camera ON"
      : "Camera OFF",
    "📷"
  );


  sendCommand({
    type: "camera",
    action:
      controllerState.cameraOn
        ? "on"
        : "off"
  });

}


function toggleCameraMirror() {

  controllerState.cameraMirror =
    !controllerState.cameraMirror;


  showToast(
    controllerState.cameraMirror
      ? "Camera mirror ON"
      : "Camera mirror OFF",
    "↔"
  );


  sendCommand({
    type: "camera",
    action: "mirror",
    value:
      controllerState.cameraMirror
  });

}


/* =========================================================
   CAMERA POSITION
   ========================================================= */

function moveCamera(direction) {

  const supported = [
    "up",
    "down",
    "left",
    "right"
  ];

  if (
    !supported.includes(direction)
  ) {
    return;
  }


  showToast(
    `Camera ${direction}`,
    "📷"
  );


  sendCommand({
    type: "camera",
    action: "move",
    direction
  });

}


/* =========================================================
   RECORDING
   ========================================================= */

let recordingTimer = null;


function formatTime(seconds) {

  const safeSeconds =
    Math.max(
      0,
      Number(seconds) || 0
    );

  const minutes =
    Math.floor(
      safeSeconds / 60
    );

  const secs =
    safeSeconds % 60;


  return (
    String(minutes).padStart(2, "0")
    +
    ":"
    +
    String(secs).padStart(2, "0")
  );

}


function updateRecordingUI() {

  if (recordingTime) {

    recordingTime.textContent =
      formatTime(
        controllerState.recordingSeconds
      );

  }


  if (recordingIndicator) {

    recordingIndicator.classList.toggle(
      "recording",
      controllerState.recording &&
      !controllerState.recordingPaused
    );

  }

}


function startRecordingTimer() {

  clearInterval(
    recordingTimer
  );


  recordingTimer =
    setInterval(() => {

      if (
        !controllerState.recording ||
        controllerState.recordingPaused
      ) {
        return;
      }

      controllerState.recordingSeconds++;

      updateRecordingUI();

    }, 1000);

}


function stopRecordingTimer() {

  clearInterval(
    recordingTimer
  );

  recordingTimer = null;

}


function startRecording() {

  if (
    controllerState.recording
  ) {

    showToast(
      "Recording already running",
      "🔴"
    );

    return;

  }


  controllerState.recording =
    true;

  controllerState.recordingPaused =
    false;

  controllerState.recordingSeconds =
    0;


  updateRecordingUI();

  startRecordingTimer();


  showToast(
    "Recording started",
    "🔴"
  );


  sendCommand({
    type: "recording",
    action: "start"
  });

}


function pauseRecording() {

  if (
    !controllerState.recording
  ) {

    showToast(
      "No active recording",
      "ℹ️"
    );

    return;

  }


  controllerState.recordingPaused =
    true;


  updateRecordingUI();


  showToast(
    "Recording paused",
    "⏸"
  );


  sendCommand({
    type: "recording",
    action: "pause"
  });

}


function resumeRecording() {

  if (
    !controllerState.recording
  ) {

    showToast(
      "No active recording",
      "ℹ️"
    );

    return;

  }


  controllerState.recordingPaused =
    false;


  updateRecordingUI();


  showToast(
    "Recording resumed",
    "▶"
  );


  sendCommand({
    type: "recording",
    action: "resume"
  });

}


function stopRecording() {

  if (
    !controllerState.recording
  ) {

    showToast(
      "No active recording",
      "ℹ️"
    );

    return;

  }


  controllerState.recording =
    false;

  controllerState.recordingPaused =
    false;


  stopRecordingTimer();

  updateRecordingUI();


  showToast(
    "Recording stopped",
    "■"
  );


  sendCommand({
    type: "recording",
    action: "stop"
  });

}


/* =========================================================
   POINTER / STYLUS TEST AREA
   ========================================================= */

/*
  The controller UI itself does not draw locally yet.

  We still listen for Pointer Events so the controller
  is ready for:

  - finger
  - active stylus
  - mouse

  In STEP 11.2.3 these events will be converted into
  realtime drawing commands.
*/


function handlePointerDown(event) {

  controllerState.pointerDown =
    true;

  controllerState.lastPointer = {
    x: event.clientX,
    y: event.clientY
  };


}


function handlePointerMove(event) {

  if (
    !controllerState.pointerDown
  ) {
    return;
  }


  const current = {
    x: event.clientX,
    y: event.clientY
  };


  const dx =
    current.x -
    controllerState.lastPointer.x;

  const dy =
    current.y -
    controllerState.lastPointer.y;


  /*
    We don't send drawing data yet.

    STEP 11.2.3 will send:
      pointerdown
      pointermove
      pointerup
    through the realtime connection.
  */


  controllerState.lastPointer =
    current;

}


function handlePointerUp() {

  controllerState.pointerDown =
    false;

}


/* =========================================================
   COMMAND SYSTEM
   ========================================================= */

/*
  This is the bridge between the controller UI
  and the future realtime connection.

  For now commands are logged locally.

  STEP 11.2.2 will replace this transport with
  actual Laptop ↔ Tablet communication.
*/

function sendCommand(command) {

  const packet = {

    source: "snk-smart-board-controller",

    version: "11.2.1",

    timestamp:
      Date.now(),

    command

  };


  console.log(
    "[SNK Controller Command]",
    packet
  );


  /*
    Future:

    realtimeChannel.send(
      JSON.stringify(packet)
    );
  */

}


/* =========================================================
   DEVICE INFORMATION
   ========================================================= */

function detectDevice() {

  const ua =
    navigator.userAgent || "";

  let type =
    "Device";


  if (
    /Android/i.test(ua)
  ) {

    type = "Android Device";

  } else if (
    /iPad/i.test(ua)
  ) {

    type = "iPad";

  } else if (
    /iPhone/i.test(ua)
  ) {

    type = "iPhone";

  } else if (
    /Windows/i.test(ua)
  ) {

    type = "Windows Device";

  }


  controllerState.deviceName =
    type;


  if (deviceName) {

    deviceName.textContent =
      type;

  }


  if (deviceInfo) {

    const hasTouch =
      navigator.maxTouchPoints > 0;


    const touchText =
      hasTouch
        ? "Touch / Stylus available"
        : "Mouse / Pointer available";


    deviceInfo.textContent =
      touchText;

  }

}


/* =========================================================
   EVENT LISTENERS
   ========================================================= */


/* Connection */

if (connectionButton) {

  connectionButton.addEventListener(
    "click",
    toggleConnection
  );

}


/* Tools */

document
  .querySelectorAll(".tool-button")
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        selectTool(
          button.dataset.tool
        );

      }
    );

  });


/* Colors */

document
  .querySelectorAll(".color-button")
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        setColor(
          button.dataset.color
        );

      }
    );

  });


/* Brush size */

if (sizeRange) {

  sizeRange.addEventListener(
    "input",
    event => {

      setBrushSize(
        event.target.value
      );

    }
  );

}


/* Quick actions */

const undoButton =
  $("undoButton");

if (undoButton) {

  undoButton.addEventListener(
    "click",
    undo
  );

}


const redoButton =
  $("redoButton");

if (redoButton) {

  redoButton.addEventListener(
    "click",
    redo
  );

}


const clearButton =
  $("clearButton");

if (clearButton) {

  clearButton.addEventListener(
    "click",
    clearBoard
  );

}


const newBoardButton =
  $("newBoardButton");

if (newBoardButton) {

  newBoardButton.addEventListener(
    "click",
    createNewBoard
  );

}


/* Pages */

const previousPageButton =
  $("previousPageButton");

if (previousPageButton) {

  previousPageButton.addEventListener(
    "click",
    previousPage
  );

}


const nextPageButton =
  $("nextPageButton");

if (nextPageButton) {

  nextPageButton.addEventListener(
    "click",
    nextPage
  );

}


const addPageButton =
  $("addPageButton");

if (addPageButton) {

  addPageButton.addEventListener(
    "click",
    addPage
  );

}


const deletePageButton =
  $("deletePageButton");

if (deletePageButton) {

  deletePageButton.addEventListener(
    "click",
    deletePage
  );

}


/* PDF / Slides */

const previousSlideButton =
  $("previousSlideButton");

if (previousSlideButton) {

  previousSlideButton.addEventListener(
    "click",
    previousSlide
  );

}


const nextSlideButton =
  $("nextSlideButton");

if (nextSlideButton) {

  nextSlideButton.addEventListener(
    "click",
    nextSlide
  );

}


const openPdfButton =
  $("openPdfButton");

if (openPdfButton) {

  openPdfButton.addEventListener(
    "click",
    openPDF
  );

}


/* Zoom */

const zoomOutButton =
  $("zoomOutButton");

if (zoomOutButton) {

  zoomOutButton.addEventListener(
    "click",
    zoomOut
  );

}


const zoomResetButton =
  $("zoomResetButton");

if (zoomResetButton) {

  zoomResetButton.addEventListener(
    "click",
    resetZoom
  );

}


const zoomInButton =
  $("zoomInButton");

if (zoomInButton) {

  zoomInButton.addEventListener(
    "click",
    zoomIn
  );

}


/* Camera */

const cameraToggleButton =
  $("cameraToggleButton");

if (cameraToggleButton) {

  cameraToggleButton.addEventListener(
    "click",
    toggleCamera
  );

}


const cameraMirrorButton =
  $("cameraMirrorButton");

if (cameraMirrorButton) {

  cameraMirrorButton.addEventListener(
    "click",
    toggleCameraMirror
  );

}


const cameraUpButton =
  $("cameraUpButton");

if (cameraUpButton) {

  cameraUpButton.addEventListener(
    "click",
    () => moveCamera("up")
  );

}


const cameraDownButton =
  $("cameraDownButton");

if (cameraDownButton) {

  cameraDownButton.addEventListener(
    "click",
    () => moveCamera("down")
  );

}


const cameraLeftButton =
  $("cameraLeftButton");

if (cameraLeftButton) {

  cameraLeftButton.addEventListener(
    "click",
    () => moveCamera("left")
  );

}


const cameraRightButton =
  $("cameraRightButton");

if (cameraRightButton) {

  cameraRightButton.addEventListener(
    "click",
    () => moveCamera("right")
  );

}


/* Recording */

const startRecordingButton =
  $("startRecordingButton");

if (startRecordingButton) {

  startRecordingButton.addEventListener(
    "click",
    startRecording
  );

}


const pauseRecordingButton =
  $("pauseRecordingButton");

if (pauseRecordingButton) {

  pauseRecordingButton.addEventListener(
    "click",
    pauseRecording
  );

}


const resumeRecordingButton =
  $("resumeRecordingButton");

if (resumeRecordingButton) {

  resumeRecordingButton.addEventListener(
    "click",
    resumeRecording
  );

}


const stopRecordingButton =
  $("stopRecordingButton");

if (stopRecordingButton) {

  stopRecordingButton.addEventListener(
    "click",
    stopRecording
  );

}


/* =========================================================
   POINTER LISTENERS
   ========================================================= */

document.addEventListener(
  "pointerdown",
  handlePointerDown,
  {
    passive: true
  }
);


document.addEventListener(
  "pointermove",
  handlePointerMove,
  {
    passive: true
  }
);


document.addEventListener(
  "pointerup",
  handlePointerUp,
  {
    passive: true
  }
);


document.addEventListener(
  "pointercancel",
  handlePointerUp,
  {
    passive: true
  }
);


/* =========================================================
   PREVENT ACCIDENTAL LONG PRESS MENU
   ========================================================= */

document.addEventListener(
  "contextmenu",
  event => {

    /*
      Keep long-press friendly controller
      from opening the browser context menu.
    */

    event.preventDefault();

  }
);


/* =========================================================
   KEYBOARD SUPPORT
   ========================================================= */

document.addEventListener(
  "keydown",
  event => {

    if (
      event.ctrlKey &&
      event.key.toLowerCase() === "z"
    ) {

      event.preventDefault();

      undo();

      return;

    }


    if (
      event.ctrlKey &&
      event.key.toLowerCase() === "y"
    ) {

      event.preventDefault();

      redo();

      return;

    }


    if (
      event.key === "Escape"
    ) {

      if (
        controllerState.recording
      ) {

        stopRecording();

      }

    }

  }
);


/* =========================================================
   INITIAL STATE
   ========================================================= */

function initializeController() {

  detectDevice();

  updateConnectionUI();

  updatePageUI();

  updateMediaStatus();

  updateCameraUI();

  updateRecordingUI();

  setColor(
    controllerState.color
  );

  setBrushSize(
    controllerState.size
  );

  selectTool(
    controllerState.tool
  );


  console.log(
    "SNK Smart Board Controller 11.2.1 initialized."
  );

}


/* =========================================================
   START
   ========================================================= */

initializeController();
