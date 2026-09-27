/* =========================================================
   SNK SMART BOARD
   STEP 9.3 — FINAL CLASS RECORDING ENGINE

   Features:
   - Pen / Marker / Eraser
   - Undo / Redo
   - Text
   - Image / Slide
   - PDF.js PDF rendering
   - PDF page navigation
   - Board pages
   - Notes
   - Camera ON/OFF
   - Draggable camera
   - Resizable camera
   - Camera shape
   - Camera mirror
   - Soft camera blur
   - Microphone ON/OFF
   - Composite recording
   - Board + PDF/Image + Drawing + Text + Camera
   - MediaRecorder
   - Start / Pause / Resume / Stop
   - Recording preview
   - WebM download
   - PNG composite save
========================================================= */

"use strict";


/* =========================================================
   PDF.JS
========================================================= */

if (typeof pdfjsLib !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}


/* =========================================================
   DOM HELPERS
========================================================= */

const $ = (selector) => document.querySelector(selector);

const $$ = (selector) => document.querySelectorAll(selector);


/* =========================================================
   DOM ELEMENTS
========================================================= */

const app = $(".app");

const boardStage = $("#boardStage");
const boardStageWrapper = $("#boardStageWrapper");

const drawingCanvas = $("#drawingCanvas");
const drawingCtx = drawingCanvas.getContext("2d");

const slideLayer = $("#slideLayer");
const slideImage = $("#slideImage");

const pdfCanvas = $("#pdfCanvas");
const pdfCtx = pdfCanvas.getContext("2d");

const textLayer = $("#textLayer");

const welcomeScreen = $("#welcomeScreen");

const colorPicker = $("#colorPicker");
const sizeSlider = $("#sizeSlider");
const sizeValue = $("#sizeValue");

const boardStatus = $("#boardStatus");

const toast = $("#toast");

const imageInput = $("#imageInput");
const pdfInput = $("#pdfInput");

const pdfToolbar = $("#pdfToolbar");
const pdfFileName = $("#pdfFileName");
const pdfPageInfo = $("#pdfPageInfo");

const notesInput = $("#notesInput");
const notesStatus = $("#notesStatus");

const pageList = $("#pageList");

const cameraOverlay = $("#cameraOverlay");
const mentorVideo = $("#mentorVideo");
const cameraResizeHandle = $("#cameraResizeHandle");

const cameraStatus = $("#cameraStatus");
const micStatus = $("#micStatus");

const cameraSettings = $("#cameraSettings");
const cameraShape = $("#cameraShape");
const cameraEffect = $("#cameraEffect");

const recordingIndicator = $("#recordingIndicator");
const recordingTimer = $("#recordingTimer");

const recordingStatus = $("#recordingStatus");

const recordingPanel = $("#recordingPanel");

const recordingPanelStatus = $("#recordingPanelStatus");
const recordingPanelTimer = $("#recordingPanelTimer");
const recordingPanelMic = $("#recordingPanelMic");
const recordingPanelCamera = $("#recordingPanelCamera");

const recordedVideoArea = $("#recordedVideoArea");
const recordedVideo = $("#recordedVideo");

const downloadRecordingBtn = $("#downloadRecordingBtn");


/* =========================================================
   STATE
========================================================= */

let currentTool = "pen";

let currentColor = "#1565c0";

let currentSize = 5;

let isDrawing = false;

let lastX = 0;
let lastY = 0;

let shapeStartX = 0;
let shapeStartY = 0;

let shapeSnapshot = null;

let textItems = [];

let slideObjectUrl = null;

let slideImageLoaded = false;

let boardZoom = 1;


/* =========================================================
   BOARD PAGES
========================================================= */

let pages = [
  {
    drawingData: null,
    textItems: [],
    notes: "",
    slideData: null
  }
];

let currentPageIndex = 0;


/* =========================================================
   HISTORY
========================================================= */

let history = [];
let historyIndex = -1;

let historyTimer = null;


/* =========================================================
   PDF STATE
========================================================= */

let pdfDocument = null;
let pdfObjectUrl = null;

let pdfPageNumber = 1;
let pdfPageCount = 0;

let pdfRendering = false;


/* =========================================================
   CAMERA STATE
========================================================= */

let cameraStream = null;

let cameraEnabled = false;

let cameraState = {
  x: 0.72,
  y: 0.07,
  width: 0.24,
  height: 0.24 * 9 / 16,
  shape: "rounded",
  effect: "none",
  mirror: true
};


/* =========================================================
   CAMERA DRAG STATE
========================================================= */

let cameraDragging = false;

let cameraDragStartX = 0;
let cameraDragStartY = 0;

let cameraOriginalX = 0;
let cameraOriginalY = 0;


/* =========================================================
   CAMERA RESIZE STATE
========================================================= */

let cameraResizing = false;

let cameraResizeStartX = 0;
let cameraResizeStartY = 0;

let cameraOriginalWidth = 0;
let cameraOriginalHeight = 0;

let cameraOriginalLeft = 0;
let cameraOriginalTop = 0;


/* =========================================================
   MICROPHONE
========================================================= */

let micStream = null;

let micEnabled = false;


/* =========================================================
   RECORDING
========================================================= */

let recordCanvas = null;
let recordCtx = null;

let recordingStream = null;
let mediaRecorder = null;

let recordingChunks = [];

let recordingMimeType = "";

let isRecording = false;
let isPaused = false;

let recordingStartedAt = 0;
let recordingPausedAt = 0;

let recordingElapsedBeforePause = 0;

let recordingTimerInterval = null;

let recordingRenderFrame = null;

let recordingBlob = null;
let recordingUrl = null;


/* =========================================================
   TEXT DRAG
========================================================= */

let draggedText = null;

let textDragOffsetX = 0;
let textDragOffsetY = 0;


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
   BOARD STATUS
========================================================= */

function setBoardStatus(message) {
  if (boardStatus) {
    boardStatus.textContent = message;
  }
}


/* =========================================================
   CANVAS RESIZE
========================================================= */

function resizeDrawingCanvas() {

  const rect = boardStage.getBoundingClientRect();

  const oldWidth = drawingCanvas.width;
  const oldHeight = drawingCanvas.height;

  let oldData = null;

  if (oldWidth > 0 && oldHeight > 0) {
    try {
      oldData = drawingCtx.getImageData(
        0,
        0,
        oldWidth,
        oldHeight
      );
    } catch (error) {
      oldData = null;
    }
  }

  const width = Math.max(
    1,
    Math.floor(rect.width * window.devicePixelRatio)
  );

  const height = Math.max(
    1,
    Math.floor(rect.height * window.devicePixelRatio)
  );

  drawingCanvas.width = width;
  drawingCanvas.height = height;

  drawingCanvas.style.width = `${rect.width}px`;
  drawingCanvas.style.height = `${rect.height}px`;

  drawingCtx.setTransform(
    window.devicePixelRatio,
    0,
    0,
    window.devicePixelRatio,
    0,
    0
  );

  drawingCtx.lineCap = "round";
  drawingCtx.lineJoin = "round";

  if (oldData) {

    const temporaryCanvas = document.createElement("canvas");

    temporaryCanvas.width = oldWidth;
    temporaryCanvas.height = oldHeight;

    const temporaryCtx =
      temporaryCanvas.getContext("2d");

    temporaryCtx.putImageData(
      oldData,
      0,
      0
    );

    drawingCtx.drawImage(
      temporaryCanvas,
      0,
      0,
      rect.width,
      rect.height
    );
  }

  renderCurrentPage();
}


/* =========================================================
   INITIAL CANVAS
========================================================= */

window.addEventListener(
  "resize",
  resizeDrawingCanvas
);


/* =========================================================
   DRAWING HELPERS
========================================================= */

function getCanvasPoint(event) {

  const rect = drawingCanvas.getBoundingClientRect();

  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}


function getPressure(event) {

  if (
    typeof event.pressure === "number" &&
    event.pressure > 0
  ) {
    return event.pressure;
  }

  return 0.5;
}


/* =========================================================
   DRAWING STYLE
========================================================= */

function applyDrawingStyle() {

  drawingCtx.lineCap = "round";
  drawingCtx.lineJoin = "round";

  if (currentTool === "eraser") {

    drawingCtx.globalCompositeOperation =
      "destination-out";

    drawingCtx.globalAlpha = 1;

    drawingCtx.lineWidth =
      currentSize * 2;

    return;
  }


  drawingCtx.globalCompositeOperation =
    "source-over";


  if (currentTool === "marker") {

    drawingCtx.globalAlpha = 0.28;

    drawingCtx.strokeStyle = currentColor;

    drawingCtx.lineWidth =
      currentSize * 3;

  } else {

    drawingCtx.globalAlpha = 1;

    drawingCtx.strokeStyle = currentColor;

    drawingCtx.lineWidth =
      currentSize;
  }
}


/* =========================================================
   DRAW POINTER DOWN
========================================================= */

function handlePointerDown(event) {

  if (
    event.target !== drawingCanvas ||
    cameraDragging ||
    cameraResizing
  ) {
    return;
  }

  const point = getCanvasPoint(event);

  drawingCanvas.setPointerCapture(
    event.pointerId
  );

  isDrawing = true;

  lastX = point.x;
  lastY = point.y;

  if (currentTool === "shape") {

    shapeStartX = point.x;
    shapeStartY = point.y;

    shapeSnapshot =
      drawingCtx.getImageData(
        0,
        0,
        drawingCanvas.width,
        drawingCanvas.height
      );
  }

  applyDrawingStyle();

  if (
    currentTool !== "shape" &&
    currentTool !== "text"
  ) {

    drawingCtx.beginPath();

    drawingCtx.moveTo(
      point.x,
      point.y
    );

    drawingCtx.lineTo(
      point.x + 0.01,
      point.y + 0.01
    );

    drawingCtx.stroke();
  }

  hideWelcome();

  event.preventDefault();
}


/* =========================================================
   DRAW POINTER MOVE
========================================================= */

function handlePointerMove(event) {

  if (!isDrawing) return;

  const point = getCanvasPoint(event);

  if (currentTool === "shape") {

    redrawShapePreview(
      point.x,
      point.y
    );

    event.preventDefault();

    return;
  }


  if (currentTool === "text") {
    return;
  }


  const pressure =
    getPressure(event);


  if (
    currentTool === "pen" &&
    event.pointerType === "pen"
  ) {

    drawingCtx.lineWidth =
      Math.max(
        1,
        currentSize *
        (0.55 + pressure * 0.9)
      );
  }


  drawingCtx.lineTo(
    point.x,
    point.y
  );

  drawingCtx.stroke();


  lastX = point.x;
  lastY = point.y;

  event.preventDefault();
}


/* =========================================================
   DRAW POINTER UP
========================================================= */

function handlePointerUp(event) {

  if (!isDrawing) return;

  isDrawing = false;

  drawingCtx.globalAlpha = 1;

  drawingCtx.globalCompositeOperation =
    "source-over";

  if (currentTool === "shape") {

    shapeSnapshot = null;
  }

  saveCurrentPage();

  saveHistory();

  try {
    drawingCanvas.releasePointerCapture(
      event.pointerId
    );
  } catch (error) {
    /* ignore */
  }
}


/* =========================================================
   SHAPE PREVIEW
========================================================= */

function redrawShapePreview(endX, endY) {

  if (!shapeSnapshot) return;

  drawingCtx.putImageData(
    shapeSnapshot,
    0,
    0
  );

  drawingCtx.setTransform(
    window.devicePixelRatio,
    0,
    0,
    window.devicePixelRatio,
    0,
    0
  );

  drawingCtx.globalCompositeOperation =
    "source-over";

  drawingCtx.globalAlpha = 1;

  drawingCtx.strokeStyle =
    currentColor;

  drawingCtx.lineWidth =
    currentSize;

  drawingCtx.lineCap = "round";
  drawingCtx.lineJoin = "round";

  const x = shapeStartX;
  const y = shapeStartY;

  const width = endX - x;
  const height = endY - y;

  drawingCtx.beginPath();

  /*
     Default shape = rectangle
  */

  drawingCtx.rect(
    x,
    y,
    width,
    height
  );

  drawingCtx.stroke();
}


/* =========================================================
   TOOL SELECTION
========================================================= */

function setTool(tool) {

  currentTool = tool;

  $$(".tool-btn").forEach((button) => {
    button.classList.remove("active");
  });


  const map = {
    pen: "#penTool",
    marker: "#markerTool",
    eraser: "#eraserTool",
    text: "#textTool",
    shape: "#shapeTool"
  };


  if (map[tool]) {

    const button = $(map[tool]);

    if (button) {
      button.classList.add("active");
    }
  }


  if (tool === "eraser") {

    drawingCanvas.style.cursor =
      "cell";

  } else if (tool === "text") {

    drawingCanvas.style.cursor =
      "text";

  } else if (tool === "shape") {

    drawingCanvas.style.cursor =
      "crosshair";

  } else {

    drawingCanvas.style.cursor =
      "crosshair";
  }


  setBoardStatus(
    tool.charAt(0).toUpperCase() +
    tool.slice(1)
  );
}


/* =========================================================
   COLOR
========================================================= */

if (colorPicker) {

  colorPicker.addEventListener(
    "input",
    () => {

      currentColor =
        colorPicker.value;
    }
  );
}


/* =========================================================
   SIZE
========================================================= */

if (sizeSlider) {

  sizeSlider.addEventListener(
    "input",
    () => {

      currentSize =
        Number(sizeSlider.value);

      if (sizeValue) {

        sizeValue.textContent =
          `${currentSize} px`;
      }
    }
  );
}


/* =========================================================
   TOOL BUTTONS
========================================================= */

$("#penTool")?.addEventListener(
  "click",
  () => setTool("pen")
);

$("#markerTool")?.addEventListener(
  "click",
  () => setTool("marker")
);

$("#eraserTool")?.addEventListener(
  "click",
  () => setTool("eraser")
);

$("#textTool")?.addEventListener(
  "click",
  () => setTool("text")
);

$("#shapeTool")?.addEventListener(
  "click",
  () => setTool("shape")
);


/* =========================================================
   POINTER EVENTS
========================================================= */

drawingCanvas.addEventListener(
  "pointerdown",
  handlePointerDown
);

drawingCanvas.addEventListener(
  "pointermove",
  handlePointerMove
);

drawingCanvas.addEventListener(
  "pointerup",
  handlePointerUp
);

drawingCanvas.addEventListener(
  "pointercancel",
  handlePointerUp
);

drawingCanvas.addEventListener(
  "pointerleave",
  (event) => {

    if (
      isDrawing &&
      currentTool !== "shape"
    ) {
      handlePointerUp(event);
    }
  }
);


/* =========================================================
   HISTORY
========================================================= */

function getDrawingSnapshot() {

  return drawingCtx.getImageData(
    0,
    0,
    drawingCanvas.width,
    drawingCanvas.height
  );
}


function saveHistory() {

  clearTimeout(historyTimer);

  historyTimer = setTimeout(() => {

    const snapshot =
      getDrawingSnapshot();

    history =
      history.slice(
        0,
        historyIndex + 1
      );

    history.push(snapshot);

    if (history.length > 30) {
      history.shift();
    }

    historyIndex =
      history.length - 1;

  }, 100);
}


function restoreHistory(index) {

  if (
    index < 0 ||
    index >= history.length
  ) {
    return;
  }

  historyIndex = index;

  drawingCtx.putImageData(
    history[historyIndex],
    0,
    0
  );

  saveCurrentPage();
}


function undo() {

  if (historyIndex <= 0) {

    showToast("Nothing to undo");

    return;
  }

  restoreHistory(
    historyIndex - 1
  );
}


function redo() {

  if (
    historyIndex >=
    history.length - 1
  ) {

    showToast("Nothing to redo");

    return;
  }

  restoreHistory(
    historyIndex + 1
  );
}


$("#undoBtn")?.addEventListener(
  "click",
  undo
);

$("#redoBtn")?.addEventListener(
  "click",
  redo
);


/* =========================================================
   CLEAR BOARD
========================================================= */

function clearBoard() {

  drawingCtx.clearRect(
    0,
    0,
    drawingCanvas.width,
    drawingCanvas.height
  );

  textItems = [];

  renderTextLayer();

  saveCurrentPage();

  saveHistory();

  hideWelcome();

  showToast("Board cleared");
}


$("#clearBtn")?.addEventListener(
  "click",
  clearBoard
);


/* =========================================================
   WELCOME
========================================================= */

function hideWelcome() {

  if (welcomeScreen) {

    welcomeScreen.classList.add(
      "hidden"
    );
  }
}


function showWelcomeIfEmpty() {

  const hasSlide =
    !!slideImageLoaded;

  const hasPDF =
    !!pdfDocument;

  const hasDrawing =
    drawingCanvasHasContent();

  const hasText =
    textItems.length > 0;

  if (
    !hasSlide &&
    !hasPDF &&
    !hasDrawing &&
    !hasText
  ) {

    welcomeScreen?.classList.remove(
      "hidden"
    );

  } else {

    hideWelcome();
  }
}


/* =========================================================
   CANVAS CONTENT CHECK
========================================================= */

function drawingCanvasHasContent() {

  if (
    !drawingCanvas.width ||
    !drawingCanvas.height
  ) {
    return false;
  }

  try {

    const data =
      drawingCtx.getImageData(
        0,
        0,
        drawingCanvas.width,
        drawingCanvas.height
      ).data;

    for (
      let i = 3;
      i < data.length;
      i += 4
    ) {

      if (data[i] !== 0) {
        return true;
      }
    }

  } catch (error) {

    return false;
  }

  return false;
}


/* =========================================================
   TEXT TOOL
========================================================= */

function createTextAt(x, y) {

  const text =
    window.prompt(
      "Enter your board text:"
    );

  if (!text || !text.trim()) {
    return;
  }

  const item = {

    id:
      Date.now() +
      Math.random(),

    text:
      text.trim(),

    x,
    y,

    size:
      Math.max(
        18,
        currentSize * 4
      ),

    color:
      currentColor
  };

  textItems.push(item);

  renderTextLayer();

  saveCurrentPage();

  hideWelcome();

  showToast("Text added");
}


drawingCanvas.addEventListener(
  "click",
  (event) => {

    if (currentTool !== "text") {
      return;
    }

    const point =
      getCanvasPoint(event);

    createTextAt(
      point.x,
      point.y
    );
  }
);


/* =========================================================
   RENDER TEXT
========================================================= */

function renderTextLayer() {

  if (!textLayer) return;

  textLayer.innerHTML = "";

  textItems.forEach((item) => {

    const element =
      document.createElement("div");

    element.className =
      "text-item";

    element.textContent =
      item.text;

    element.style.left =
      `${item.x}px`;

    element.style.top =
      `${item.y}px`;

    element.style.fontSize =
      `${item.size}px`;

    element.style.color =
      item.color;

    element.dataset.id =
      item.id;

    textLayer.appendChild(
      element
    );


    element.addEventListener(
      "pointerdown",
      (event) => {

        event.stopPropagation();

        draggedText = item;

        const rect =
          element.getBoundingClientRect();

        textDragOffsetX =
          event.clientX -
          rect.left;

        textDragOffsetY =
          event.clientY -
          rect.top;

        element.setPointerCapture(
          event.pointerId
        );
      }
    );


    element.addEventListener(
      "pointermove",
      (event) => {

        if (!draggedText) return;

        const stageRect =
          boardStage.getBoundingClientRect();

        draggedText.x =
          event.clientX -
          stageRect.left -
          textDragOffsetX;

        draggedText.y =
          event.clientY -
          stageRect.top -
          textDragOffsetY;

        element.style.left =
          `${draggedText.x}px`;

        element.style.top =
          `${draggedText.y}px`;
      }
    );


    element.addEventListener(
      "pointerup",
      () => {

        draggedText = null;

        saveCurrentPage();
      }
    );
  });
}


/* =========================================================
   IMAGE UPLOAD
========================================================= */

$("#imageBtn")?.addEventListener(
  "click",
  () => {

    imageInput?.click();
  }
);


imageInput?.addEventListener(
  "change",
  () => {

    const file =
      imageInput.files?.[0];

    if (!file) return;

    const url =
      URL.createObjectURL(file);

    if (slideObjectUrl) {

      URL.revokeObjectURL(
        slideObjectUrl
      );
    }

    slideObjectUrl = url;

    slideImage.onload = () => {

      slideImageLoaded = true;

      slideLayer.classList.add(
        "visible"
      );

      hideWelcome();

      saveCurrentPage();

      showToast(
        "Image added to board"
      );
    };

    slideImage.src = url;

    imageInput.value = "";
  }
);


/* =========================================================
   PDF OPEN
========================================================= */

$("#pdfBtn")?.addEventListener(
  "click",
  () => {

    pdfInput?.click();
  }
);


pdfInput?.addEventListener(
  "change",
  async () => {

    const file =
      pdfInput.files?.[0];

    if (!file) return;

    if (
      typeof pdfjsLib === "undefined"
    ) {

      showToast(
        "PDF.js could not load"
      );

      return;
    }

    try {

      if (pdfObjectUrl) {

        URL.revokeObjectURL(
          pdfObjectUrl
        );
      }

      pdfObjectUrl =
        URL.createObjectURL(file);

      setBoardStatus(
        "Loading PDF..."
      );

      const loadingTask =
        pdfjsLib.getDocument({
          url: pdfObjectUrl
        });

      pdfDocument =
        await loadingTask.promise;

      pdfPageCount =
        pdfDocument.numPages;

      pdfPageNumber = 1;

      pdfFileName.textContent =
        file.name;

      pdfToolbar.hidden = false;

      await renderPdfPage(
        pdfPageNumber
      );

      hideWelcome();

      setBoardStatus(
        "PDF Ready"
      );

      showToast(
        `${pdfPageCount} PDF page(s) loaded`
      );

    } catch (error) {

      console.error(
        "PDF error:",
        error
      );

      showToast(
        "Could not open PDF"
      );

      pdfDocument = null;
    }

    pdfInput.value = "";
  }
);


/* =========================================================
   PDF PAGE RENDER
========================================================= */

async function renderPdfPage(
  pageNumber
) {

  if (
    !pdfDocument ||
    pdfRendering
  ) {
    return;
  }

  pdfRendering = true;

  try {

    const page =
      await pdfDocument.getPage(
        pageNumber
      );

    const stageRect =
      boardStage.getBoundingClientRect();

    const stageWidth =
      Math.max(
        1,
        stageRect.width
      );

    const stageHeight =
      Math.max(
        1,
        stageRect.height
      );

    const baseViewport =
      page.getViewport({
        scale: 1
      });

    const scale =
      Math.min(
        stageWidth /
          baseViewport.width,
        stageHeight /
          baseViewport.height
      );

    const viewport =
      page.getViewport({
        scale:
          Math.max(
            0.1,
            scale
          )
      });

    pdfCanvas.width =
      Math.floor(
        viewport.width *
        window.devicePixelRatio
      );

    pdfCanvas.height =
      Math.floor(
        viewport.height *
        window.devicePixelRatio
      );

    pdfCanvas.style.width =
      `${viewport.width}px`;

    pdfCanvas.style.height =
      `${viewport.height}px`;

    pdfCanvas.style.left =
      `${(stageWidth - viewport.width) / 2}px`;

    pdfCanvas.style.top =
      `${(stageHeight - viewport.height) / 2}px`;

    pdfCanvas.classList.add(
      "visible"
    );

    pdfCtx.setTransform(
      window.devicePixelRatio,
      0,
      0,
      window.devicePixelRatio,
      0,
      0
    );

    pdfCtx.clearRect(
      0,
      0,
      viewport.width,
      viewport.height
    );

    await page.render({
      canvasContext: pdfCtx,
      viewport
    }).promise;

    pdfPageInfo.textContent =
      `${pageNumber} / ${pdfPageCount}`;

  } catch (error) {

    console.error(
      "PDF render error:",
      error
    );

  } finally {

    pdfRendering = false;
  }
}


/* =========================================================
   PDF NAVIGATION
========================================================= */

$("#pdfPrevBtn")?.addEventListener(
  "click",
  async () => {

    if (
      !pdfDocument ||
      pdfPageNumber <= 1
    ) {
      return;
    }

    pdfPageNumber--;

    await renderPdfPage(
      pdfPageNumber
    );
  }
);


$("#pdfNextBtn")?.addEventListener(
  "click",
  async () => {

    if (
      !pdfDocument ||
      pdfPageNumber >= pdfPageCount
    ) {
      return;
    }

    pdfPageNumber++;

    await renderPdfPage(
      pdfPageNumber
    );
  }
);


$("#pdfCloseBtn")?.addEventListener(
  "click",
  closePdf
);


function closePdf() {

  pdfDocument = null;

  pdfPageNumber = 1;
  pdfPageCount = 0;

  pdfCanvas.classList.remove(
    "visible"
  );

  pdfCtx.clearRect(
    0,
    0,
    pdfCanvas.width,
    pdfCanvas.height
  );

  pdfToolbar.hidden = true;

  if (pdfObjectUrl) {

    URL.revokeObjectURL(
      pdfObjectUrl
    );

    pdfObjectUrl = null;
  }

  showWelcomeIfEmpty();

  setBoardStatus(
    "Ready"
  );
}


/* =========================================================
   SAVE CURRENT PAGE
========================================================= */

function saveCurrentPage() {

  if (!pages[currentPageIndex]) {
    return;
  }

  pages[currentPageIndex].drawingData =
    drawingCanvas.toDataURL(
      "image/png"
    );

  pages[currentPageIndex].textItems =
    JSON.parse(
      JSON.stringify(textItems)
    );

  pages[currentPageIndex].notes =
    notesInput?.value || "";

  if (
    slideImageLoaded &&
    slideImage.src
  ) {

    pages[currentPageIndex].slideData =
      slideImage.src;
  } else {

    pages[currentPageIndex].slideData =
      null;
  }

  savePagesToStorage();
}


/* =========================================================
   RENDER CURRENT PAGE
========================================================= */

function renderCurrentPage() {

  const page =
    pages[currentPageIndex];

  if (!page) return;

  drawingCtx.clearRect(
    0,
    0,
    drawingCanvas.width,
    drawingCanvas.height
  );


  textItems =
    JSON.parse(
      JSON.stringify(
        page.textItems || []
      )
    );


  if (page.drawingData) {

    const image =
      new Image();

    image.onload = () => {

      const rect =
        boardStage.getBoundingClientRect();

      drawingCtx.clearRect(
        0,
        0,
        drawingCanvas.width,
        drawingCanvas.height
      );

      drawingCtx.drawImage(
        image,
        0,
        0,
        rect.width,
        rect.height
      );
    };

    image.src =
      page.drawingData;
  }


  renderTextLayer();


  if (page.notes !== undefined) {

    if (notesInput) {
      notesInput.value =
        page.notes;
    }
  }


  if (page.slideData) {

    slideImage.onload = () => {

      slideImageLoaded = true;

      slideLayer.classList.add(
        "visible"
      );
    };

    slideImage.src =
      page.slideData;

  } else {

    slideImageLoaded = false;

    slideImage.removeAttribute(
      "src"
    );

    slideLayer.classList.remove(
      "visible"
    );
  }


  renderPageList();

  showWelcomeIfEmpty();
}


/* =========================================================
   PAGE STORAGE
========================================================= */

const PAGE_STORAGE_KEY =
  "snkSmartBoardPages";


function savePagesToStorage() {

  try {

    const data = {
      pages,
      currentPageIndex
    };

    localStorage.setItem(
      PAGE_STORAGE_KEY,
      JSON.stringify(data)
    );

  } catch (error) {

    console.warn(
      "Could not save pages",
      error
    );
  }
}


function loadPagesFromStorage() {

  try {

    const raw =
      localStorage.getItem(
        PAGE_STORAGE_KEY
      );

    if (!raw) return;

    const data =
      JSON.parse(raw);

    if (
      data &&
      Array.isArray(data.pages) &&
      data.pages.length
    ) {

      pages =
        data.pages;

      currentPageIndex =
        Math.min(
          Number(
            data.currentPageIndex || 0
          ),
          pages.length - 1
        );
    }

  } catch (error) {

    console.warn(
      "Could not load pages",
      error
    );
  }
}


/* =========================================================
   PAGE LIST
========================================================= */

function renderPageList() {

  if (!pageList) return;

  pageList.innerHTML = "";

  pages.forEach(
    (page, index) => {

      const button =
        document.createElement(
          "button"
        );

      button.type = "button";

      button.className =
        "page-item";

      if (
        index === currentPageIndex
      ) {

        button.classList.add(
          "active"
        );
      }

      button.textContent =
        index + 1;

      button.addEventListener(
        "click",
        () => {

          switchPage(index);
        }
      );

      pageList.appendChild(
        button
      );
    }
  );
}


/* =========================================================
   SWITCH PAGE
========================================================= */

function switchPage(index) {

  if (
    index < 0 ||
    index >= pages.length
  ) {
    return;
  }

  saveCurrentPage();

  currentPageIndex =
    index;

  renderCurrentPage();

  history = [];
  historyIndex = -1;

  setTimeout(() => {
    saveHistory();
  }, 100);

  showToast(
    `Page ${index + 1}`
  );
}


/* =========================================================
   PAGE BUTTONS
========================================================= */

$("#addPageBtn")?.addEventListener(
  "click",
  () => {

    saveCurrentPage();

    pages.push({
      drawingData: null,
      textItems: [],
      notes: "",
      slideData: null
    });

    currentPageIndex =
      pages.length - 1;

    renderCurrentPage();

    history = [];
    historyIndex = -1;

    setTimeout(
      saveHistory,
      100
    );

    showToast(
      "New page added"
    );
  }
);


$("#prevPageBtn")?.addEventListener(
  "click",
  () => {

    switchPage(
      currentPageIndex - 1
    );
  }
);


$("#nextPageBtn")?.addEventListener(
  "click",
  () => {

    switchPage(
      currentPageIndex + 1
    );
  }
);


/* =========================================================
   NOTES
========================================================= */

notesInput?.addEventListener(
  "input",
  () => {

    saveCurrentPage();

    if (notesStatus) {

      notesStatus.textContent =
        "Saving...";
    }

    clearTimeout(
      notesInput._saveTimer
    );

    notesInput._saveTimer =
      setTimeout(() => {

        saveCurrentPage();

        if (notesStatus) {

          notesStatus.textContent =
            "Auto saved";
        }

      }, 500);
  }
);


/* =========================================================
   CAMERA
========================================================= */

$("#cameraBtn")?.addEventListener(
  "click",
  async () => {

    if (cameraEnabled) {

      stopCamera();

    } else {

      await startCamera();
    }
  }
);


/* =========================================================
   START CAMERA
========================================================= */

async function startCamera() {

  try {

    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {

      showToast(
        "Camera is not supported by this browser"
      );

      return;
    }


    cameraStream =
      await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: {
            ideal: 1280
          },
          height: {
            ideal: 720
          }
        },
        audio: false
      });


    mentorVideo.srcObject =
      cameraStream;

    await mentorVideo.play();


    cameraEnabled = true;


    cameraOverlay.hidden = false;

    cameraStatus.textContent =
      "On";

    recordingPanelCamera.textContent =
      "On";


    $("#cameraBtn")?.classList.add(
      "active"
    );


    applyCameraVisuals();

    hideWelcome();

    showToast(
      "Camera turned on"
    );

  } catch (error) {

    console.error(
      "Camera error:",
      error
    );

    showToast(
      "Camera permission was denied"
    );
  }
}


/* =========================================================
   STOP CAMERA
========================================================= */

function stopCamera() {

  if (cameraStream) {

    cameraStream
      .getTracks()
      .forEach(
        (track) => track.stop()
      );
  }

  cameraStream = null;

  mentorVideo.srcObject = null;

  cameraEnabled = false;

  cameraOverlay.hidden = true;

  cameraStatus.textContent =
    "Off";

  recordingPanelCamera.textContent =
    "Off";

  $("#cameraBtn")?.classList.remove(
    "active"
  );
}


$("#cameraCloseBtn")?.addEventListener(
  "click",
  stopCamera
);


/* =========================================================
   CAMERA MIRROR
========================================================= */

$("#cameraMirrorBtn")?.addEventListener(
  "click",
  () => {

    cameraState.mirror =
      !cameraState.mirror;

    applyCameraVisuals();

    showToast(
      cameraState.mirror
        ? "Mirror on"
        : "Mirror off"
    );
  }
);


/* =========================================================
   CAMERA SETTINGS
========================================================= */

cameraShape?.addEventListener(
  "change",
  () => {

    cameraState.shape =
      cameraShape.value;

    applyCameraVisuals();
  }
);


cameraEffect?.addEventListener(
  "change",
  () => {

    cameraState.effect =
      cameraEffect.value;

    applyCameraVisuals();
  }
);


/* =========================================================
   APPLY CAMERA VISUALS
========================================================= */

function applyCameraVisuals() {

  cameraOverlay.classList.remove(
    "shape-rectangle",
    "shape-rounded",
    "shape-circle"
  );


  cameraOverlay.classList.add(
    `shape-${cameraState.shape}`
  );


  mentorVideo.classList.toggle(
    "soft-blur",
    cameraState.effect ===
      "soft-blur"
  );


  mentorVideo.style.transform =
    cameraState.mirror
      ? "scaleX(-1)"
      : "scaleX(1)";
}


/* =========================================================
   CAMERA DRAG
========================================================= */

cameraOverlay.addEventListener(
  "pointerdown",
  (event) => {

    if (
      event.target ===
      cameraResizeHandle ||
      event.target.closest(
        "button"
      )
    ) {
      return;
    }

    cameraDragging = true;

    cameraDragStartX =
      event.clientX;

    cameraDragStartY =
      event.clientY;


    const stageRect =
      boardStage.getBoundingClientRect();

    const cameraRect =
      cameraOverlay.getBoundingClientRect();


    cameraOriginalX =
      cameraRect.left -
      stageRect.left;

    cameraOriginalY =
      cameraRect.top -
      stageRect.top;


    cameraOverlay.setPointerCapture(
      event.pointerId
    );

    event.preventDefault();
  }
);


cameraOverlay.addEventListener(
  "pointermove",
  (event) => {

    if (!cameraDragging) {
      return;
    }


    const stageRect =
      boardStage.getBoundingClientRect();


    const dx =
      event.clientX -
      cameraDragStartX;

    const dy =
      event.clientY -
      cameraDragStartY;


    let newX =
      cameraOriginalX + dx;

    let newY =
      cameraOriginalY + dy;


    const cameraWidth =
      cameraOverlay.offsetWidth;

    const cameraHeight =
      cameraOverlay.offsetHeight;


    newX =
      Math.max(
        0,
        Math.min(
          newX,
          stageRect.width -
          cameraWidth
        )
      );


    newY =
      Math.max(
        0,
        Math.min(
          newY,
          stageRect.height -
          cameraHeight
        )
      );


    cameraOverlay.style.left =
      `${newX}px`;

    cameraOverlay.style.top =
      `${newY}px`;

    cameraOverlay.style.right =
      "auto";

    cameraState.x =
      newX /
      stageRect.width;

    cameraState.y =
      newY /
      stageRect.height;
  }
);


cameraOverlay.addEventListener(
  "pointerup",
  (event) => {

    if (!cameraDragging) {
      return;
    }

    cameraDragging = false;

    try {

      cameraOverlay.releasePointerCapture(
        event.pointerId
      );

    } catch (error) {
      /* ignore */
    }
  }
);


/* =========================================================
   CAMERA RESIZE
========================================================= */

cameraResizeHandle.addEventListener(
  "pointerdown",
  (event) => {

    cameraResizing = true;

    cameraResizeStartX =
      event.clientX;

    cameraResizeStartY =
      event.clientY;


    const stageRect =
      boardStage.getBoundingClientRect();

    const cameraRect =
      cameraOverlay.getBoundingClientRect();


    cameraOriginalWidth =
      cameraRect.width;

    cameraOriginalHeight =
      cameraRect.height;

    cameraOriginalLeft =
      cameraRect.left -
      stageRect.left;

    cameraOriginalTop =
      cameraRect.top -
      stageRect.top;


    cameraResizeHandle.setPointerCapture(
      event.pointerId
    );

    event.stopPropagation();

    event.preventDefault();
  }
);


cameraResizeHandle.addEventListener(
  "pointermove",
  (event) => {

    if (!cameraResizing) {
      return;
    }


    const stageRect =
      boardStage.getBoundingClientRect();


    const dx =
      event.clientX -
      cameraResizeStartX;


    const aspect =
      cameraState.shape ===
      "circle"
        ? 1
        : 16 / 9;


    let newWidth =
      cameraOriginalWidth + dx;


    const minWidth =
      130;


    const maxWidth =
      stageRect.width * 0.65;


    newWidth =
      Math.max(
        minWidth,
        Math.min(
          maxWidth,
          newWidth
        )
      );


    let newHeight =
      newWidth / aspect;


    if (
      cameraState.shape ===
      "circle"
    ) {
      newHeight = newWidth;
    }


    const maxHeight =
      stageRect.height * 0.75;


    if (newHeight > maxHeight) {

      newHeight =
        maxHeight;

      newWidth =
        newHeight *
        aspect;
    }


    let left =
      cameraOriginalLeft;

    let top =
      cameraOriginalTop;


    if (
      left + newWidth >
      stageRect.width
    ) {

      left =
        stageRect.width -
        newWidth;
    }


    if (
      top + newHeight >
      stageRect.height
    ) {

      top =
        stageRect.height -
        newHeight;
    }


    cameraOverlay.style.width =
      `${newWidth}px`;

    cameraOverlay.style.height =
      `${newHeight}px`;

    cameraOverlay.style.left =
      `${Math.max(0, left)}px`;

    cameraOverlay.style.top =
      `${Math.max(0, top)}px`;

    cameraOverlay.style.right =
      "auto";


    cameraState.width =
      newWidth /
      stageRect.width;

    cameraState.height =
      newHeight /
      stageRect.height;

    cameraState.x =
      Math.max(
        0,
        left
      ) /
      stageRect.width;

    cameraState.y =
      Math.max(
        0,
        top
      ) /
      stageRect.height;
  }
);


cameraResizeHandle.addEventListener(
  "pointerup",
  (event) => {

    cameraResizing = false;

    try {

      cameraResizeHandle.releasePointerCapture(
        event.pointerId
      );

    } catch (error) {
      /* ignore */
    }

    event.stopPropagation();
  }
);


/* =========================================================
   RESTORE CAMERA POSITION
========================================================= */

function restoreCameraPosition() {

  const stageWidth =
    boardStage.clientWidth;

  const stageHeight =
    boardStage.clientHeight;


  const width =
    Math.max(
      130,
      stageWidth *
      cameraState.width
    );


  let height =
    cameraState.shape === "circle"
      ? width
      : width * 9 / 16;


  let left =
    stageWidth *
    cameraState.x;


  let top =
    stageHeight *
    cameraState.y;


  left =
    Math.max(
      0,
      Math.min(
        left,
        stageWidth - width
      )
    );


  top =
    Math.max(
      0,
      Math.min(
        top,
        stageHeight - height
      )
    );


  cameraOverlay.style.width =
    `${width}px`;

  cameraOverlay.style.height =
    `${height}px`;

  cameraOverlay.style.left =
    `${left}px`;

  cameraOverlay.style.top =
    `${top}px`;

  cameraOverlay.style.right =
    "auto";
}


window.addEventListener(
  "resize",
  () => {

    if (cameraEnabled) {

      restoreCameraPosition();
    }
  }
);


/* =========================================================
   MICROPHONE
========================================================= */

$("#micBtn")?.addEventListener(
  "click",
  async () => {

    if (micEnabled) {

      disableMicrophone();

    } else {

      await enableMicrophone();
    }
  }
);


/* =========================================================
   ENABLE MICROPHONE
========================================================= */

async function enableMicrophone() {

  try {

    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {

      showToast(
        "Microphone is not supported"
      );

      return;
    }


    micStream =
      await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });


    micEnabled = true;

    micStatus.textContent =
      "On";

    recordingPanelMic.textContent =
      "On";


    $("#micBtn")?.classList.add(
      "active"
    );


    showToast(
      "Microphone turned on"
    );

  } catch (error) {

    console.error(
      "Microphone error:",
      error
    );

    showToast(
      "Microphone permission was denied"
    );
  }
}


/* =========================================================
   DISABLE MICROPHONE
========================================================= */

function disableMicrophone() {

  if (micStream) {

    micStream
      .getTracks()
      .forEach(
        (track) => track.stop()
      );
  }

  micStream = null;

  micEnabled = false;

  micStatus.textContent =
    "Off";

  recordingPanelMic.textContent =
    "Off";

  $("#micBtn")?.classList.remove(
    "active"
  );
}


/* =========================================================
   RECORDING CANVAS
========================================================= */

function createRecordCanvas() {

  if (!recordCanvas) {

    recordCanvas =
      document.createElement(
        "canvas"
      );

    recordCtx =
      recordCanvas.getContext(
        "2d"
      );
  }


  recordCanvas.width =
    1280;

  recordCanvas.height =
    720;
}


/* =========================================================
   CONTAIN RECTANGLE
========================================================= */

function getContainRect(
  sourceWidth,
  sourceHeight,
  targetWidth,
  targetHeight
) {

  const sourceRatio =
    sourceWidth /
    sourceHeight;

  const targetRatio =
    targetWidth /
    targetHeight;


  let width;
  let height;


  if (
    sourceRatio >
    targetRatio
  ) {

    width =
      targetWidth;

    height =
      width /
      sourceRatio;

  } else {

    height =
      targetHeight;

    width =
      height *
      sourceRatio;
  }


  return {
    x:
      (targetWidth - width) / 2,

    y:
      (targetHeight - height) / 2,

    width,
    height
  };
}


/* =========================================================
   DRAW BASE SLIDE
========================================================= */

function drawRecordingBackground() {

  recordCtx.fillStyle =
    "#ffffff";

  recordCtx.fillRect(
    0,
    0,
    recordCanvas.width,
    recordCanvas.height
  );


  /*
     PDF gets priority when active.
  */

  if (
    pdfDocument &&
    pdfCanvas.classList.contains(
      "visible"
    ) &&
    pdfCanvas.width > 0 &&
    pdfCanvas.height > 0
  ) {

    const rect =
      getContainRect(
        pdfCanvas.width,
        pdfCanvas.height,
        recordCanvas.width,
        recordCanvas.height
      );


    recordCtx.drawImage(
      pdfCanvas,
      rect.x,
      rect.y,
      rect.width,
      rect.height
    );

    return;
  }


  /*
     Otherwise use image slide.
  */

  if (
    slideImageLoaded &&
    slideImage.complete &&
    slideImage.naturalWidth > 0
  ) {

    const rect =
      getContainRect(
        slideImage.naturalWidth,
        slideImage.naturalHeight,
        recordCanvas.width,
        recordCanvas.height
      );


    recordCtx.drawImage(
      slideImage,
      rect.x,
      rect.y,
      rect.width,
      rect.height
    );
  }
}


/* =========================================================
   DRAW BOARD
========================================================= */

function drawRecordingBoard() {

  const stageRect =
    boardStage.getBoundingClientRect();


  if (
    drawingCanvas.width <= 0 ||
    drawingCanvas.height <= 0
  ) {
    return;
  }


  recordCtx.drawImage(
    drawingCanvas,
    0,
    0,
    recordCanvas.width,
    recordCanvas.height
  );


  /*
     Draw text items
  */

  textItems.forEach(
    (item) => {

      const scaleX =
        recordCanvas.width /
        stageRect.width;

      const scaleY =
        recordCanvas.height /
        stageRect.height;


      recordCtx.save();

      recordCtx.fillStyle =
        item.color || "#1565c0";

      recordCtx.font =
        `600 ${item.size * scaleY}px Inter, Arial, sans-serif`;

      recordCtx.textBaseline =
        "top";


      const lines =
        String(item.text)
          .split("\n");


      lines.forEach(
        (line, index) => {

          recordCtx.fillText(
            line,
            item.x * scaleX,
            (
              item.y +
              index *
              item.size *
              1.25
            ) * scaleY
          );
        }
      );


      recordCtx.restore();
    }
  );
}


/* =========================================================
   ROUNDED CAMERA PATH
========================================================= */

function roundedRectPath(
  ctx,
  x,
  y,
  width,
  height,
  radius
) {

  const r =
    Math.min(
      radius,
      width / 2,
      height / 2
    );


  ctx.beginPath();

  ctx.moveTo(
    x + r,
    y
  );

  ctx.lineTo(
    x + width - r,
    y
  );

  ctx.quadraticCurveTo(
    x + width,
    y,
    x + width,
    y + r
  );

  ctx.lineTo(
    x + width,
    y + height - r
  );

  ctx.quadraticCurveTo(
    x + width,
    y + height,
    x + width - r,
    y + height
  );

  ctx.lineTo(
    x + r,
    y + height
  );

  ctx.quadraticCurveTo(
    x,
    y + height,
    x,
    y + height - r
  );

  ctx.lineTo(
    x,
    y + r
  );

  ctx.quadraticCurveTo(
    x,
    y,
    x + r,
    y
  );

  ctx.closePath();
}


/* =========================================================
   DRAW CAMERA TO RECORDING
========================================================= */

function drawRecordingCamera() {

  if (
    !cameraEnabled ||
    !cameraStream ||
    !mentorVideo ||
    mentorVideo.readyState < 2
  ) {
    return;
  }


  const stageRect =
    boardStage.getBoundingClientRect();


  const x =
    cameraState.x *
    recordCanvas.width;


  const y =
    cameraState.y *
    recordCanvas.height;


  const width =
    cameraState.width *
    recordCanvas.width;


  const height =
    cameraState.shape === "circle"
      ? width
      : width * 9 / 16;


  recordCtx.save();


  /*
     Clip camera shape.
  */

  if (
    cameraState.shape ===
    "circle"
  ) {

    recordCtx.beginPath();

    recordCtx.arc(
      x + width / 2,
      y + height / 2,
      Math.min(
        width,
        height
      ) / 2,
      0,
      Math.PI * 2
    );

    recordCtx.clip();

  } else if (
    cameraState.shape ===
    "rounded"
  ) {

    roundedRectPath(
      recordCtx,
      x,
      y,
      width,
      height,
      24
    );

    recordCtx.clip();

  } else {

    recordCtx.beginPath();

    recordCtx.rect(
      x,
      y,
      width,
      height
    );

    recordCtx.clip();
  }


  /*
     Mirror camera if enabled.
  */

  if (cameraState.mirror) {

    recordCtx.translate(
      x + width,
      y
    );

    recordCtx.scale(
      -1,
      1
    );

    recordCtx.drawImage(
      mentorVideo,
      0,
      0,
      width,
      height
    );

  } else {

    recordCtx.drawImage(
      mentorVideo,
      x,
      y,
      width,
      height
    );
  }


  recordCtx.restore();


  /*
     Camera border
  */

  recordCtx.save();

  recordCtx.strokeStyle =
    "rgba(255,255,255,0.95)";

  recordCtx.lineWidth =
    3;


  if (
    cameraState.shape ===
    "circle"
  ) {

    recordCtx.beginPath();

    recordCtx.arc(
      x + width / 2,
      y + height / 2,
      Math.min(
        width,
        height
      ) / 2 - 1.5,
      0,
      Math.PI * 2
    );

    recordCtx.stroke();

  } else if (
    cameraState.shape ===
    "rounded"
  ) {

    roundedRectPath(
      recordCtx,
      x,
      y,
      width,
      height,
      24
    );

    recordCtx.stroke();

  } else {

    recordCtx.strokeRect(
      x,
      y,
      width,
      height
    );
  }


  recordCtx.restore();
}


/* =========================================================
   RECORDING FRAME
========================================================= */

function renderRecordingFrame() {

  if (!recordCtx) {
    return;
  }


  recordCtx.clearRect(
    0,
    0,
    recordCanvas.width,
    recordCanvas.height
  );


  drawRecordingBackground();

  drawRecordingBoard();

  drawRecordingCamera();


  /*
     Continue while recording.
  */

  if (isRecording) {

    recordingRenderFrame =
      requestAnimationFrame(
        renderRecordingFrame
      );
  }
}


/* =========================================================
   MIME TYPE
========================================================= */

function getSupportedMimeType() {

  const types = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm"
  ];


  for (
    const type of types
  ) {

    if (
      typeof MediaRecorder !==
        "undefined" &&
      MediaRecorder.isTypeSupported(
        type
      )
    ) {

      return type;
    }
  }


  return "";
}


/* =========================================================
   OPEN RECORDING PANEL
========================================================= */

$("#recordBtn")?.addEventListener(
  "click",
  () => {

    if (recordingPanel) {

      recordingPanel.hidden = false;
    }
  }
);


$("#closeRecordingPanelBtn")
  ?.addEventListener(
    "click",
    () => {

      if (
        isRecording
      ) {

        showToast(
          "Stop recording before closing"
        );

        return;
      }

      recordingPanel.hidden = true;
    }
  );


/* =========================================================
   START RECORDING
========================================================= */

$("#startRecordingBtn")
  ?.addEventListener(
    "click",
    startRecording
  );


async function startRecording() {

  if (isRecording) {
    return;
  }


  /*
     Ask microphone if not enabled.
  */

  if (!micEnabled) {

    await enableMicrophone();

    if (!micEnabled) {

      showToast(
        "Microphone is required for voice recording"
      );

      return;
    }
  }


  if (
    typeof MediaRecorder ===
    "undefined"
  ) {

    showToast(
      "MediaRecorder is not supported"
    );

    return;
  }


  createRecordCanvas();


  /*
     Canvas video stream.
  */

  const canvasStream =
    recordCanvas.captureStream(
      30
    );


  /*
     Create recording stream.
  */

  recordingStream =
    new MediaStream();


  canvasStream
    .getVideoTracks()
    .forEach(
      (track) => {

        recordingStream.addTrack(
          track
        );
      }
    );


  /*
     Add microphone only.
     Camera is already drawn into canvas.
  */

  if (micStream) {

    micStream
      .getAudioTracks()
      .forEach(
        (track) => {

          recordingStream.addTrack(
            track
          );
        }
      );
  }


  recordingMimeType =
    getSupportedMimeType();


  try {

    mediaRecorder =
      recordingMimeType
        ? new MediaRecorder(
            recordingStream,
            {
              mimeType:
                recordingMimeType
            }
          )
        : new MediaRecorder(
            recordingStream
          );

  } catch (error) {

    console.error(
      "MediaRecorder creation failed:",
      error
    );

    showToast(
      "Could not start recorder"
    );

    return;
  }


  recordingChunks = [];


  mediaRecorder.ondataavailable =
    (event) => {

      if (
        event.data &&
        event.data.size > 0
      ) {

        recordingChunks.push(
          event.data
        );
      }
    };


  mediaRecorder.onerror =
    (event) => {

      console.error(
        "MediaRecorder error:",
        event
      );

      showToast(
        "Recording error occurred"
      );
    };


  mediaRecorder.onstop =
    finishRecording;


  isRecording = true;

  isPaused = false;

  recordingStartedAt =
    Date.now();

  recordingPausedAt = 0;

  recordingElapsedBeforePause =
    0;


  mediaRecorder.start(
    1000
  );


  recordingIndicator.hidden =
    false;


  recordingStatus.textContent =
    "Recording";


  recordingPanelStatus.textContent =
    "Recording";


  $("#startRecordingBtn").disabled =
    true;

  $("#pauseRecordingBtn").disabled =
    false;

  $("#resumeRecordingBtn").disabled =
    true;

  $("#stopRecordingBtn").disabled =
    false;


  startRecordingTimer();

  renderRecordingFrame();


  setBoardStatus(
    "Recording..."
  );


  showToast(
    "Class recording started"
  );
}


/* =========================================================
   PAUSE RECORDING
========================================================= */

$("#pauseRecordingBtn")
  ?.addEventListener(
    "click",
    pauseRecording
  );


function pauseRecording() {

  if (
    !mediaRecorder ||
    mediaRecorder.state !==
      "recording"
  ) {
    return;
  }


  mediaRecorder.pause();

  isPaused = true;

  recordingPausedAt =
    Date.now();


  recordingStatus.textContent =
    "Paused";

  recordingPanelStatus.textContent =
    "Paused";


  $("#pauseRecordingBtn").disabled =
    true;

  $("#resumeRecordingBtn").disabled =
    false;


  stopRecordingTimer();

  showToast(
    "Recording paused"
  );
}


/* =========================================================
   RESUME RECORDING
========================================================= */

$("#resumeRecordingBtn")
  ?.addEventListener(
    "click",
    resumeRecording
  );


function resumeRecording() {

  if (
    !mediaRecorder ||
    mediaRecorder.state !==
      "paused"
  ) {
    return;
  }


  recordingElapsedBeforePause +=
    Date.now() -
    recordingPausedAt;


  mediaRecorder.resume();

  isPaused = false;


  recordingStatus.textContent =
    "Recording";

  recordingPanelStatus.textContent =
    "Recording";


  $("#pauseRecordingBtn").disabled =
    false;

  $("#resumeRecordingBtn").disabled =
    true;


  startRecordingTimer();

  showToast(
    "Recording resumed"
  );
}


/* =========================================================
   STOP RECORDING
========================================================= */

$("#stopRecordingBtn")
  ?.addEventListener(
    "click",
    stopRecording
  );


function stopRecording() {

  if (!mediaRecorder) {
    return;
  }


  if (
    mediaRecorder.state ===
    "inactive"
  ) {
    return;
  }


  mediaRecorder.stop();

  isRecording = false;

  isPaused = false;


  if (recordingRenderFrame) {

    cancelAnimationFrame(
      recordingRenderFrame
    );

    recordingRenderFrame =
      null;
  }


  stopRecordingTimer();


  recordingIndicator.hidden =
    true;


  recordingStatus.textContent =
    "Processing...";

  recordingPanelStatus.textContent =
    "Processing";


  $("#pauseRecordingBtn").disabled =
    true;

  $("#resumeRecordingBtn").disabled =
    true;

  $("#stopRecordingBtn").disabled =
    true;


  setBoardStatus(
    "Processing recording..."
  );
}


/* =========================================================
   FINISH RECORDING
========================================================= */

function finishRecording() {

  const blobType =
    recordingMimeType ||
    "video/webm";


  recordingBlob =
    new Blob(
      recordingChunks,
      {
        type: blobType
      }
    );


  if (recordingUrl) {

    URL.revokeObjectURL(
      recordingUrl
    );
  }


  recordingUrl =
    URL.createObjectURL(
      recordingBlob
    );


  recordedVideo.src =
    recordingUrl;


  recordedVideoArea.hidden =
    false;


  recordingStatus.textContent =
    "Ready";

  recordingPanelStatus.textContent =
    "Ready";


  $("#startRecordingBtn").disabled =
    false;


  $("#stopRecordingBtn").disabled =
    true;


  setBoardStatus(
    "Recording ready"
  );


  showToast(
    "Recording finished"
  );


  /*
     Stop only the temporary canvas
     video track. Keep camera and mic
     available for the user.
  */

  if (recordingStream) {

    recordingStream
      .getVideoTracks()
      .forEach(
        (track) => track.stop()
      );
  }

  recordingStream = null;

  mediaRecorder = null;
}


/* =========================================================
   RECORDING TIMER
========================================================= */

function startRecordingTimer() {

  stopRecordingTimer();

  recordingTimerInterval =
    setInterval(
      updateRecordingTimer,
      250
    );

  updateRecordingTimer();
}


function stopRecordingTimer() {

  if (
    recordingTimerInterval
  ) {

    clearInterval(
      recordingTimerInterval
    );

    recordingTimerInterval =
      null;
  }
}


function updateRecordingTimer() {

  if (!isRecording) {
    return;
  }


  let elapsed;


  if (isPaused) {

    elapsed =
      recordingPausedAt -
      recordingStartedAt -
      recordingElapsedBeforePause;

  } else {

    elapsed =
      Date.now() -
      recordingStartedAt -
      recordingElapsedBeforePause;
  }


  elapsed =
    Math.max(
      0,
      elapsed
    );


  const totalSeconds =
    Math.floor(
      elapsed / 1000
    );


  const hours =
    Math.floor(
      totalSeconds / 3600
    );


  const minutes =
    Math.floor(
      (totalSeconds % 3600) /
      60
    );


  const seconds =
    totalSeconds % 60;


  let formatted;


  if (hours > 0) {

    formatted =
      `${String(hours).padStart(2, "0")}:` +
      `${String(minutes).padStart(2, "0")}:` +
      `${String(seconds).padStart(2, "0")}`;

  } else {

    formatted =
      `${String(minutes).padStart(2, "0")}:` +
      `${String(seconds).padStart(2, "0")}`;
  }


  if (recordingTimer) {

    recordingTimer.textContent =
      formatted;
  }


  if (recordingPanelTimer) {

    recordingPanelTimer.textContent =
      formatted;
  }
}


/* =========================================================
   DOWNLOAD RECORDING
========================================================= */

downloadRecordingBtn?.addEventListener(
  "click",
  () => {

    if (!recordingUrl) {

      showToast(
        "No recording available"
      );

      return;
    }


    const link =
      document.createElement(
        "a"
      );

    link.href =
      recordingUrl;

    link.download =
      `SNK-Smart-Board-Class-${formatFileDate()}.webm`;

    document.body.appendChild(
      link
    );

    link.click();

    link.remove();

    showToast(
      "Recording download started"
    );
  }
);


/* =========================================================
   FILE DATE
========================================================= */

function formatFileDate() {

  const date =
    new Date();

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      date.getDate()
    ).padStart(2, "0");

  const hour =
    String(
      date.getHours()
    ).padStart(2, "0");

  const minute =
    String(
      date.getMinutes()
    ).padStart(2, "0");


  return (
    `${year}-${month}-${day}-${hour}${minute}`
  );
}


/* =========================================================
   SAVE COMPOSITE PNG
========================================================= */

$("#saveBtn")?.addEventListener(
  "click",
  saveCompositePNG
);


async function saveCompositePNG() {

  createRecordCanvas();

  renderRecordingFrameOnce();


  const link =
    document.createElement(
      "a"
    );

  link.download =
    `SNK-Smart-Board-${formatFileDate()}.png`;

  link.href =
    recordCanvas.toDataURL(
      "image/png"
    );

  document.body.appendChild(
    link
  );

  link.click();

  link.remove();

  showToast(
    "Board image saved"
  );
}


function renderRecordingFrameOnce() {

  recordCtx.fillStyle =
    "#ffffff";

  recordCtx.fillRect(
    0,
    0,
    recordCanvas.width,
    recordCanvas.height
  );


  drawRecordingBackground();

  drawRecordingBoard();

  drawRecordingCamera();
}


/* =========================================================
   NEW BOARD
========================================================= */

$("#newBoardBtn")?.addEventListener(
  "click",
  () => {

    const confirmed =
      window.confirm(
        "Create a new Smart Board? Current board will be cleared."
      );

    if (!confirmed) {
      return;
    }


    pages = [
      {
        drawingData: null,
        textItems: [],
        notes: "",
        slideData: null
      }
    ];


    currentPageIndex = 0;

    textItems = [];

    drawingCtx.clearRect(
      0,
      0,
      drawingCanvas.width,
      drawingCanvas.height
    );


    slideImageLoaded =
      false;

    slideImage.removeAttribute(
      "src"
    );

    slideLayer.classList.remove(
      "visible"
    );


    closePdf();


    if (notesInput) {
      notesInput.value = "";
    }


    history = [];
    historyIndex = -1;


    savePagesToStorage();

    renderPageList();

    setTimeout(
      saveHistory,
      100
    );


    showWelcomeIfEmpty();

    showToast(
      "New board created"
    );
  }
);


/* =========================================================
   FULLSCREEN
========================================================= */

$("#fullscreenBtn")
  ?.addEventListener(
    "click",
    async () => {

      try {

        if (
          !document.fullscreenElement
        ) {

          await app.requestFullscreen();

        } else {

          await document.exitFullscreen();
        }

      } catch (error) {

        console.error(
          "Fullscreen error:",
          error
        );
      }
    }
  );


/* =========================================================
   ZOOM
========================================================= */

function applyZoom() {

  boardZoom =
    Math.max(
      0.6,
      Math.min(
        1.5,
        boardZoom
      )
    );


  boardStage.style.transform =
    `scale(${boardZoom})`;


  $("#zoomValue").textContent =
    `${Math.round(boardZoom * 100)}%`;
}


$("#zoomInBtn")?.addEventListener(
  "click",
  () => {

    boardZoom += 0.1;

    applyZoom();
  }
);


$("#zoomOutBtn")?.addEventListener(
  "click",
  () => {

    boardZoom -= 0.1;

    applyZoom();
  }
);


$("#resetZoomBtn")?.addEventListener(
  "click",
  () => {

    boardZoom = 1;

    applyZoom();
  }
);


/* =========================================================
   KEYBOARD SHORTCUTS
========================================================= */

document.addEventListener(
  "keydown",
  (event) => {

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
        cameraSettings &&
        !cameraSettings.hidden
      ) {

        cameraSettings.hidden =
          true;
      }
    }
  }
);


/* =========================================================
   CAMERA SETTINGS TOGGLE
========================================================= */

cameraOverlay.addEventListener(
  "dblclick",
  () => {

    if (cameraSettings) {

      cameraSettings.hidden =
        !cameraSettings.hidden;
    }
  }
);


/* =========================================================
   MEDIA PERMISSION MODAL
========================================================= */

$("#allowMediaBtn")
  ?.addEventListener(
    "click",
    async () => {

      $("#permissionModal").hidden =
        true;

      await enableMicrophone();

      await startCamera();
    }
  );


$("#cancelMediaBtn")
  ?.addEventListener(
    "click",
    () => {

      $("#permissionModal").hidden =
        true;
    }
  );


/* =========================================================
   INITIALIZE
========================================================= */

function initializeSmartBoard() {

  loadPagesFromStorage();

  resizeDrawingCanvas();

  renderPageList();

  renderCurrentPage();

  applyZoom();

  setTool("pen");


  if (sizeValue) {

    sizeValue.textContent =
      `${currentSize} px`;
  }


  if (cameraShape) {

    cameraShape.value =
      cameraState.shape;
  }


  if (cameraEffect) {

    cameraEffect.value =
      cameraState.effect;
  }


  /*
     Camera starts OFF.
     Microphone starts OFF.
     Browser permission is requested
     only when the user clicks the controls.
  */

  cameraStatus.textContent =
    "Off";

  micStatus.textContent =
    "Off";

  recordingStatus.textContent =
    "Ready";


  recordingPanelCamera.textContent =
    "Off";

  recordingPanelMic.textContent =
    "Off";


  showWelcomeIfEmpty();


  setTimeout(
    () => {

      saveHistory();

    },
    250
  );


  setBoardStatus(
    "Ready"
  );
}


/* =========================================================
   CLEANUP
========================================================= */

window.addEventListener(
  "beforeunload",
  () => {

    if (cameraStream) {

      cameraStream
        .getTracks()
        .forEach(
          (track) => track.stop()
        );
    }


    if (micStream) {

      micStream
        .getTracks()
        .forEach(
          (track) => track.stop()
        );
    }


    if (recordingStream) {

      recordingStream
        .getTracks()
        .forEach(
          (track) => track.stop()
        );
    }


    if (slideObjectUrl) {

      URL.revokeObjectURL(
        slideObjectUrl
      );
    }


    if (pdfObjectUrl) {

      URL.revokeObjectURL(
        pdfObjectUrl
      );
    }


    if (recordingUrl) {

      URL.revokeObjectURL(
        recordingUrl
      );
    }
  }
);


/* =========================================================
   START
========================================================= */

if (
  document.readyState ===
  "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    initializeSmartBoard
  );

} else {

  initializeSmartBoard();
}
