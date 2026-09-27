/* =========================================================
   SNK SMART BOARD
   STEP 9.3 — FULL SCRIPT.JS

   Features:
   - Smart Board Drawing
   - Pen / Marker / Eraser
   - Undo / Redo
   - Text
   - Shapes
   - Image Upload
   - PDF.js PDF Viewer
   - Multiple Board Pages
   - Notes
   - Camera / Mentor Overlay
   - Camera Drag
   - Camera Resize
   - Camera Shape
   - Camera Effects
   - Mirror Camera
   - Microphone
   - Board + PDF + Camera + Voice Recording
   - Recording Preview
   - WebM Download
========================================================= */


/* =========================================================
   PDF.JS SETUP
========================================================= */

if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}


/* =========================================================
   DOM HELPERS
========================================================= */

const $ = (id) => document.getElementById(id);

const qs = (selector) => document.querySelector(selector);

const qsa = (selector) => document.querySelectorAll(selector);


/* =========================================================
   MAIN ELEMENTS
========================================================= */

const app = $("app");

const boardWrapper = $("boardWrapper");
const boardStage = $("boardStage");

const drawingCanvas = $("drawingCanvas");
const drawingCtx = drawingCanvas.getContext("2d");

const recordCanvas = $("recordCanvas");
const recordCtx = recordCanvas.getContext("2d");

const slideLayer = $("slideLayer");
const slideImage = $("slideImage");

const pdfLayer = $("pdfLayer");
const pdfCanvas = $("pdfCanvas");
const pdfCtx = pdfCanvas.getContext("2d");

const textLayer = $("textLayer");

const welcomeScreen = $("welcomeScreen");

const toast = $("toast");
const toastMessage = $("toastMessage");


/* =========================================================
   TOOL STATE
========================================================= */

let currentTool = "pen";

let currentColor = "#1677ff";

let currentSize = 5;

let isDrawing = false;

let lastX = 0;
let lastY = 0;

let drawingPointerId = null;


/* =========================================================
   SHAPE STATE
========================================================= */

let shapeMode = false;

let shapeStartX = 0;
let shapeStartY = 0;

let shapeSnapshot = null;


/* =========================================================
   HISTORY
========================================================= */

let history = [];

let historyIndex = -1;

let historyTimer = null;


/* =========================================================
   BOARD PAGES
========================================================= */

let pages = [];

let currentPageIndex = 0;


/* =========================================================
   TEXT
========================================================= */

let textItems = [];

let textIdCounter = 1;


/* =========================================================
   IMAGE
========================================================= */

let currentImageData = null;


/* =========================================================
   PDF
========================================================= */

let currentPdf = null;

let currentPdfUrl = null;

let currentPdfPage = 1;

let totalPdfPages = 0;

let pdfScale = 1;


/* =========================================================
   ZOOM
========================================================= */

let zoomLevel = 1;


/* =========================================================
   CAMERA STATE
========================================================= */

let cameraStream = null;

let cameraEnabled = false;

let cameraMirrored = true;

let cameraEffect = "none";

let cameraShape = "rounded";

let cameraBackground = "none";

let cameraMuted = false;


/* Camera position relative to board */

let cameraState = {
  x: 18,
  y: 18,
  width: 230,
  height: 145
};


/* Camera dragging */

let cameraDragging = false;

let cameraDragPointerId = null;

let cameraDragStartX = 0;
let cameraDragStartY = 0;

let cameraStartLeft = 0;
let cameraStartTop = 0;


/* Camera resize */

let cameraResizing = false;

let cameraResizePointerId = null;

let cameraResizeStartX = 0;
let cameraResizeStartY = 0;

let cameraStartWidth = 0;
let cameraStartHeight = 0;


/* =========================================================
   MICROPHONE
========================================================= */

let micStream = null;

let micEnabled = false;


/* =========================================================
   RECORDING
========================================================= */

let mediaRecorder = null;

let recordedChunks = [];

let recordingStream = null;

let recordingVideoTrack = null;

let recordingAudioTrack = null;

let isRecording = false;

let isPaused = false;

let recordingStartedAt = 0;

let recordingPausedAt = 0;

let recordingPausedDuration = 0;

let recordingTimerInterval = null;

let recordingRenderFrame = null;

let recordedBlob = null;

let recordedUrl = null;


/* =========================================================
   INITIALIZE
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

  setupCanvas();

  setupDefaultPage();

  setupTools();

  setupBoardActions();

  setupImageUpload();

  setupPdfUpload();

  setupPages();

  setupTextTool();

  setupCamera();

  setupCameraSettings();

  setupMicrophone();

  setupRecording();

  setupNotes();

  setupZoom();

  setupFullscreen();

  setupKeyboardShortcuts();

  resizeCameraToStage();

  renderCurrentPage();

  setTimeout(() => {
    saveHistory();
  }, 300);

});


/* =========================================================
   TOAST
========================================================= */

let toastTimer = null;

function showToast(message) {

  toastMessage.textContent = message;

  toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}


/* =========================================================
   CANVAS SETUP
========================================================= */

function setupCanvas() {

  resizeCanvas();

  window.addEventListener("resize", () => {

    resizeCanvas();

    resizeCameraToStage();

  });

}


function resizeCanvas() {

  const rect = boardStage.getBoundingClientRect();

  if (!rect.width || !rect.height) {
    return;
  }

  const oldCanvas = document.createElement("canvas");

  oldCanvas.width = drawingCanvas.width;
  oldCanvas.height = drawingCanvas.height;

  const oldCtx = oldCanvas.getContext("2d");

  if (drawingCanvas.width && drawingCanvas.height) {

    oldCtx.drawImage(
      drawingCanvas,
      0,
      0
    );

  }

  const dpr = Math.min(
    window.devicePixelRatio || 1,
    2
  );

  drawingCanvas.width =
    Math.round(rect.width * dpr);

  drawingCanvas.height =
    Math.round(rect.height * dpr);

  drawingCanvas.style.width =
    `${rect.width}px`;

  drawingCanvas.style.height =
    `${rect.height}px`;

  drawingCtx.setTransform(
    dpr,
    0,
    0,
    dpr,
    0,
    0
  );

  drawingCtx.clearRect(
    0,
    0,
    rect.width,
    rect.height
  );

  if (
    oldCanvas.width &&
    oldCanvas.height
  ) {

    drawingCtx.drawImage(
      oldCanvas,
      0,
      0,
      oldCanvas.width,
      oldCanvas.height,
      0,
      0,
      rect.width,
      rect.height
    );

  }

}


/* =========================================================
   DEFAULT PAGE
========================================================= */

function setupDefaultPage() {

  pages = [
    {
      id: createId(),

      drawing: null,

      image: null,

      pdf: null,

      texts: []
    }
  ];

  currentPageIndex = 0;
}


/* =========================================================
   ID
========================================================= */

function createId() {

  return (
    Date.now().toString(36) +
    Math.random()
      .toString(36)
      .slice(2, 7)
  );

}


/* =========================================================
   DRAWING TOOLS
========================================================= */

function setupTools() {

  const toolButtons = [
    ["penTool", "pen"],
    ["markerTool", "marker"],
    ["eraserTool", "eraser"]
  ];

  toolButtons.forEach(([id, tool]) => {

    const button = $(id);

    if (!button) return;

    button.addEventListener("click", () => {

      setTool(tool);

    });

  });


  $("colorPicker").addEventListener(
    "input",
    (event) => {

      currentColor =
        event.target.value;

      if (currentTool === "eraser") {
        setTool("pen");
      }

    }
  );


  $("sizeSlider").addEventListener(
    "input",
    (event) => {

      currentSize =
        Number(event.target.value);

      $("sizeValue").textContent =
        currentSize;

    }
  );


  $("undoBtn").addEventListener(
    "click",
    undo
  );


  $("redoBtn").addEventListener(
    "click",
    redo
  );


  $("clearBtn").addEventListener(
    "click",
    clearDrawing
  );


  setupDrawingEvents();

}


function setTool(tool) {

  currentTool = tool;

  shapeMode = false;

  qsa(".tool-btn").forEach((button) => {
    button.classList.remove("active");
  });


  if (tool === "pen") {
    $("penTool").classList.add("active");

    drawingCanvas.style.cursor =
      "crosshair";
  }


  if (tool === "marker") {
    $("markerTool").classList.add("active");

    drawingCanvas.style.cursor =
      "crosshair";
  }


  if (tool === "eraser") {
    $("eraserTool").classList.add("active");

    drawingCanvas.style.cursor =
      "cell";
  }

}


/* =========================================================
   DRAWING EVENTS
========================================================= */

function setupDrawingEvents() {

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
    handlePointerUp
  );

}


function getCanvasPoint(event) {

  const rect =
    drawingCanvas.getBoundingClientRect();

  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };

}


function handlePointerDown(event) {

  if (currentTool === "text") {
    return;
  }

  if (shapeMode) {
    return;
  }

  isDrawing = true;

  drawingPointerId =
    event.pointerId;

  drawingCanvas.setPointerCapture(
    event.pointerId
  );

  const point =
    getCanvasPoint(event);

  lastX = point.x;
  lastY = point.y;

  drawingCtx.beginPath();

  drawingCtx.moveTo(
    lastX,
    lastY
  );

}


function handlePointerMove(event) {

  if (!isDrawing) {
    return;
  }

  if (
    drawingPointerId !== null &&
    event.pointerId !== drawingPointerId
  ) {
    return;
  }

  const point =
    getCanvasPoint(event);

  drawLine(
    lastX,
    lastY,
    point.x,
    point.y
  );

  lastX = point.x;
  lastY = point.y;

}


function handlePointerUp(event) {

  if (!isDrawing) {
    return;
  }

  isDrawing = false;

  drawingPointerId = null;

  try {
    drawingCanvas.releasePointerCapture(
      event.pointerId
    );
  } catch (error) {
    // Ignore release errors
  }

  drawingCtx.closePath();

  saveHistoryDebounced();

  saveCurrentPageState();

}


function drawLine(
  x1,
  y1,
  x2,
  y2
) {

  drawingCtx.lineCap = "round";
  drawingCtx.lineJoin = "round";

  if (currentTool === "pen") {

    drawingCtx.globalCompositeOperation =
      "source-over";

    drawingCtx.strokeStyle =
      currentColor;

    drawingCtx.globalAlpha = 1;

    drawingCtx.lineWidth =
      currentSize;

  }


  if (currentTool === "marker") {

    drawingCtx.globalCompositeOperation =
      "source-over";

    drawingCtx.strokeStyle =
      currentColor;

    drawingCtx.globalAlpha = 0.28;

    drawingCtx.lineWidth =
      currentSize * 3.2;

  }


  if (currentTool === "eraser") {

    drawingCtx.globalCompositeOperation =
      "destination-out";

    drawingCtx.globalAlpha = 1;

    drawingCtx.lineWidth =
      currentSize * 2.5;

  }


  drawingCtx.beginPath();

  drawingCtx.moveTo(x1, y1);

  drawingCtx.lineTo(x2, y2);

  drawingCtx.stroke();

  drawingCtx.globalCompositeOperation =
    "source-over";

  drawingCtx.globalAlpha = 1;

}


/* =========================================================
   HISTORY
========================================================= */

function saveHistoryDebounced() {

  clearTimeout(historyTimer);

  historyTimer = setTimeout(
    saveHistory,
    250
  );

}


function saveHistory() {

  const snapshot =
    drawingCanvas.toDataURL("image/png");

  if (
    historyIndex >= 0 &&
    history[historyIndex] === snapshot
  ) {
    return;
  }

  history =
    history.slice(
      0,
      historyIndex + 1
    );

  history.push(snapshot);

  if (history.length > 40) {
    history.shift();
  }

  historyIndex =
    history.length - 1;

}


function restoreHistory(snapshot) {

  if (!snapshot) {
    return;
  }

  const image = new Image();

  image.onload = () => {

    const rect =
      boardStage.getBoundingClientRect();

    drawingCtx.clearRect(
      0,
      0,
      rect.width,
      rect.height
    );

    drawingCtx.drawImage(
      image,
      0,
      0,
      rect.width,
      rect.height
    );

    saveCurrentPageState();

  };

  image.src = snapshot;

}


function undo() {

  if (historyIndex <= 0) {

    showToast("Nothing to undo");

    return;
  }

  historyIndex--;

  restoreHistory(
    history[historyIndex]
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

  historyIndex++;

  restoreHistory(
    history[historyIndex]
  );

}


/* =========================================================
   CLEAR
========================================================= */

function clearDrawing() {

  const rect =
    boardStage.getBoundingClientRect();

  drawingCtx.clearRect(
    0,
    0,
    rect.width,
    rect.height
  );

  saveCurrentPageState();

  saveHistory();

  showToast("Board cleared");

}


/* =========================================================
   BOARD ACTIONS
========================================================= */

function setupBoardActions() {

  $("newBoardBtn").addEventListener(
    "click",
    newBoard
  );


  $("saveBoardBtn").addEventListener(
    "click",
    saveBoardAsPNG
  );

}


function newBoard() {

  const confirmed =
    confirm(
      "Create a new Smart Board?"
    );

  if (!confirmed) {
    return;
  }

  pages = [
    {
      id: createId(),

      drawing: null,

      image: null,

      pdf: null,

      texts: []
    }
  ];

  currentPageIndex = 0;

  currentImageData = null;

  currentPdf = null;

  currentPdfUrl = null;

  currentPdfPage = 1;

  totalPdfPages = 0;

  clearBoardVisuals();

  resetHistory();

  renderCurrentPage();

  showToast("New board created");

}


function clearBoardVisuals() {

  const rect =
    boardStage.getBoundingClientRect();

  drawingCtx.clearRect(
    0,
    0,
    rect.width,
    rect.height
  );

  textLayer.innerHTML = "";

  slideImage.removeAttribute("src");

  slideLayer.style.display =
    "none";

  pdfLayer.classList.remove(
    "active"
  );

  $("pdfControls").classList.add(
    "hidden"
  );

}


/* =========================================================
   SAVE PNG
========================================================= */

function saveBoardAsPNG() {

  const width = 1280;
  const height = 720;

  const canvas =
    document.createElement("canvas");

  canvas.width = width;
  canvas.height = height;

  const ctx =
    canvas.getContext("2d");

  drawBoardToCanvas(
    ctx,
    width,
    height,
    false
  );

  const link =
    document.createElement("a");

  link.download =
    `snk-smart-board-${Date.now()}.png`;

  link.href =
    canvas.toDataURL("image/png");

  link.click();

  showToast("Board PNG saved");

}


/* =========================================================
   DRAW COMPLETE BOARD TO CANVAS
========================================================= */

function drawBoardToCanvas(
  ctx,
  width,
  height,
  includeCamera = true
) {

  /* Background */

  ctx.fillStyle = "#ffffff";

  ctx.fillRect(
    0,
    0,
    width,
    height
  );


  /* PDF */

  if (
    pdfLayer.classList.contains("active") &&
    pdfCanvas.width > 0 &&
    pdfCanvas.height > 0
  ) {

    drawContainImage(
      ctx,
      pdfCanvas,
      width,
      height
    );

  }


  /* Image */

  else if (
    slideImage.complete &&
    slideImage.naturalWidth > 0 &&
    slideLayer.style.display !== "none"
  ) {

    drawContainImage(
      ctx,
      slideImage,
      width,
      height
    );

  }


  /* Drawing */

  if (
    drawingCanvas.width > 0 &&
    drawingCanvas.height > 0
  ) {

    ctx.drawImage(
      drawingCanvas,
      0,
      0,
      drawingCanvas.width,
      drawingCanvas.height,
      0,
      0,
      width,
      height
    );

  }


  /* Text */

  drawTextItemsToCanvas(
    ctx,
    width,
    height
  );


  /* Camera */

  if (
    includeCamera &&
    cameraEnabled &&
    $("mentorVideo").readyState >= 2
  ) {

    drawCameraToCanvas(
      ctx,
      width,
      height
    );

  }


  /* Branding */

  ctx.save();

  ctx.fillStyle =
    "rgba(255,255,255,0.86)";

  ctx.fillRect(
    10,
    height - 34,
    122,
    22
  );

  ctx.fillStyle =
    "#6c8197";

  ctx.font =
    "800 10px Arial";

  ctx.fillText(
    "SNK SMART BOARD",
    18,
    height - 19
  );

  ctx.restore();

}


/* =========================================================
   CONTAIN IMAGE
========================================================= */

function drawContainImage(
  ctx,
  source,
  width,
  height
) {

  const sourceWidth =
    source.videoWidth ||
    source.naturalWidth ||
    source.width;

  const sourceHeight =
    source.videoHeight ||
    source.naturalHeight ||
    source.height;

  if (
    !sourceWidth ||
    !sourceHeight
  ) {
    return;
  }

  const ratio =
    Math.min(
      width / sourceWidth,
      height / sourceHeight
    );

  const drawWidth =
    sourceWidth * ratio;

  const drawHeight =
    sourceHeight * ratio;

  const x =
    (width - drawWidth) / 2;

  const y =
    (height - drawHeight) / 2;

  ctx.drawImage(
    source,
    x,
    y,
    drawWidth,
    drawHeight
  );

}


/* =========================================================
   IMAGE UPLOAD
========================================================= */

function setupImageUpload() {

  $("imageBtn").addEventListener(
    "click",
    () => {

      $("imageInput").click();

    }
  );


  $("imageInput").addEventListener(
    "change",
    handleImageUpload
  );

}


function handleImageUpload(event) {

  const file =
    event.target.files[0];

  if (!file) {
    return;
  }

  if (!file.type.startsWith("image/")) {

    showToast("Please select an image");

    return;
  }

  const reader =
    new FileReader();

  reader.onload = () => {

    currentImageData =
      reader.result;

    pages[currentPageIndex].image =
      currentImageData;

    pages[currentPageIndex].pdf =
      null;

    currentPdf = null;

    currentPdfPage = 1;

    totalPdfPages = 0;

    pdfLayer.classList.remove(
      "active"
    );

    $("pdfControls").classList.add(
      "hidden"
    );

    slideImage.src =
      currentImageData;

    slideLayer.style.display =
      "flex";

    welcomeScreen.classList.add(
      "hidden"
    );

    saveCurrentPageState();

    showToast("Image added to board");

  };

  reader.readAsDataURL(file);

  event.target.value = "";

}


/* =========================================================
   PDF UPLOAD
========================================================= */

function setupPdfUpload() {

  $("pdfBtn").addEventListener(
    "click",
    () => {

      $("pdfInput").click();

    }
  );


  $("pdfInput").addEventListener(
    "change",
    handlePdfUpload
  );


  $("pdfPrevBtn").addEventListener(
    "click",
    () => {

      if (
        currentPdfPage <= 1
      ) {
        return;
      }

      currentPdfPage--;

      renderPdfPage();

    }
  );


  $("pdfNextBtn").addEventListener(
    "click",
    () => {

      if (
        currentPdfPage >=
        totalPdfPages
      ) {
        return;
      }

      currentPdfPage++;

      renderPdfPage();

    }
  );


  $("pdfCloseBtn").addEventListener(
    "click",
    closePdf
  );

}


async function handlePdfUpload(event) {

  const file =
    event.target.files[0];

  if (!file) {
    return;
  }

  if (
    file.type !== "application/pdf" &&
    !file.name.toLowerCase().endsWith(".pdf")
  ) {

    showToast("Please select a PDF file");

    return;
  }


  if (!window.pdfjsLib) {

    showToast(
      "PDF engine is not available"
    );

    return;
  }


  try {

    showToast("Loading PDF...");

    if (currentPdfUrl) {

      URL.revokeObjectURL(
        currentPdfUrl
      );

    }


    currentPdfUrl =
      URL.createObjectURL(file);


    currentPdf =
      await pdfjsLib
        .getDocument({
          url: currentPdfUrl
        })
        .promise;


    totalPdfPages =
      currentPdf.numPages;

    currentPdfPage = 1;


    pages[currentPageIndex].pdf = {
      name: file.name,
      url: currentPdfUrl,
      page: 1,
      totalPages: totalPdfPages
    };

    pages[currentPageIndex].image =
      null;


    slideLayer.style.display =
      "none";

    pdfLayer.classList.add(
      "active"
    );

    $("pdfControls").classList.remove(
      "hidden"
    );

    welcomeScreen.classList.add(
      "hidden"
    );


    await renderPdfPage();

    saveCurrentPageState();

    showToast(
      `PDF loaded: ${totalPdfPages} pages`
    );

  } catch (error) {

    console.error(
      "PDF error:",
      error
    );

    showToast(
      "Could not load this PDF"
    );

  }


  event.target.value = "";

}


/* =========================================================
   RENDER PDF PAGE
========================================================= */

async function renderPdfPage() {

  if (!currentPdf) {
    return;
  }

  try {

    const page =
      await currentPdf.getPage(
        currentPdfPage
      );


    const stageRect =
      boardStage.getBoundingClientRect();


    const baseViewport =
      page.getViewport({
        scale: 1
      });


    const scale =
      Math.min(
        stageRect.width /
          baseViewport.width,

        stageRect.height /
          baseViewport.height
      );


    const viewport =
      page.getViewport({
        scale: scale
      });


    const dpr =
      Math.min(
        window.devicePixelRatio || 1,
        2
      );


    pdfCanvas.width =
      Math.ceil(
        viewport.width * dpr
      );

    pdfCanvas.height =
      Math.ceil(
        viewport.height * dpr
      );


    pdfCanvas.style.width =
      `${viewport.width}px`;

    pdfCanvas.style.height =
      `${viewport.height}px`;


    pdfCtx.setTransform(
      dpr,
      0,
      0,
      dpr,
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


    $("pdfPageInfo").textContent =
      `Page ${currentPdfPage} / ${totalPdfPages}`;


    if (
      pages[currentPageIndex].pdf
    ) {

      pages[currentPageIndex].pdf.page =
        currentPdfPage;

    }


    saveCurrentPageState();

  } catch (error) {

    console.error(
      "PDF render error:",
      error
    );

  }

}


/* =========================================================
   CLOSE PDF
========================================================= */

function closePdf() {

  currentPdf = null;

  totalPdfPages = 0;

  currentPdfPage = 1;

  pdfLayer.classList.remove(
    "active"
  );

  $("pdfControls").classList.add(
    "hidden"
  );

  pages[currentPageIndex].pdf =
    null;

  saveCurrentPageState();

  showToast("PDF closed");

}


/* =========================================================
   TEXT TOOL
========================================================= */

function setupTextTool() {

  $("textTool").addEventListener(
    "click",
    () => {

      currentTool = "text";

      shapeMode = false;

      qsa(".tool-btn").forEach(
        (button) => {
          button.classList.remove(
            "active"
          );
        }
      );

      $("textTool").classList.add(
        "active"
      );

      drawingCanvas.style.cursor =
        "text";

      showToast(
        "Click on the board to add text"
      );

    }
  );


  boardStage.addEventListener(
    "pointerdown",
    handleTextStageClick
  );

}


function handleTextStageClick(event) {

  if (currentTool !== "text") {
    return;
  }

  if (
    event.target.closest(".camera-overlay")
  ) {
    return;
  }

  const rect =
    boardStage.getBoundingClientRect();

  const x =
    event.clientX - rect.left;

  const y =
    event.clientY - rect.top;


  const value =
    prompt(
      "Enter your text:"
    );


  if (
    value === null ||
    !value.trim()
  ) {

    setTool("pen");

    return;
  }


  const textObject = {
    id: textIdCounter++,

    text: value,

    x,
    y,

    color: currentColor,

    size:
      Math.max(
        16,
        currentSize * 4
      )
  };


  pages[currentPageIndex].texts.push(
    textObject
  );


  renderTextLayer();

  saveCurrentPageState();

  setTool("pen");

}


/* =========================================================
   RENDER TEXT
========================================================= */

function renderTextLayer() {

  textLayer.innerHTML = "";

  const items =
    pages[currentPageIndex].texts ||
    [];


  items.forEach((item) => {

    const element =
      document.createElement("div");

    element.className =
      "text-item";

    element.dataset.id =
      item.id;

    element.textContent =
      item.text;

    element.style.left =
      `${item.x}px`;

    element.style.top =
      `${item.y}px`;

    element.style.color =
      item.color;

    element.style.fontSize =
      `${item.size}px`;


    textLayer.appendChild(
      element
    );


    setupTextDrag(
      element,
      item
    );

  });

}


/* =========================================================
   TEXT DRAG
========================================================= */

function setupTextDrag(
  element,
  item
) {

  let dragging = false;

  let startX = 0;
  let startY = 0;

  let originX = 0;
  let originY = 0;


  element.addEventListener(
    "pointerdown",
    (event) => {

      dragging = true;

      startX =
        event.clientX;

      startY =
        event.clientY;

      originX =
        item.x;

      originY =
        item.y;

      element.setPointerCapture(
        event.pointerId
      );

      event.stopPropagation();

    }
  );


  element.addEventListener(
    "pointermove",
    (event) => {

      if (!dragging) {
        return;
      }

      const dx =
        event.clientX -
        startX;

      const dy =
        event.clientY -
        startY;


      item.x =
        originX + dx;

      item.y =
        originY + dy;


      element.style.left =
        `${item.x}px`;

      element.style.top =
        `${item.y}px`;

    }
  );


  element.addEventListener(
    "pointerup",
    () => {

      dragging = false;

      saveCurrentPageState();

    }
  );

}


/* =========================================================
   DRAW TEXT FOR RECORDING
========================================================= */

function drawTextItemsToCanvas(
  ctx,
  width,
  height
) {

  const stageRect =
    boardStage.getBoundingClientRect();

  const scaleX =
    width /
    stageRect.width;

  const scaleY =
    height /
    stageRect.height;


  const items =
    pages[currentPageIndex].texts ||
    [];


  items.forEach((item) => {

    ctx.save();

    ctx.fillStyle =
      item.color || "#172033";

    ctx.font =
      `700 ${item.size * scaleX}px Arial`;

    ctx.textBaseline =
      "top";


    const lines =
      String(item.text).split("\n");


    lines.forEach(
      (line, index) => {

        ctx.fillText(
          line,
          item.x * scaleX,
          (item.y * scaleY) +
            (
              index *
              item.size *
              1.25 *
              scaleY
            )
        );

      }
    );


    ctx.restore();

  });

}


/* =========================================================
   SHAPE TOOL
========================================================= */

function setupShapeTool() {

  $("shapeTool").addEventListener(
    "click",
    () => {

      shapeMode = true;

      currentTool = "shape";

      qsa(".tool-btn").forEach(
        (button) => {
          button.classList.remove(
            "active"
          );
        }
      );

      $("shapeTool").classList.add(
        "active"
      );

      drawingCanvas.style.cursor =
        "crosshair";

      showToast(
        "Drag on board to draw a rectangle"
      );

    }
  );


  drawingCanvas.addEventListener(
    "pointerdown",
    shapePointerDown
  );

  drawingCanvas.addEventListener(
    "pointermove",
    shapePointerMove
  );

  drawingCanvas.addEventListener(
    "pointerup",
    shapePointerUp
  );

}


setupShapeTool();


function shapePointerDown(event) {

  if (!shapeMode) {
    return;
  }

  const point =
    getCanvasPoint(event);

  shapeStartX =
    point.x;

  shapeStartY =
    point.y;

  shapeSnapshot =
    drawingCtx.getImageData(
      0,
      0,
      drawingCanvas.width,
      drawingCanvas.height
    );

  drawingCanvas.setPointerCapture(
    event.pointerId
  );

}


function shapePointerMove(event) {

  if (
    !shapeMode ||
    !shapeSnapshot
  ) {
    return;
  }

  const point =
    getCanvasPoint(event);

  drawingCtx.putImageData(
    shapeSnapshot,
    0,
    0
  );


  const width =
    point.x - shapeStartX;

  const height =
    point.y - shapeStartY;


  drawingCtx.save();

  drawingCtx.strokeStyle =
    currentColor;

  drawingCtx.lineWidth =
    currentSize;

  drawingCtx.globalAlpha =
    1;

  drawingCtx.strokeRect(
    shapeStartX,
    shapeStartY,
    width,
    height
  );

  drawingCtx.restore();

}


function shapePointerUp(event) {

  if (!shapeMode) {
    return;
  }

  shapePointerMove(event);

  shapeSnapshot = null;

  saveCurrentPageState();

  saveHistory();

}


/* =========================================================
   BOARD PAGES
========================================================= */

function setupPages() {

  $("addPageBtn").addEventListener(
    "click",
    addPage
  );

  $("duplicatePageBtn").addEventListener(
    "click",
    duplicatePage
  );

  $("deletePageBtn").addEventListener(
    "click",
    deletePage
  );

  $("previousPageBtn").addEventListener(
    "click",
    previousPage
  );

  $("nextPageBtn").addEventListener(
    "click",
    nextPage
  );

}


function addPage() {

  saveCurrentPageState();

  pages.push({
    id: createId(),

    drawing: null,

    image: null,

    pdf: null,

    texts: []
  });

  currentPageIndex =
    pages.length - 1;

  resetHistory();

  renderCurrentPage();

  showToast(
    `Page ${currentPageIndex + 1} added`
  );

}


function duplicatePage() {

  saveCurrentPageState();

  const current =
    pages[currentPageIndex];

  const copy = {
    id: createId(),

    drawing:
      current.drawing || null,

    image:
      current.image || null,

    pdf:
      current.pdf
        ? {
            ...current.pdf
          }
        : null,

    texts:
      JSON.parse(
        JSON.stringify(
          current.texts || []
        )
      )
  };


  pages.splice(
    currentPageIndex + 1,
    0,
    copy
  );

  currentPageIndex++;

  resetHistory();

  renderCurrentPage();

  showToast(
    "Page duplicated"
  );

}


function deletePage() {

  if (pages.length <= 1) {

    showToast(
      "You need at least one page"
    );

    return;
  }


  const confirmed =
    confirm(
      "Delete this page?"
    );

  if (!confirmed) {
    return;
  }


  pages.splice(
    currentPageIndex,
    1
  );


  if (
    currentPageIndex >=
    pages.length
  ) {

    currentPageIndex =
      pages.length - 1;

  }


  resetHistory();

  renderCurrentPage();

  showToast("Page deleted");

}


function previousPage() {

  if (
    currentPageIndex <= 0
  ) {

    showToast(
      "This is the first page"
    );

    return;
  }

  saveCurrentPageState();

  currentPageIndex--;

  resetHistory();

  renderCurrentPage();

}


function nextPage() {

  if (
    currentPageIndex >=
    pages.length - 1
  ) {

    showToast(
      "This is the last page"
    );

    return;
  }

  saveCurrentPageState();

  currentPageIndex++;

  resetHistory();

  renderCurrentPage();

}


/* =========================================================
   SAVE CURRENT PAGE
========================================================= */

function saveCurrentPageState() {

  if (
    !pages[currentPageIndex]
  ) {
    return;
  }


  pages[currentPageIndex].drawing =
    drawingCanvas.toDataURL(
      "image/png"
    );


  pages[currentPageIndex].texts =
    JSON.parse(
      JSON.stringify(
        pages[currentPageIndex].texts ||
        []
      )
    );


  if (
    currentImageData &&
    !pages[currentPageIndex].pdf
  ) {

    pages[currentPageIndex].image =
      currentImageData;

  }

}


/* =========================================================
   RENDER CURRENT PAGE
========================================================= */

async function renderCurrentPage() {

  const page =
    pages[currentPageIndex];

  if (!page) {
    return;
  }


  clearBoardVisuals();


  /* Restore image */

  if (page.image) {

    currentImageData =
      page.image;

    slideImage.src =
      page.image;

    slideLayer.style.display =
      "flex";

    welcomeScreen.classList.add(
      "hidden"
    );

  } else {

    currentImageData = null;

  }


  /* Restore PDF */

  if (page.pdf) {

    try {

      if (
        !window.pdfjsLib
      ) {
        throw new Error(
          "PDF.js unavailable"
        );
      }


      if (
        currentPdfUrl !==
        page.pdf.url
      ) {

        currentPdfUrl =
          page.pdf.url;

        currentPdf =
          await pdfjsLib
            .getDocument({
              url: currentPdfUrl
            })
            .promise;

      }


      totalPdfPages =
        currentPdf.numPages;

      currentPdfPage =
        Math.min(
          page.pdf.page || 1,
          totalPdfPages
        );


      pdfLayer.classList.add(
        "active"
      );

      $("pdfControls").classList.remove(
        "hidden"
      );

      slideLayer.style.display =
        "none";

      welcomeScreen.classList.add(
        "hidden"
      );


      await renderPdfPage();

    } catch (error) {

      console.error(
        error
      );

      page.pdf = null;

      currentPdf = null;

    }

  }


  /* Restore drawing */

  if (page.drawing) {

    await restoreDrawingData(
      page.drawing
    );

  }


  /* Restore text */

  renderTextLayer();


  updatePageNumbers();

}


/* =========================================================
   RESTORE DRAWING DATA
========================================================= */

function restoreDrawingData(
  dataUrl
) {

  return new Promise(
    (resolve) => {

      const image =
        new Image();

      image.onload = () => {

        const rect =
          boardStage.getBoundingClientRect();

        drawingCtx.clearRect(
          0,
          0,
          rect.width,
          rect.height
        );

        drawingCtx.drawImage(
          image,
          0,
          0,
          rect.width,
          rect.height
        );

        resolve();

      };

      image.onerror = () => {
        resolve();
      };

      image.src =
        dataUrl;

    }
  );

}


/* =========================================================
   PAGE NUMBERS
========================================================= */

function updatePageNumbers() {

  $("currentPageNumber").textContent =
    currentPageIndex + 1;

  $("totalPageNumber").textContent =
    pages.length;

}


/* =========================================================
   HISTORY RESET
========================================================= */

function resetHistory() {

  history = [];

  historyIndex = -1;

  setTimeout(
    saveHistory,
    100
  );

}


/* =========================================================
   NOTES
========================================================= */

function setupNotes() {

  $("notesBtn").addEventListener(
    "click",
    () => {

      $("notesPanel").scrollIntoView({
        behavior: "smooth",
        block: "nearest"
      });

      $("notesInput").focus();

    }
  );


  $("saveNotesBtn").addEventListener(
    "click",
    () => {

      localStorage.setItem(
        "snkSmartBoardNotes",
        $("notesInput").value
      );

      showToast(
        "Notes saved"
      );

    }
  );


  const savedNotes =
    localStorage.getItem(
      "snkSmartBoardNotes"
    );

  if (savedNotes) {
    $("notesInput").value =
      savedNotes;
  }

}


/* =========================================================
   CAMERA SETUP
========================================================= */

function setupCamera() {

  $("cameraBtn").addEventListener(
    "click",
    toggleCamera
  );


  $("panelCameraBtn").addEventListener(
    "click",
    toggleCamera
  );


  $("settingsCameraBtn").addEventListener(
    "click",
    toggleCamera
  );


  $("cameraCloseBtn").addEventListener(
    "click",
    () => {

      stopCamera();

    }
  );


  $("cameraFlipBtn").addEventListener(
    "click",
    () => {

      cameraMirrored =
        !cameraMirrored;

      updateCameraVisual();

    }
  );


  $("cameraMuteBtn").addEventListener(
    "click",
    () => {

      cameraMuted =
        !cameraMuted;

      updateCameraVisual();

    }
  );


  $("mirrorCamera").addEventListener(
    "change",
    (event) => {

      cameraMirrored =
        event.target.checked;

      updateCameraVisual();

    }
  );


  $("cameraShape").addEventListener(
    "change",
    (event) => {

      setCameraShape(
        event.target.value
      );

    }
  );


  $("cameraEffect").addEventListener(
    "change",
    (event) => {

      setCameraEffect(
        event.target.value
      );

    }
  );


  setupCameraDragging();

  setupCameraResize();

}


/* =========================================================
   TOGGLE CAMERA
========================================================= */

async function toggleCamera() {

  if (cameraEnabled) {

    stopCamera();

    return;
  }


  await startCamera();

}


async function startCamera() {

  if (
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia
  ) {

    showToast(
      "Camera is not supported by this browser"
    );

    return;
  }


  try {

    showToast(
      "Requesting camera permission..."
    );


    cameraStream =
      await navigator.mediaDevices
        .getUserMedia({
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


    const video =
      $("mentorVideo");

    video.srcObject =
      cameraStream;

    video.muted = true;

    video.playsInline = true;

    await video.play();


    cameraEnabled = true;


    $("cameraOverlay")
      .classList.remove("hidden");

    $("cameraPlaceholder")
      .classList.add("hidden");


    updateCameraStatusUI();

    updateCameraVisual();

    resizeCameraToStage();


    showToast(
      "Mentor camera is ON"
    );

  } catch (error) {

    console.error(
      "Camera error:",
      error
    );

    cameraEnabled = false;

    showToast(
      "Camera permission was denied or unavailable"
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

  $("mentorVideo").srcObject =
    null;

  cameraEnabled = false;

  $("cameraOverlay")
    .classList.add("hidden");

  updateCameraStatusUI();

  showToast(
    "Mentor camera is OFF"
  );

}


/* =========================================================
   CAMERA UI
========================================================= */

function updateCameraStatusUI() {

  const pill =
    $("cameraStatusPill");

  const panelButton =
    $("panelCameraBtn");

  const settingsButton =
    $("settingsCameraBtn");

  const recordStatus =
    $("recordCameraStatus");


  if (cameraEnabled) {

    pill.textContent =
      "ON";

    pill.classList.add("on");

    panelButton.textContent =
      "🎥 Turn Camera Off";

    settingsButton.textContent =
      "Turn Off";

    recordStatus.textContent =
      "🎥 Camera On";

  } else {

    pill.textContent =
      "OFF";

    pill.classList.remove("on");

    panelButton.textContent =
      "🎥 Turn Camera On";

    settingsButton.textContent =
      "Turn On";

    recordStatus.textContent =
      "🎥 Camera Off";

  }

}


/* =========================================================
   CAMERA VISUAL
========================================================= */

function updateCameraVisual() {

  const video =
    $("mentorVideo");

  video.classList.remove(
    "mirrored",
    "effect-soft-blur",
    "effect-grayscale"
  );


  if (cameraMirrored) {
    video.classList.add(
      "mirrored"
    );
  }


  if (
    cameraEffect ===
    "soft-blur"
  ) {

    video.classList.add(
      "effect-soft-blur"
    );

  }


  if (
    cameraEffect ===
    "grayscale"
  ) {

    video.classList.add(
      "effect-grayscale"
    );

  }


  const overlay =
    $("cameraOverlay");

  overlay.classList.remove(
    "shape-rectangle",
    "shape-rounded",
    "shape-circle"
  );


  overlay.classList.add(
    `shape-${cameraShape}`
  );


  applyCameraBackground();

}


/* =========================================================
   CAMERA SHAPE
========================================================= */

function setCameraShape(shape) {

  cameraShape =
    shape;

  $("cameraShape").value =
    shape;


  qsa(
    "[data-camera-shape]"
  ).forEach((button) => {

    button.classList.toggle(
      "active",
      button.dataset.cameraShape === shape
    );

  });


  updateCameraVisual();

}


/* =========================================================
   CAMERA EFFECT
========================================================= */

function setCameraEffect(effect) {

  cameraEffect =
    effect;

  $("cameraEffect").value =
    effect;


  qsa(
    "[data-camera-effect]"
  ).forEach((button) => {

    button.classList.toggle(
      "active",
      button.dataset.cameraEffect === effect
    );

  });


  updateCameraVisual();

}


/* =========================================================
   CAMERA BACKGROUND
========================================================= */

function applyCameraBackground() {

  const backdrop =
    $("cameraBackdrop");

  backdrop.className =
    "camera-backdrop";


  if (
    cameraBackground ===
    "none"
  ) {

    backdrop.classList.add(
      "hidden"
    );

    return;
  }


  backdrop.classList.remove(
    "hidden"
  );


  const overlay =
    $("cameraOverlay");

  backdrop.style.left =
    `${cameraState.x - 8}px`;

  backdrop.style.top =
    `${cameraState.y - 8}px`;

  backdrop.style.width =
    `${cameraState.width + 16}px`;

  backdrop.style.height =
    `${cameraState.height + 16}px`;


  if (
    cameraBackground ===
    "white"
  ) {

    backdrop.style.background =
      "#ffffff";

  }


  if (
    cameraBackground ===
    "blue"
  ) {

    backdrop.style.background =
      "#d5e9fb";

  }


  if (
    cameraBackground ===
    "dark"
  ) {

    backdrop.style.background =
      "#172033";

  }

}


/* =========================================================
   CAMERA DRAGGING
========================================================= */

function setupCameraDragging() {

  const dragArea =
    $("cameraDragArea");


  dragArea.addEventListener(
    "pointerdown",
    (event) => {

      if (!cameraEnabled) {
        return;
      }


      cameraDragging = true;

      cameraDragPointerId =
        event.pointerId;

      cameraDragStartX =
        event.clientX;

      cameraDragStartY =
        event.clientY;


      cameraStartLeft =
        cameraState.x;

      cameraStartTop =
        cameraState.y;


      dragArea.setPointerCapture(
        event.pointerId
      );


      event.preventDefault();

    }
  );


  dragArea.addEventListener(
    "pointermove",
    (event) => {

      if (
        !cameraDragging ||
        event.pointerId !==
          cameraDragPointerId
      ) {
        return;
      }


      const dx =
        event.clientX -
        cameraDragStartX;

      const dy =
        event.clientY -
        cameraDragStartY;


      cameraState.x =
        cameraStartLeft + dx;

      cameraState.y =
        cameraStartTop + dy;


      constrainCamera();

      applyCameraPosition();

    }
  );


  dragArea.addEventListener(
    "pointerup",
    stopCameraDrag
  );


  dragArea.addEventListener(
    "pointercancel",
    stopCameraDrag
  );

}


function stopCameraDrag() {

  cameraDragging = false;

  cameraDragPointerId = null;

}


/* =========================================================
   CAMERA RESIZE
========================================================= */

function setupCameraResize() {

  const handle =
    $("cameraResizeHandle");


  handle.addEventListener(
    "pointerdown",
    (event) => {

      if (!cameraEnabled) {
        return;
      }


      cameraResizing = true;

      cameraResizePointerId =
        event.pointerId;

      cameraResizeStartX =
        event.clientX;

      cameraResizeStartY =
        event.clientY;


      cameraStartWidth =
        cameraState.width;

      cameraStartHeight =
        cameraState.height;


      handle.setPointerCapture(
        event.pointerId
      );


      event.preventDefault();

      event.stopPropagation();

    }
  );


  handle.addEventListener(
    "pointermove",
    (event) => {

      if (
        !cameraResizing ||
        event.pointerId !==
          cameraResizePointerId
      ) {
        return;
      }


      const dx =
        event.clientX -
        cameraResizeStartX;


      const ratio =
        cameraStartWidth /
        cameraStartHeight;


      let newWidth =
        cameraStartWidth + dx;


      let newHeight;


      if (
        cameraShape ===
        "circle"
      ) {

        newHeight =
          newWidth;

      } else {

        newHeight =
          newWidth / ratio;

      }


      const minWidth =
        130;

      const minHeight =
        90;


      newWidth =
        Math.max(
          minWidth,
          newWidth
        );

      newHeight =
        Math.max(
          minHeight,
          newHeight
        );


      const stageRect =
        boardStage.getBoundingClientRect();


      newWidth =
        Math.min(
          newWidth,
          stageRect.width -
            cameraState.x
        );


      newHeight =
        Math.min(
          newHeight,
          stageRect.height -
            cameraState.y
        );


      cameraState.width =
        newWidth;

      cameraState.height =
        newHeight;


      applyCameraPosition();

      applyCameraBackground();

    }
  );


  handle.addEventListener(
    "pointerup",
    stopCameraResize
  );


  handle.addEventListener(
    "pointercancel",
    stopCameraResize
  );

}


function stopCameraResize() {

  cameraResizing = false;

  cameraResizePointerId = null;

}


/* =========================================================
   CAMERA POSITION
========================================================= */

function applyCameraPosition() {

  const overlay =
    $("cameraOverlay");

  overlay.style.left =
    `${cameraState.x}px`;

  overlay.style.top =
    `${cameraState.y}px`;

  overlay.style.width =
    `${cameraState.width}px`;

  overlay.style.height =
    `${cameraState.height}px`;


  applyCameraBackground();

}


/* =========================================================
   CONSTRAIN CAMERA
========================================================= */

function constrainCamera() {

  const rect =
    boardStage.getBoundingClientRect();


  cameraState.x =
    Math.max(
      0,
      Math.min(
        cameraState.x,
        rect.width -
          cameraState.width
      )
    );


  cameraState.y =
    Math.max(
      0,
      Math.min(
        cameraState.y,
        rect.height -
          cameraState.height
      )
    );

}


/* =========================================================
   RESIZE CAMERA TO STAGE
========================================================= */

function resizeCameraToStage() {

  const rect =
    boardStage.getBoundingClientRect();


  if (!rect.width) {
    return;
  }


  cameraState.width =
    Math.min(
      cameraState.width,
      rect.width * 0.45
    );


  cameraState.height =
    Math.min(
      cameraState.height,
      rect.height * 0.65
    );


  constrainCamera();

  applyCameraPosition();

}


/* =========================================================
   CAMERA SETTINGS
========================================================= */

function setupCameraSettings() {

  $("cameraSettingsBtn").addEventListener(
    "click",
    () => {

      $("cameraSettingsModal")
        .classList.remove("hidden");

    }
  );


  $("closeCameraSettings").addEventListener(
    "click",
    closeCameraSettings
  );


  $("cameraSettingsModal")
    .addEventListener(
      "click",
      (event) => {

        if (
          event.target ===
          $("cameraSettingsModal")
        ) {

          closeCameraSettings();

        }

      }
    );


  qsa(
    "[data-camera-shape]"
  ).forEach((button) => {

    button.addEventListener(
      "click",
      () => {

        setCameraShape(
          button.dataset.cameraShape
        );

      }
    );

  });


  qsa(
    "[data-camera-effect]"
  ).forEach((button) => {

    button.addEventListener(
      "click",
      () => {

        setCameraEffect(
          button.dataset.cameraEffect
        );

      }
    );

  });


  qsa(
    "[data-camera-background]"
  ).forEach((button) => {

    button.addEventListener(
      "click",
      () => {

        cameraBackground =
          button.dataset.cameraBackground;

        qsa(
          "[data-camera-background]"
        ).forEach((item) => {

          item.classList.toggle(
            "active",
            item.dataset.cameraBackground ===
              cameraBackground
          );

        });

        applyCameraBackground();

      }
    );

  });

}


function closeCameraSettings() {

  $("cameraSettingsModal")
    .classList.add("hidden");

}


/* =========================================================
   MICROPHONE
========================================================= */

function setupMicrophone() {

  $("micBtn").addEventListener(
    "click",
    toggleMicrophone
  );


  $("settingsMicBtn").addEventListener(
    "click",
    toggleMicrophone
  );

}


async function toggleMicrophone() {

  if (micEnabled) {

    disableMicrophone();

    return;
  }


  await enableMicrophone();

}


async function enableMicrophone() {

  if (
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia
  ) {

    showToast(
      "Microphone is not supported"
    );

    return;
  }


  try {

    micStream =
      await navigator.mediaDevices
        .getUserMedia({
          audio: {
            echoCancellation: true,

            noiseSuppression: true,

            autoGainControl: true
          }
        });


    micEnabled = true;


    updateMicUI();

    showToast(
      "Microphone is ON"
    );

  } catch (error) {

    console.error(
      "Microphone error:",
      error
    );

    micEnabled = false;

    showToast(
      "Microphone permission was denied"
    );

  }

}


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

  updateMicUI();

  showToast(
    "Microphone is OFF"
  );

}


function updateMicUI() {

  const status =
    $("micStatus");

  const recordStatus =
    $("recordMicStatus");

  const settingsButton =
    $("settingsMicBtn");


  if (micEnabled) {

    status.classList.remove(
      "hidden"
    );

    status.textContent =
      "🎤 Microphone On";

    recordStatus.textContent =
      "🎤 Mic On";

    settingsButton.textContent =
      "Turn Off";

  } else {

    status.classList.add(
      "hidden"
    );

    recordStatus.textContent =
      "🎤 Mic Off";

    settingsButton.textContent =
      "Turn On";

  }

}


/* =========================================================
   RECORDING SETUP
========================================================= */

function setupRecording() {

  $("recordBtn").addEventListener(
    "click",
    toggleRecording
  );


  $("startRecordingBtn")
    .addEventListener(
      "click",
      startRecording
    );


  $("pauseRecordingBtn")
    .addEventListener(
      "click",
      pauseRecording
    );


  $("resumeRecordingBtn")
    .addEventListener(
      "click",
      resumeRecording
    );


  $("stopRecordingBtn")
    .addEventListener(
      "click",
      stopRecording
    );


  $("closeRecordingModal")
    .addEventListener(
      "click",
      closeRecordingModal
    );


  $("discardRecordingBtn")
    .addEventListener(
      "click",
      discardRecording
    );


  $("downloadRecordingBtn")
    .addEventListener(
      "click",
      downloadRecording
    );

}


/* =========================================================
   TOGGLE RECORDING
========================================================= */

async function toggleRecording() {

  if (isRecording) {

    if (isPaused) {
      resumeRecording();
    } else {
      pauseRecording();
    }

    return;
  }


  await startRecording();

}


/* =========================================================
   START RECORDING
========================================================= */

async function startRecording() {

  if (isRecording) {
    return;
  }


  if (
    !window.MediaRecorder
  ) {

    showToast(
      "This browser does not support recording"
    );

    return;
  }


  /* Make sure microphone exists */

  if (!micEnabled) {

    await enableMicrophone();

  }


  if (
    !micStream ||
    !micStream.getAudioTracks().length
  ) {

    showToast(
      "Microphone permission is required for voice recording"
    );

    return;
  }


  recordedChunks = [];

  recordedBlob = null;


  /* Prepare record canvas */

  recordCanvas.width = 1280;

  recordCanvas.height = 720;


  /* Capture canvas video */

  const canvasStream =
    recordCanvas.captureStream(
      30
    );


  recordingStream =
    new MediaStream();


  recordingVideoTrack =
    canvasStream.getVideoTracks()[0];


  recordingStream.addTrack(
    recordingVideoTrack
  );


  /* Add microphone */

  recordingAudioTrack =
    micStream.getAudioTracks()[0];


  recordingStream.addTrack(
    recordingAudioTrack
  );


  /* Choose MIME type */

  const mimeTypes = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm"
  ];


  let selectedMime =
    "";


  for (
    const mimeType of mimeTypes
  ) {

    if (
      MediaRecorder.isTypeSupported(
        mimeType
      )
    ) {

      selectedMime =
        mimeType;

      break;

    }

  }


  try {

    mediaRecorder =
      selectedMime
        ? new MediaRecorder(
            recordingStream,
            {
              mimeType:
                selectedMime
            }
          )
        : new MediaRecorder(
            recordingStream
          );

  } catch (error) {

    console.error(
      error
    );

    showToast(
      "Could not start recorder"
    );

    cleanupRecordingStream();

    return;
  }


  mediaRecorder.ondataavailable =
    (event) => {

      if (
        event.data &&
        event.data.size > 0
      ) {

        recordedChunks.push(
          event.data
        );

      }

    };


  mediaRecorder.onstop =
    handleRecordingStopped;


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


  mediaRecorder.start(
    1000
  );


  isRecording = true;

  isPaused = false;

  recordingStartedAt =
    Date.now();

  recordingPausedAt = 0;

  recordingPausedDuration = 0;


  updateRecordingUI();

  startRecordingTimer();

  startRecordingRenderLoop();


  showToast(
    "Class recording started"
  );

}


/* =========================================================
   RECORDING RENDER LOOP
========================================================= */

function startRecordingRenderLoop() {

  if (recordingRenderFrame) {

    cancelAnimationFrame(
      recordingRenderFrame
    );

  }


  const render = () => {

    if (!isRecording) {
      return;
    }


    drawBoardToCanvas(
      recordCtx,
      recordCanvas.width,
      recordCanvas.height,
      true
    );


    recordingRenderFrame =
      requestAnimationFrame(
        render
      );

  };


  render();

}


/* =========================================================
   PAUSE
========================================================= */

function pauseRecording() {

  if (
    !mediaRecorder ||
    !isRecording ||
    isPaused
  ) {
    return;
  }


  if (
    mediaRecorder.state ===
    "recording"
  ) {

    mediaRecorder.pause();

  }


  isPaused = true;

  recordingPausedAt =
    Date.now();


  updateRecordingUI();

  showToast(
    "Recording paused"
  );

}


/* =========================================================
   RESUME
========================================================= */

function resumeRecording() {

  if (
    !mediaRecorder ||
    !isRecording ||
    !isPaused
  ) {
    return;
  }


  if (
    mediaRecorder.state ===
    "paused"
  ) {

    mediaRecorder.resume();

  }


  recordingPausedDuration +=
    Date.now() -
    recordingPausedAt;

  recordingPausedAt = 0;

  isPaused = false;


  updateRecordingUI();

  showToast(
    "Recording resumed"
  );

}


/* =========================================================
   STOP
========================================================= */

function stopRecording() {

  if (
    !mediaRecorder ||
    !isRecording
  ) {
    return;
  }


  if (
    mediaRecorder.state !==
    "inactive"
  ) {

    mediaRecorder.stop();

  }


  isRecording = false;

  isPaused = false;


  stopRecordingTimer();


  if (recordingRenderFrame) {

    cancelAnimationFrame(
      recordingRenderFrame
    );

    recordingRenderFrame =
      null;

  }


  updateRecordingUI();

  showToast(
    "Finishing recording..."
  );

}


/* =========================================================
   RECORDING STOP HANDLER
========================================================= */

function handleRecordingStopped() {

  recordedBlob =
    new Blob(
      recordedChunks,
      {
        type:
          mediaRecorder.mimeType ||
          "video/webm"
      }
    );


  recordedUrl =
    URL.createObjectURL(
      recordedBlob
    );


  $("recordingPreview").src =
    recordedUrl;


  $("recordingModal")
    .classList.remove("hidden");


  cleanupRecordingStream();


  mediaRecorder = null;


  updateRecordingUI();

  showToast(
    "Recording ready"
  );

}


/* =========================================================
   CLEANUP RECORDING STREAM
========================================================= */

function cleanupRecordingStream() {

  if (recordingStream) {

    recordingStream
      .getTracks()
      .forEach(
        (track) => track.stop()
      );

  }

  recordingStream = null;

  recordingVideoTrack = null;

  recordingAudioTrack = null;

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

  if (!recordingStartedAt) {
    return;
  }


  let elapsed =
    Date.now() -
    recordingStartedAt;


  elapsed -=
    recordingPausedDuration;


  if (isPaused && recordingPausedAt) {

    elapsed -=
      Date.now() -
      recordingPausedAt;

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


  const minutes =
    Math.floor(
      totalSeconds / 60
    );


  const seconds =
    totalSeconds % 60;


  const formatted =
    `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;


  $("recordingTimer").textContent =
    formatted;

  $("recordingTimeLarge").textContent =
    formatted;

}


/* =========================================================
   RECORDING UI
========================================================= */

function updateRecordingUI() {

  const indicator =
    $("recordingIndicator");

  const pill =
    $("recordingStatusPill");

  const startButton =
    $("startRecordingBtn");

  const pauseButton =
    $("pauseRecordingBtn");

  const resumeButton =
    $("resumeRecordingBtn");

  const stopButton =
    $("stopRecordingBtn");

  const recordButton =
    $("recordBtn");


  if (isRecording) {

    indicator.classList.remove(
      "hidden"
    );

    if (isPaused) {

      pill.textContent =
        "PAUSED";

      pill.classList.remove(
        "recording"
      );

      recordButton.innerHTML =
        "<span>▶</span> Resume";

      startButton.disabled =
        true;

      pauseButton.disabled =
        true;

      resumeButton.disabled =
        false;

      stopButton.disabled =
        false;

    } else {

      pill.textContent =
        "RECORDING";

      pill.classList.add(
        "recording"
      );

      recordButton.innerHTML =
        "<span>⏸</span> Pause";

      startButton.disabled =
        true;

      pauseButton.disabled =
        false;

      resumeButton.disabled =
        true;

      stopButton.disabled =
        false;

    }

  } else {

    indicator.classList.add(
      "hidden"
    );

    pill.textContent =
      "READY";

    pill.classList.remove(
      "recording"
    );

    recordButton.innerHTML =
      "<span>⏺</span> Record";

    startButton.disabled =
      false;

    pauseButton.disabled =
      true;

    resumeButton.disabled =
      true;

    stopButton.disabled =
      true;

  }

}


/* =========================================================
   DRAW CAMERA TO RECORD CANVAS
========================================================= */

function drawCameraToCanvas(
  ctx,
  width,
  height
) {

  const video =
    $("mentorVideo");


  if (
    !cameraEnabled ||
    video.readyState < 2
  ) {
    return;
  }


  const stageRect =
    boardStage.getBoundingClientRect();


  const scaleX =
    width /
    stageRect.width;

  const scaleY =
    height /
    stageRect.height;


  const x =
    cameraState.x *
    scaleX;

  const y =
    cameraState.y *
    scaleY;

  const w =
    cameraState.width *
    scaleX;

  const h =
    cameraState.height *
    scaleY;


  ctx.save();


  /* Clip shape */

  createCameraClip(
    ctx,
    x,
    y,
    w,
    h
  );


  /* Camera effect */

  if (
    cameraEffect ===
    "soft-blur"
  ) {

    ctx.filter =
      "blur(3px)";

  } else if (
    cameraEffect ===
    "grayscale"
  ) {

    ctx.filter =
      "grayscale(1)";

  } else {

    ctx.filter =
      "none";

  }


  if (cameraMirrored) {

    ctx.translate(
      x + w,
      y
    );

    ctx.scale(
      -1,
      1
    );

    ctx.drawImage(
      video,
      0,
      0,
      w,
      h
    );

  } else {

    ctx.drawImage(
      video,
      x,
      y,
      w,
      h
    );

  }


  ctx.restore();


  /* Border */

  ctx.save();

  ctx.strokeStyle =
    "rgba(255,255,255,0.95)";

  ctx.lineWidth =
    4;


  createCameraClip(
    ctx,
    x,
    y,
    w,
    h
  );


  ctx.stroke();

  ctx.restore();


  /* Mentor label */

  ctx.save();

  ctx.fillStyle =
    "rgba(0,0,0,0.58)";

  ctx.fillRect(
    x + 7,
    y + 7,
    54,
    19
  );

  ctx.fillStyle =
    "#ffffff";

  ctx.font =
    "900 9px Arial";

  ctx.fillText(
    "MENTOR",
    x + 13,
    y + 20
  );

  ctx.restore();

}


/* =========================================================
   CAMERA CLIP
========================================================= */

function createCameraClip(
  ctx,
  x,
  y,
  width,
  height
) {

  ctx.beginPath();


  if (
    cameraShape ===
    "circle"
  ) {

    ctx.ellipse(
      x + width / 2,
      y + height / 2,
      width / 2,
      height / 2,
      0,
      0,
      Math.PI * 2
    );

  } else if (
    cameraShape ===
    "rectangle"
  ) {

    ctx.rect(
      x,
      y,
      width,
      height
    );

  } else {

    const radius =
      Math.min(
        18,
        width / 8,
        height / 8
      );

    roundedRectPath(
      ctx,
      x,
      y,
      width,
      height,
      radius
    );

  }

  ctx.clip();

}


/* =========================================================
   ROUNDED RECT PATH
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

}


/* =========================================================
   RECORDING MODAL
========================================================= */

function closeRecordingModal() {

  $("recordingModal")
    .classList.add("hidden");

}


function discardRecording() {

  if (recordedUrl) {

    URL.revokeObjectURL(
      recordedUrl
    );

  }

  recordedUrl = null;

  recordedBlob = null;

  $("recordingPreview").removeAttribute(
    "src"
  );

  $("recordingModal")
    .classList.add("hidden");

  showToast(
    "Recording deleted"
  );

}


function downloadRecording() {

  if (
    !recordedBlob ||
    !recordedUrl
  ) {

    showToast(
      "No recording available"
    );

    return;
  }


  const now =
    new Date();


  const date =
    [
      now.getFullYear(),

      String(
        now.getMonth() + 1
      ).padStart(2, "0"),

      String(
        now.getDate()
      ).padStart(2, "0")
    ].join("-");


  const time =
    [
      String(
        now.getHours()
      ).padStart(2, "0"),

      String(
        now.getMinutes()
      ).padStart(2, "0")
    ].join("-");


  const link =
    document.createElement("a");

  link.href =
    recordedUrl;

  link.download =
    `snk-smart-board-class-${date}-${time}.webm`;

  document.body.appendChild(
    link
  );

  link.click();

  link.remove();


  showToast(
    "Recording download started"
  );

}


/* =========================================================
   ZOOM
========================================================= */

function setupZoom() {

  $("zoomInBtn").addEventListener(
    "click",
    () => {

      zoomLevel =
        Math.min(
          1.5,
          zoomLevel + 0.1
        );

      updateZoom();

    }
  );


  $("zoomOutBtn").addEventListener(
    "click",
    () => {

      zoomLevel =
        Math.max(
          0.7,
          zoomLevel - 0.1
        );

      updateZoom();

    }
  );


  $("resetZoomBtn").addEventListener(
    "click",
    () => {

      zoomLevel = 1;

      updateZoom();

    }
  );

}


function updateZoom() {

  $("zoomValue").textContent =
    `${Math.round(zoomLevel * 100)}%`;


  boardStage.style.transform =
    `scale(${zoomLevel})`;

}


/* =========================================================
   FULLSCREEN
========================================================= */

function setupFullscreen() {

  $("fullscreenBtn").addEventListener(
    "click",
    toggleFullscreen
  );

}


async function toggleFullscreen() {

  try {

    if (!document.fullscreenElement) {

      await app.requestFullscreen();

    } else {

      await document.exitFullscreen();

    }

  } catch (error) {

    console.error(
      "Fullscreen error:",
      error
    );

    showToast(
      "Fullscreen unavailable"
    );

  }

}


/* =========================================================
   KEYBOARD SHORTCUTS
========================================================= */

function setupKeyboardShortcuts() {

  document.addEventListener(
    "keydown",
    (event) => {

      const target =
        event.target;


      const typing =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;


      if (typing) {
        return;
      }


      /* Undo */

      if (
        event.ctrlKey &&
        event.key.toLowerCase() === "z"
      ) {

        event.preventDefault();

        undo();

      }


      /* Redo */

      if (
        event.ctrlKey &&
        event.key.toLowerCase() === "y"
      ) {

        event.preventDefault();

        redo();

      }


      /* Save */

      if (
        event.ctrlKey &&
        event.key.toLowerCase() === "s"
      ) {

        event.preventDefault();

        saveBoardAsPNG();

      }


      /* Escape */

      if (
        event.key === "Escape"
      ) {

        shapeMode = false;

        setTool("pen");

      }

    }
  );

}


/* =========================================================
   PAGE STATE / LOCAL STORAGE
========================================================= */

function saveProjectToStorage() {

  try {

    saveCurrentPageState();

    const data = {
      pages,
      currentPageIndex
    };


    localStorage.setItem(
      "snkSmartBoardProject",
      JSON.stringify(data)
    );

  } catch (error) {

    console.warn(
      "Could not save project:",
      error
    );

  }

}


function loadProjectFromStorage() {

  try {

    const raw =
      localStorage.getItem(
        "snkSmartBoardProject"
      );


    if (!raw) {
      return false;
    }


    const data =
      JSON.parse(raw);


    if (
      !Array.isArray(data.pages) ||
      !data.pages.length
    ) {
      return false;
    }


    pages =
      data.pages;

    currentPageIndex =
      Math.min(
        data.currentPageIndex || 0,
        pages.length - 1
      );


    return true;

  } catch (error) {

    console.warn(
      "Could not load project:",
      error
    );

    return false;

  }

}


/* =========================================================
   AUTOSAVE
========================================================= */

setInterval(
  () => {

    saveProjectToStorage();

  },
  10000
);


/* =========================================================
   BEFORE UNLOAD
========================================================= */

window.addEventListener(
  "beforeunload",
  () => {

    saveProjectToStorage();

  }
);


/* =========================================================
   UPDATE BOARD STATUS
========================================================= */

function setBoardStatus(text) {

  if ($("boardStatus")) {

    $("boardStatus").textContent =
      text;

  }

}


/* =========================================================
   CAMERA RECORDING STATUS UPDATE
========================================================= */

setInterval(
  () => {

    if (isRecording) {

      setBoardStatus(
        isPaused
          ? "Recording paused"
          : "Recording class"
      );

    } else if (cameraEnabled) {

      setBoardStatus(
        "Mentor camera active"
      );

    } else {

      setBoardStatus(
        "Ready"
      );

    }

  },
  1000
);


/* =========================================================
   INITIAL CAMERA DEFAULTS
========================================================= */

setCameraShape(
  "rounded"
);

setCameraEffect(
  "none"
);

cameraBackground =
  "none";

updateCameraStatusUI();

updateMicUI();

updateRecordingUI();


/* =========================================================
   IMPORTANT:
   Attempt project restoration after initial setup.
========================================================= */

setTimeout(
  async () => {

    const restored =
      loadProjectFromStorage();


    if (restored) {

      resetHistory();

      await renderCurrentPage();

      showToast(
        "Previous Smart Board restored"
      );

    }

  },
  400
);


/* =========================================================
   FINAL READY MESSAGE
========================================================= */

console.log(
  "SNK Smart Board Step 9.3 loaded successfully."
);
