/* =========================================================
   SNK SMART BOARD
   STEP 10.3
   PROFESSIONAL CAMERA + BACKGROUND + RECORDING ENGINE
   ========================================================= */

"use strict";


/* =========================================================
   PDF.JS CONFIG
   ========================================================= */

if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}


/* =========================================================
   DOM HELPERS
   ========================================================= */

const $ = (id) => document.getElementById(id);

const boardStage = $("boardStage");
const boardStageWrapper = $("boardStageWrapper");

const drawingCanvas = $("drawingCanvas");
const drawingCtx = drawingCanvas
  ? drawingCanvas.getContext("2d")
  : null;

const recordCanvas = $("recordCanvas");
const recordCtx = recordCanvas
  ? recordCanvas.getContext("2d")
  : null;

const cameraProcessCanvas = $("cameraProcessCanvas");
const cameraProcessCtx = cameraProcessCanvas
  ? cameraProcessCanvas.getContext("2d")
  : null;

const slideLayer = $("slideLayer");
const slideImage = $("slideImage");

const pdfLayer = $("pdfLayer");
const pdfCanvas = $("pdfCanvas");

const textLayer = $("textLayer");

const welcomeScreen = $("welcomeScreen");

const cameraOverlay = $("cameraOverlay");
const mentorVideo = $("mentorVideo");
const cameraBackgroundLayer = $("cameraBackgroundLayer");
const cameraResizeHandle = $("cameraResizeHandle");

const toast = $("toast");


/* =========================================================
   APPLICATION STATE
   ========================================================= */

let currentTool = "pen";

let currentColor = "#1677ff";
let currentSize = 4;

let isDrawing = false;
let lastX = 0;
let lastY = 0;

let shapeStartX = 0;
let shapeStartY = 0;

let shapeSnapshot = null;

let undoStack = [];
let redoStack = [];

let zoomLevel = 1;


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
   TEXT
   ========================================================= */

let textItems = [];


/* =========================================================
   IMAGE
   ========================================================= */

let currentSlideData = null;


/* =========================================================
   PDF
   ========================================================= */

let pdfDocument = null;
let pdfPageNumber = 1;
let pdfFileUrl = null;
let pdfActive = false;


/* =========================================================
   CAMERA
   ========================================================= */

let cameraStream = null;

let cameraEnabled = false;

let cameraState = {
  x: 0,
  y: 0,
  width: 250,
  height: 150,
  shape: "rounded",
  background: "none",
  mirror: false,
  shadow: true
};

let cameraDragging = false;
let cameraResizing = false;

let cameraDragOffsetX = 0;
let cameraDragOffsetY = 0;

let cameraResizeStart = null;

let selfieSegmentation = null;
let segmentationReady = false;
let segmentationBusy = false;

let segmentedCameraCanvas = null;
let segmentedCameraCtx = null;


/* =========================================================
   MICROPHONE
   ========================================================= */

let micStream = null;
let micEnabled = false;


/* =========================================================
   RECORDING
   ========================================================= */

let mediaRecorder = null;
let recordingStream = null;

let recordedChunks = [];

let recordingActive = false;
let recordingPaused = false;

let recordingStartedAt = 0;
let recordingPausedAt = 0;
let totalPausedTime = 0;

let recordingAnimationId = null;
let recordingTimerId = null;

let recordingBlobUrl = null;


/* =========================================================
   CAMERA PROCESSING
   ========================================================= */

segmentedCameraCanvas = document.createElement("canvas");
segmentedCameraCanvas.width = 640;
segmentedCameraCanvas.height = 360;

segmentedCameraCtx =
  segmentedCameraCanvas.getContext("2d");


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

  const el = $("boardStatus");

  if (el) {
    el.textContent = message;
  }
}


/* =========================================================
   DRAWING CANVAS RESIZE
   ========================================================= */

function resizeDrawingCanvas() {

  if (!drawingCanvas || !boardStage) return;

  const rect = boardStage.getBoundingClientRect();

  if (!rect.width || !rect.height) return;

  const dpr = Math.max(
    1,
    Math.min(window.devicePixelRatio || 1, 2)
  );

  const oldData = drawingCanvas.width > 0
    ? drawingCanvas.toDataURL()
    : null;

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

  drawingCtx.lineCap = "round";
  drawingCtx.lineJoin = "round";

  if (oldData) {

    const image = new Image();

    image.onload = () => {

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
    };

    image.src = oldData;
  }
}


/* =========================================================
   POINTER POSITION
   ========================================================= */

function getPointerPosition(event) {

  const rect =
    drawingCanvas.getBoundingClientRect();

  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}


/* =========================================================
   TOOL SELECTION
   ========================================================= */

function setTool(tool) {

  currentTool = tool;

  document
    .querySelectorAll(".tool-btn")
    .forEach((button) => {

      button.classList.remove("active");
    });

  const buttonMap = {
    pen: "penBtn",
    marker: "markerBtn",
    eraser: "eraserBtn",
    text: "textBtn",
    shape: "shapeBtn"
  };

  const activeButton =
    $(buttonMap[tool]);

  if (activeButton) {
    activeButton.classList.add("active");
  }

  if (!drawingCanvas) return;

  if (tool === "text") {

    drawingCanvas.style.cursor =
      "text";

  } else if (tool === "eraser") {

    drawingCanvas.style.cursor =
      "cell";

  } else {

    drawingCanvas.style.cursor =
      "crosshair";
  }
}


/* =========================================================
   DRAWING STYLE
   ========================================================= */

function applyDrawingStyle() {

  drawingCtx.globalCompositeOperation =
    currentTool === "eraser"
      ? "destination-out"
      : "source-over";

  drawingCtx.strokeStyle =
    currentColor;

  drawingCtx.lineWidth =
    currentSize;

  drawingCtx.lineCap =
    "round";

  drawingCtx.lineJoin =
    "round";

  if (currentTool === "marker") {

    drawingCtx.globalAlpha = 0.25;

    drawingCtx.lineWidth =
      Math.max(currentSize * 3, 8);

  } else {

    drawingCtx.globalAlpha = 1;
  }
}


/* =========================================================
   SAVE HISTORY
   ========================================================= */

function saveHistory() {

  if (!drawingCanvas) return;

  const image =
    drawingCanvas.toDataURL("image/png");

  undoStack.push(image);

  if (undoStack.length > 40) {
    undoStack.shift();
  }

  redoStack = [];
}


/* =========================================================
   RESTORE CANVAS DATA
   ========================================================= */

function restoreCanvasData(data) {

  if (!data || !drawingCanvas) return;

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

    drawingCtx.globalCompositeOperation =
      "source-over";

    drawingCtx.globalAlpha = 1;

    drawingCtx.drawImage(
      image,
      0,
      0,
      rect.width,
      rect.height
    );
  };

  image.src = data;
}


/* =========================================================
   POINTER DOWN
   ========================================================= */

function handlePointerDown(event) {

  if (!drawingCanvas) return;

  if (
    event.pointerType === "mouse" &&
    event.button !== 0
  ) {
    return;
  }

  if (currentTool === "text") {

    createTextAtPointer(event);

    return;
  }

  const point =
    getPointerPosition(event);

  isDrawing = true;

  lastX = point.x;
  lastY = point.y;

  shapeStartX = point.x;
  shapeStartY = point.y;

  if (currentTool === "shape") {

    shapeSnapshot =
      drawingCtx.getImageData(
        0,
        0,
        drawingCanvas.width,
        drawingCanvas.height
      );

    return;
  }

  drawingCanvas.setPointerCapture(
    event.pointerId
  );

  applyDrawingStyle();

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


/* =========================================================
   POINTER MOVE
   ========================================================= */

function handlePointerMove(event) {

  if (!isDrawing) return;

  const point =
    getPointerPosition(event);

  if (currentTool === "shape") {

    drawShapePreview(
      point.x,
      point.y
    );

    return;
  }

  applyDrawingStyle();

  drawingCtx.beginPath();

  drawingCtx.moveTo(
    lastX,
    lastY
  );

  drawingCtx.lineTo(
    point.x,
    point.y
  );

  drawingCtx.stroke();

  lastX = point.x;
  lastY = point.y;
}


/* =========================================================
   POINTER UP
   ========================================================= */

function handlePointerUp(event) {

  if (!isDrawing) return;

  if (currentTool === "shape") {

    const point =
      getPointerPosition(event);

    drawFinalShape(
      point.x,
      point.y
    );
  }

  isDrawing = false;

  try {
    drawingCanvas.releasePointerCapture(
      event.pointerId
    );
  } catch (error) {}

  drawingCtx.globalAlpha = 1;

  drawingCtx.globalCompositeOperation =
    "source-over";

  savePageState();
}


/* =========================================================
   SHAPE PREVIEW
   ========================================================= */

function drawShapePreview(x, y) {

  if (!shapeSnapshot) return;

  drawingCtx.putImageData(
    shapeSnapshot,
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

  drawingCtx.lineCap =
    "round";

  drawingCtx.lineJoin =
    "round";

  drawingCtx.strokeRect(
    shapeStartX,
    shapeStartY,
    x - shapeStartX,
    y - shapeStartY
  );
}


/* =========================================================
   FINAL SHAPE
   ========================================================= */

function drawFinalShape(x, y) {

  if (!shapeSnapshot) return;

  drawingCtx.putImageData(
    shapeSnapshot,
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

  drawingCtx.strokeRect(
    shapeStartX,
    shapeStartY,
    x - shapeStartX,
    y - shapeStartY
  );

  shapeSnapshot = null;
}


/* =========================================================
   TEXT
   ========================================================= */

function createTextAtPointer(event) {

  const point =
    getPointerPosition(event);

  const text =
    window.prompt(
      "Enter text:"
    );

  if (!text || !text.trim()) {
    return;
  }

  const item = {
    text: text.trim(),
    x: point.x,
    y: point.y,
    size: Math.max(
      14,
      currentSize * 5
    ),
    color: currentColor
  };

  textItems.push(item);

  renderTextLayer();

  savePageState();
}


/* =========================================================
   RENDER TEXT
   ========================================================= */

function renderTextLayer() {

  if (!textLayer) return;

  textLayer.innerHTML = "";

  textItems.forEach(
    (item, index) => {

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

      element.dataset.index =
        index;

      textLayer.appendChild(
        element
      );

      makeTextDraggable(
        element,
        item
      );
    }
  );
}


/* =========================================================
   TEXT DRAG
   ========================================================= */

function makeTextDraggable(
  element,
  item
) {

  let dragging = false;

  let offsetX = 0;
  let offsetY = 0;

  element.addEventListener(
    "pointerdown",
    (event) => {

      dragging = true;

      offsetX =
        event.clientX -
        item.x -
        boardStage.getBoundingClientRect().left;

      offsetY =
        event.clientY -
        item.y -
        boardStage.getBoundingClientRect().top;

      element.setPointerCapture(
        event.pointerId
      );
    }
  );

  element.addEventListener(
    "pointermove",
    (event) => {

      if (!dragging) return;

      const rect =
        boardStage.getBoundingClientRect();

      item.x =
        event.clientX -
        rect.left -
        offsetX;

      item.y =
        event.clientY -
        rect.top -
        offsetY;

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

      savePageState();
    }
  );
}


/* =========================================================
   CLEAR BOARD
   ========================================================= */

function clearBoard() {

  if (!drawingCanvas) return;

  saveHistory();

  const rect =
    boardStage.getBoundingClientRect();

  drawingCtx.clearRect(
    0,
    0,
    rect.width,
    rect.height
  );

  textItems = [];

  renderTextLayer();

  savePageState();

  showToast(
    "Board cleared"
  );
}


/* =========================================================
   UNDO
   ========================================================= */

function undo() {

  if (!undoStack.length) {

    showToast(
      "Nothing to undo"
    );

    return;
  }

  const current =
    drawingCanvas.toDataURL();

  redoStack.push(current);

  const previous =
    undoStack.pop();

  restoreCanvasData(
    previous
  );

  savePageState();
}


/* =========================================================
   REDO
   ========================================================= */

function redo() {

  if (!redoStack.length) {

    showToast(
      "Nothing to redo"
    );

    return;
  }

  const current =
    drawingCanvas.toDataURL();

  undoStack.push(current);

  const next =
    redoStack.pop();

  restoreCanvasData(
    next
  );

  savePageState();
}


/* =========================================================
   PAGE STATE
   ========================================================= */

function savePageState() {

  if (!pages[currentPageIndex]) {
    return;
  }

  pages[currentPageIndex].drawingData =
    drawingCanvas.toDataURL("image/png");

  pages[currentPageIndex].textItems =
    JSON.parse(
      JSON.stringify(textItems)
    );

  pages[currentPageIndex].notes =
    $("notesInput")
      ? $("notesInput").value
      : "";

  pages[currentPageIndex].slideData =
    currentSlideData;

  saveAllData();
}


/* =========================================================
   LOAD PAGE
   ========================================================= */

function loadPage(index) {

  if (
    index < 0 ||
    index >= pages.length
  ) {
    return;
  }

  currentPageIndex =
    index;

  const page =
    pages[currentPageIndex];

  undoStack = [];
  redoStack = [];

  textItems =
    JSON.parse(
      JSON.stringify(
        page.textItems || []
      )
    );

  currentSlideData =
    page.slideData || null;

  renderCurrentPage();

  if ($("notesInput")) {

    $("notesInput").value =
      page.notes || "";
  }

  renderPageList();

  updatePageNumber();

  showToast(
    `Page ${index + 1}`
  );
}


/* =========================================================
   RENDER CURRENT PAGE
   ========================================================= */

function renderCurrentPage() {

  const rect =
    boardStage.getBoundingClientRect();

  drawingCtx.clearRect(
    0,
    0,
    rect.width,
    rect.height
  );

  if (
    pages[currentPageIndex] &&
    pages[currentPageIndex].drawingData
  ) {

    restoreCanvasData(
      pages[currentPageIndex].drawingData
    );
  }

  renderTextLayer();

  renderSlide();

  if (welcomeScreen) {

    welcomeScreen.style.display =
      (
        !currentSlideData &&
        !pdfActive &&
        !pages[currentPageIndex].drawingData &&
        textItems.length === 0
      )
        ? "flex"
        : "none";
  }
}


/* =========================================================
   RENDER SLIDE
   ========================================================= */

function renderSlide() {

  if (!slideImage) return;

  if (currentSlideData) {

    slideImage.src =
      currentSlideData;

    slideImage.style.display =
      "block";

  } else {

    slideImage.removeAttribute(
      "src"
    );

    slideImage.style.display =
      "none";
  }
}


/* =========================================================
   PAGE LIST
   ========================================================= */

function renderPageList() {

  const pageList =
    $("pageList");

  if (!pageList) return;

  pageList.innerHTML = "";

  pages.forEach(
    (_, index) => {

      const item =
        document.createElement("button");

      item.type = "button";

      item.className =
        "page-item";

      if (
        index === currentPageIndex
      ) {
        item.classList.add(
          "active"
        );
      }

      item.textContent =
        index + 1;

      item.addEventListener(
        "click",
        () => loadPage(index)
      );

      pageList.appendChild(
        item
      );
    }
  );
}


/* =========================================================
   PAGE NUMBER
   ========================================================= */

function updatePageNumber() {

  const number =
    $("currentPageNumber");

  if (number) {
    number.textContent =
      currentPageIndex + 1;
  }
}


/* =========================================================
   ADD PAGE
   ========================================================= */

function addPage() {

  savePageState();

  pages.push({
    drawingData: null,
    textItems: [],
    notes: "",
    slideData: null
  });

  loadPage(
    pages.length - 1
  );
}


/* =========================================================
   IMAGE UPLOAD
   ========================================================= */

function openImagePicker() {

  const input =
    $("imageInput");

  if (input) {
    input.click();
  }
}


function handleImageUpload(file) {

  if (!file) return;

  const reader =
    new FileReader();

  reader.onload = () => {

    currentSlideData =
      reader.result;

    pages[currentPageIndex].slideData =
      currentSlideData;

    renderSlide();

    if (welcomeScreen) {
      welcomeScreen.style.display =
        "none";
    }

    savePageState();

    showToast(
      "Image added to board"
    );
  };

  reader.readAsDataURL(
    file
  );
}


/* =========================================================
   PDF UPLOAD
   ========================================================= */

function openPdfPicker() {

  const input =
    $("pdfInput");

  if (input) {
    input.click();
  }
}


async function handlePdfUpload(file) {

  if (!file || !window.pdfjsLib) {

    showToast(
      "PDF engine unavailable"
    );

    return;
  }

  try {

    if (pdfFileUrl) {

      URL.revokeObjectURL(
        pdfFileUrl
      );
    }

    pdfFileUrl =
      URL.createObjectURL(
        file
      );

    pdfDocument =
      await pdfjsLib.getDocument({
        url: pdfFileUrl
      }).promise;

    pdfPageNumber = 1;

    pdfActive = true;

    currentSlideData = null;

    renderSlide();

    await renderPdfPage();

    const toolbar =
      $("pdfToolbar");

    if (toolbar) {
      toolbar.hidden = false;
    }

    const fileName =
      $("pdfFileName");

    if (fileName) {
      fileName.textContent =
        file.name;
    }

    if (welcomeScreen) {
      welcomeScreen.style.display =
        "none";
    }

    showToast(
      "PDF loaded"
    );

  } catch (error) {

    console.error(
      "PDF error:",
      error
    );

    showToast(
      "Could not load PDF"
    );
  }
}


/* =========================================================
   RENDER PDF PAGE
   ========================================================= */

async function renderPdfPage() {

  if (
    !pdfDocument ||
    !pdfCanvas ||
    !boardStage
  ) {
    return;
  }

  const page =
    await pdfDocument.getPage(
      pdfPageNumber
    );

  const baseViewport =
    page.getViewport({
      scale: 1
    });

  const rect =
    boardStage.getBoundingClientRect();

  const scale =
    Math.min(
      rect.width /
        baseViewport.width,
      rect.height /
        baseViewport.height
    );

  const viewport =
    page.getViewport({
      scale: Math.max(
        0.1,
        scale
      )
    });

  const dpr =
    Math.min(
      window.devicePixelRatio || 1,
      2
    );

  pdfCanvas.width =
    Math.round(
      viewport.width * dpr
    );

  pdfCanvas.height =
    Math.round(
      viewport.height * dpr
    );

  pdfCanvas.style.width =
    `${viewport.width}px`;

  pdfCanvas.style.height =
    `${viewport.height}px`;

  const ctx =
    pdfCanvas.getContext("2d");

  ctx.setTransform(
    dpr,
    0,
    0,
    dpr,
    0,
    0
  );

  await page.render({
    canvasContext: ctx,
    viewport
  }).promise;

  pdfCanvas.style.display =
    "block";

  if (pdfLayer) {
    pdfLayer.style.display =
      "flex";
  }

  updatePdfInfo();
}


/* =========================================================
   PDF INFO
   ========================================================= */

function updatePdfInfo() {

  const info =
    $("pdfPageInfo");

  if (!info || !pdfDocument) {
    return;
  }

  info.textContent =
    `${pdfPageNumber} / ${pdfDocument.numPages}`;
}


/* =========================================================
   PDF NEXT
   ========================================================= */

async function nextPdfPage() {

  if (
    !pdfDocument ||
    pdfPageNumber >=
      pdfDocument.numPages
  ) {
    return;
  }

  pdfPageNumber++;

  await renderPdfPage();
}


/* =========================================================
   PDF PREVIOUS
   ========================================================= */

async function previousPdfPage() {

  if (
    !pdfDocument ||
    pdfPageNumber <= 1
  ) {
    return;
  }

  pdfPageNumber--;

  await renderPdfPage();
}


/* =========================================================
   CLOSE PDF
   ========================================================= */

function closePdf() {

  pdfActive = false;

  if (pdfCanvas) {

    pdfCanvas.style.display =
      "none";
  }

  if (pdfLayer) {

    pdfLayer.style.display =
      "none";
  }

  const toolbar =
    $("pdfToolbar");

  if (toolbar) {
    toolbar.hidden = true;
  }

  showToast(
    "PDF closed"
  );
}


/* =========================================================
   CAMERA POSITION
   ========================================================= */

function initializeCameraPosition() {

  if (!boardStage) return;

  const rect =
    boardStage.getBoundingClientRect();

  cameraState.width =
    Math.min(
      250,
      rect.width * 0.25
    );

  cameraState.height =
    cameraState.width *
    0.6;

  cameraState.x =
    Math.max(
      10,
      rect.width -
        cameraState.width -
        20
    );

  cameraState.y = 20;

  updateCameraOverlay();
}


/* =========================================================
   CAMERA OVERLAY UPDATE
   ========================================================= */

function updateCameraOverlay() {

  if (!cameraOverlay) return;

  cameraOverlay.style.left =
    `${cameraState.x}px`;

  cameraOverlay.style.top =
    `${cameraState.y}px`;

  cameraOverlay.style.width =
    `${cameraState.width}px`;

  cameraOverlay.style.height =
    `${cameraState.height}px`;

  cameraOverlay.classList.remove(
    "camera-rectangle",
    "camera-rounded",
    "camera-circle",
    "camera-mirrored",
    "camera-no-shadow",
    "camera-blur"
  );

  if (
    cameraState.shape ===
    "rectangle"
  ) {

    cameraOverlay.classList.add(
      "camera-rectangle"
    );

  } else if (
    cameraState.shape ===
    "circle"
  ) {

    cameraOverlay.classList.add(
      "camera-circle"
    );

  } else {

    cameraOverlay.classList.add(
      "camera-rounded"
    );
  }

  if (cameraState.mirror) {

    cameraOverlay.classList.add(
      "camera-mirrored"
    );
  }

  if (!cameraState.shadow) {

    cameraOverlay.classList.add(
      "camera-no-shadow"
    );
  }

  if (
    cameraState.background ===
    "blur"
  ) {

    cameraOverlay.classList.add(
      "camera-blur"
    );
  }

  applyCameraBackground();
}


/* =========================================================
   CAMERA BACKGROUND
   ========================================================= */

function applyCameraBackground() {

  if (!cameraBackgroundLayer) {
    return;
  }

  cameraBackgroundLayer.className =
    "camera-background-layer";

  switch (
    cameraState.background
  ) {

    case "blue":

      cameraBackgroundLayer.classList.add(
        "camera-bg-blue"
      );

      break;

    case "white":

      cameraBackgroundLayer.classList.add(
        "camera-bg-white"
      );

      break;

    case "office":

      cameraBackgroundLayer.classList.add(
        "camera-bg-office"
      );

      break;

    case "classroom":

      cameraBackgroundLayer.classList.add(
        "camera-bg-classroom"
      );

      break;

    default:
      break;
  }
}


/* =========================================================
   CAMERA DRAG
   ========================================================= */

function setupCameraDragging() {

  if (!cameraOverlay) return;

  cameraOverlay.addEventListener(
    "pointerdown",
    (event) => {

      if (
        event.target ===
        cameraResizeHandle
      ) {
        return;
      }

      if (
        event.target.closest(
          ".camera-mini-btn"
        )
      ) {
        return;
      }

      cameraDragging = true;

      const rect =
        cameraOverlay.getBoundingClientRect();

      cameraDragOffsetX =
        event.clientX -
        rect.left;

      cameraDragOffsetY =
        event.clientY -
        rect.top;

      cameraOverlay.setPointerCapture(
        event.pointerId
      );
    }
  );


  cameraOverlay.addEventListener(
    "pointermove",
    (event) => {

      if (!cameraDragging) return;

      const stageRect =
        boardStage.getBoundingClientRect();

      let x =
        event.clientX -
        stageRect.left -
        cameraDragOffsetX;

      let y =
        event.clientY -
        stageRect.top -
        cameraDragOffsetY;

      x = Math.max(
        0,
        Math.min(
          x,
          stageRect.width -
            cameraState.width
        )
      );

      y = Math.max(
        0,
        Math.min(
          y,
          stageRect.height -
            cameraState.height
        )
      );

      cameraState.x = x;
      cameraState.y = y;

      updateCameraOverlay();
    }
  );


  cameraOverlay.addEventListener(
    "pointerup",
    () => {

      cameraDragging = false;
    }
  );
}


/* =========================================================
   CAMERA RESIZE
   ========================================================= */

function setupCameraResize() {

  if (!cameraResizeHandle) {
    return;
  }

  cameraResizeHandle.addEventListener(
    "pointerdown",
    (event) => {

      event.stopPropagation();

      cameraResizing = true;

      cameraResizeStart = {

        x: event.clientX,

        y: event.clientY,

        width:
          cameraState.width,

        height:
          cameraState.height,

        left:
          cameraState.x,

        top:
          cameraState.y
      };

      cameraResizeHandle.setPointerCapture(
        event.pointerId
      );
    }
  );


  cameraResizeHandle.addEventListener(
    "pointermove",
    (event) => {

      if (!cameraResizing) return;

      const start =
        cameraResizeStart;

      const dx =
        event.clientX -
        start.x;

      let newWidth =
        start.width + dx;

      const stageRect =
        boardStage.getBoundingClientRect();

      const minWidth =
        130;

      const maxWidth =
        stageRect.width *
        0.45;

      newWidth =
        Math.max(
          minWidth,
          Math.min(
            newWidth,
            maxWidth
          )
        );

      let ratio =
        start.height /
        start.width;

      let newHeight =
        newWidth * ratio;

      const maxHeight =
        stageRect.height *
        0.55;

      if (
        newHeight >
        maxHeight
      ) {

        newHeight =
          maxHeight;

        newWidth =
          newHeight /
          ratio;
      }

      cameraState.width =
        newWidth;

      cameraState.height =
        newHeight;

      updateCameraOverlay();
    }
  );


  cameraResizeHandle.addEventListener(
    "pointerup",
    () => {

      cameraResizing = false;

      cameraResizeStart = null;
    }
  );
}


/* =========================================================
   CAMERA SHAPE
   ========================================================= */

function setCameraShape(shape) {

  cameraState.shape =
    shape || "rounded";

  if (
    shape === "circle"
  ) {

    const size =
      Math.min(
        cameraState.width,
        cameraState.height
      );

    cameraState.width =
      size;

    cameraState.height =
      size;
  }

  updateCameraOverlay();
}


/* =========================================================
   CAMERA BACKGROUND SELECT
   ========================================================= */

function setCameraBackground(
  background
) {

  cameraState.background =
    background || "none";

  updateCameraOverlay();

  /*
    Start AI segmentation for
    blur/background modes.
  */

  if (
    background === "blur" ||
    background === "office" ||
    background === "classroom" ||
    background === "blue"
  ) {

    initializeSegmentation();
  }
}


/* =========================================================
   CAMERA MIRROR
   ========================================================= */

function toggleCameraMirror(
  value
) {

  cameraState.mirror =
    typeof value === "boolean"
      ? value
      : !cameraState.mirror;

  updateCameraOverlay();
}


/* =========================================================
   CAMERA SHADOW
   ========================================================= */

function toggleCameraShadow(
  value
) {

  cameraState.shadow =
    typeof value === "boolean"
      ? value
      : !cameraState.shadow;

  updateCameraOverlay();
}


/* =========================================================
   CAMERA ACCESS
   ========================================================= */

async function startCamera() {

  if (cameraStream) {

    cameraEnabled = true;

    if (cameraOverlay) {
      cameraOverlay.hidden = false;
    }

    updateCameraOverlay();

    return;
  }

  if (
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia
  ) {

    showToast(
      "Camera is not supported"
    );

    return;
  }

  try {

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

    if (cameraOverlay) {

      cameraOverlay.hidden =
        false;
    }

    initializeCameraPosition();

    updateCameraOverlay();

    const status =
      $("recordingPanelCamera");

    if (status) {
      status.textContent =
        "On";
    }

    showToast(
      "Camera ON"
    );

  } catch (error) {

    console.error(
      "Camera error:",
      error
    );

    showToast(
      "Camera permission denied"
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
        (track) =>
          track.stop()
      );

    cameraStream = null;
  }

  if (mentorVideo) {

    mentorVideo.srcObject =
      null;
  }

  cameraEnabled = false;

  if (cameraOverlay) {

    cameraOverlay.hidden =
      true;
  }

  const status =
    $("recordingPanelCamera");

  if (status) {
    status.textContent =
      "Off";
  }

  showToast(
    "Camera OFF"
  );
}


/* =========================================================
   MICROPHONE
   ========================================================= */

async function startMicrophone() {

  if (micStream) {

    micEnabled = true;

    micStream
      .getAudioTracks()
      .forEach(
        (track) =>
          track.enabled = true
      );

    updateMicStatus();

    return;
  }

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
      await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

    micEnabled = true;

    updateMicStatus();

    showToast(
      "Microphone ON"
    );

  } catch (error) {

    console.error(
      "Microphone error:",
      error
    );

    showToast(
      "Microphone permission denied"
    );
  }
}


/* =========================================================
   STOP MICROPHONE
   ========================================================= */

function stopMicrophone() {

  if (micStream) {

    micStream
      .getTracks()
      .forEach(
        (track) =>
          track.stop()
      );

    micStream = null;
  }

  micEnabled = false;

  updateMicStatus();

  showToast(
    "Microphone OFF"
  );
}


/* =========================================================
   MIC STATUS
   ========================================================= */

function updateMicStatus() {

  const status =
    $("recordingPanelMic");

  if (status) {

    status.textContent =
      micEnabled
        ? "On"
        : "Off";
  }

  const button =
    $("micBtn");

  if (button) {

    button.classList.toggle(
      "active",
      micEnabled
    );
  }
}


/* =========================================================
   AI SELFIE SEGMENTATION
   ========================================================= */

async function initializeSegmentation() {

  if (segmentationReady) {
    return;
  }

  if (
    typeof SelfieSegmentation ===
    "undefined"
  ) {

    console.warn(
      "MediaPipe Selfie Segmentation unavailable"
    );

    return;
  }

  try {

    selfieSegmentation =
      new SelfieSegmentation({
        locateFile: (file) => {

          return (
            "https://cdn.jsdelivr.net/npm/" +
            "@mediapipe/selfie_segmentation/" +
            file
          );
        }
      });

    selfieSegmentation.setOptions({
      modelSelection: 1
    });

    selfieSegmentation.onResults(
      handleSegmentationResults
    );

    segmentationReady = true;

  } catch (error) {

    console.error(
      "Segmentation setup error:",
      error
    );
  }
}


/* =========================================================
   SEGMENTATION RESULTS
   ========================================================= */

function handleSegmentationResults(
  results
) {

  if (
    !results ||
    !results.image ||
    !segmentedCameraCtx
  ) {
    return;
  }

  const width =
    segmentedCameraCanvas.width;

  const height =
    segmentedCameraCanvas.height;

  segmentedCameraCtx.clearRect(
    0,
    0,
    width,
    height
  );

  /*
    Draw selected background.
  */

  drawCameraBackgroundToCanvas(
    segmentedCameraCtx,
    width,
    height,
    cameraState.background
  );

  /*
    Keep the person.
  */

  segmentedCameraCtx.save();

  segmentedCameraCtx.globalCompositeOperation =
    "source-in";

  segmentedCameraCtx.drawImage(
    results.image,
    0,
    0,
    width,
    height
  );

  segmentedCameraCtx.restore();

  segmentationBusy = false;
}


/* =========================================================
   DRAW CAMERA BACKGROUND
   ========================================================= */

function drawCameraBackgroundToCanvas(
  ctx,
  width,
  height,
  type
) {

  if (type === "none") {

    ctx.fillStyle =
      "#111827";

    ctx.fillRect(
      0,
      0,
      width,
      height
    );

    return;
  }


  if (type === "white") {

    ctx.fillStyle =
      "#ffffff";

    ctx.fillRect(
      0,
      0,
      width,
      height
    );

    return;
  }


  if (type === "blue") {

    const gradient =
      ctx.createLinearGradient(
        0,
        0,
        width,
        height
      );

    gradient.addColorStop(
      0,
      "#d5e9fb"
    );

    gradient.addColorStop(
      1,
      "#ffffff"
    );

    ctx.fillStyle =
      gradient;

    ctx.fillRect(
      0,
      0,
      width,
      height
    );

    return;
  }


  if (type === "office") {

    const gradient =
      ctx.createLinearGradient(
        0,
        0,
        width,
        height
      );

    gradient.addColorStop(
      0,
      "#d8e4ef"
    );

    gradient.addColorStop(
      0.5,
      "#f5f7fa"
    );

    gradient.addColorStop(
      1,
      "#cbd5e1"
    );

    ctx.fillStyle =
      gradient;

    ctx.fillRect(
      0,
      0,
      width,
      height
    );

    /*
      Simple abstract office lines.
    */

    ctx.strokeStyle =
      "rgba(71,85,105,0.16)";

    ctx.lineWidth = 3;

    for (
      let x = 0;
      x < width;
      x += 80
    ) {

      ctx.beginPath();

      ctx.moveTo(
        x,
        height * 0.35
      );

      ctx.lineTo(
        x,
        height
      );

      ctx.stroke();
    }

    return;
  }


  if (type === "classroom") {

    const gradient =
      ctx.createLinearGradient(
        0,
        0,
        width,
        height
      );

    gradient.addColorStop(
      0,
      "#dbeafe"
    );

    gradient.addColorStop(
      1,
      "#eff6ff"
    );

    ctx.fillStyle =
      gradient;

    ctx.fillRect(
      0,
      0,
      width,
      height
    );

    /*
      Simple classroom board.
    */

    ctx.fillStyle =
      "#ffffff";

    ctx.fillRect(
      width * 0.18,
      height * 0.18,
      width * 0.64,
      height * 0.36
    );

    ctx.strokeStyle =
      "rgba(30,64,175,0.16)";

    ctx.lineWidth = 5;

    ctx.strokeRect(
      width * 0.18,
      height * 0.18,
      width * 0.64,
      height * 0.36
    );

    return;
  }


  /*
    Default.
  */

  ctx.fillStyle =
    "#ffffff";

  ctx.fillRect(
    0,
    0,
    width,
    height
  );
}


/* =========================================================
   GET CAMERA FRAME FOR RECORDING
   ========================================================= */

async function processCameraFrame() {

  if (
    !cameraEnabled ||
    !mentorVideo ||
    mentorVideo.readyState < 2
  ) {
    return null;
  }

  /*
    Original camera.
  */

  if (
    cameraState.background ===
    "none"
  ) {

    return mentorVideo;
  }


  /*
    Soft blur.
    This intentionally blurs the complete
    camera image, not just the background.
  */

  if (
    cameraState.background ===
    "blur"
  ) {

    const canvas =
      segmentedCameraCanvas;

    const ctx =
      segmentedCameraCtx;

    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    ctx.save();

    ctx.filter =
      "blur(5px)";

    ctx.drawImage(
      mentorVideo,
      0,
      0,
      canvas.width,
      canvas.height
    );

    ctx.restore();

    return canvas;
  }


  /*
    AI segmentation.
  */

  if (
    segmentationReady &&
    selfieSegmentation &&
    !segmentationBusy
  ) {

    segmentationBusy = true;

    try {

      await selfieSegmentation.send({
        image: mentorVideo
      });

      return segmentedCameraCanvas;

    } catch (error) {

      segmentationBusy = false;

      console.warn(
        "Segmentation frame error:",
        error
      );
    }
  }


  /*
    Fallback.
  */

  return mentorVideo;
}


/* =========================================================
   RECORDING MIME TYPE
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
   DRAW ROUNDED RECT
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

async function drawCameraToRecording() {

  if (
    !cameraEnabled ||
    !recordCtx ||
    !mentorVideo ||
    mentorVideo.readyState < 2
  ) {
    return;
  }

  const stageRect =
    boardStage.getBoundingClientRect();

  if (
    !stageRect.width ||
    !stageRect.height
  ) {
    return;
  }

  const scaleX =
    recordCanvas.width /
    stageRect.width;

  const scaleY =
    recordCanvas.height /
    stageRect.height;

  const x =
    cameraState.x *
    scaleX;

  const y =
    cameraState.y *
    scaleY;

  const width =
    cameraState.width *
    scaleX;

  const height =
    cameraState.height *
    scaleY;


  const cameraFrame =
    await processCameraFrame();

  if (!cameraFrame) {
    return;
  }


  recordCtx.save();


  /*
    Camera clipping.
  */

  if (
    cameraState.shape ===
    "circle"
  ) {

    const radius =
      Math.min(
        width,
        height
      ) / 2;

    recordCtx.beginPath();

    recordCtx.arc(
      x + width / 2,
      y + height / 2,
      radius,
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
      18 * scaleX
    );

    recordCtx.clip();
  }


  /*
    Mirror camera.
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
      cameraFrame,
      0,
      0,
      width,
      height
    );

  } else {

    recordCtx.drawImage(
      cameraFrame,
      x,
      y,
      width,
      height
    );
  }

  recordCtx.restore();


  /*
    Camera frame border.
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

    const radius =
      Math.min(
        width,
        height
      ) / 2;

    recordCtx.beginPath();

    recordCtx.arc(
      x + width / 2,
      y + height / 2,
      radius,
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
      18 * scaleX
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
   DRAW RECORDING BACKGROUND
   ========================================================= */

function drawRecordingBackground() {

  if (!recordCtx) return;

  recordCtx.fillStyle =
    "#ffffff";

  recordCtx.fillRect(
    0,
    0,
    recordCanvas.width,
    recordCanvas.height
  );


  /*
    PDF
  */

  if (
    pdfActive &&
    pdfCanvas &&
    pdfCanvas.width > 0
  ) {

    drawContain(
      recordCtx,
      pdfCanvas,
      0,
      0,
      recordCanvas.width,
      recordCanvas.height
    );

    return;
  }


  /*
    Image slide
  */

  if (
    slideImage &&
    currentSlideData &&
    slideImage.complete &&
    slideImage.naturalWidth
  ) {

    drawImageContain(
      recordCtx,
      slideImage,
      0,
      0,
      recordCanvas.width,
      recordCanvas.height
    );
  }
}


/* =========================================================
   DRAW CONTAIN
   ========================================================= */

function drawContain(
  ctx,
  source,
  x,
  y,
  width,
  height
) {

  if (
    !source.width ||
    !source.height
  ) {
    return;
  }

  const ratio =
    Math.min(
      width / source.width,
      height / source.height
    );

  const drawWidth =
    source.width * ratio;

  const drawHeight =
    source.height * ratio;

  const drawX =
    x +
    (width - drawWidth) / 2;

  const drawY =
    y +
    (height - drawHeight) / 2;

  ctx.drawImage(
    source,
    drawX,
    drawY,
    drawWidth,
    drawHeight
  );
}


/* =========================================================
   IMAGE CONTAIN
   ========================================================= */

function drawImageContain(
  ctx,
  image,
  x,
  y,
  width,
  height
) {

  const ratio =
    Math.min(
      width /
        image.naturalWidth,
      height /
        image.naturalHeight
    );

  const drawWidth =
    image.naturalWidth *
    ratio;

  const drawHeight =
    image.naturalHeight *
    ratio;

  const drawX =
    x +
    (width - drawWidth) / 2;

  const drawY =
    y +
    (height - drawHeight) / 2;

  ctx.drawImage(
    image,
    drawX,
    drawY,
    drawWidth,
    drawHeight
  );
}


/* =========================================================
   DRAW BOARD INTO RECORDING
   ========================================================= */

function drawRecordingBoard() {

  if (
    !recordCtx ||
    !drawingCanvas
  ) {
    return;
  }

  const stageRect =
    boardStage.getBoundingClientRect();

  if (
    !stageRect.width ||
    !stageRect.height
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
    Draw text.
  */

  const scaleX =
    recordCanvas.width /
    stageRect.width;

  const scaleY =
    recordCanvas.height /
    stageRect.height;

  textItems.forEach(
    (item) => {

      recordCtx.save();

      recordCtx.fillStyle =
        item.color ||
        "#172033";

      recordCtx.font =
        `${item.size * scaleX}px Segoe UI, Arial, sans-serif`;

      recordCtx.textBaseline =
        "top";

      recordCtx.fillText(
        item.text,
        item.x * scaleX,
        item.y * scaleY
      );

      recordCtx.restore();
    }
  );
}


/* =========================================================
   RECORDING FRAME
   ========================================================= */

async function renderRecordingFrame() {

  if (
    !recordingActive ||
    !recordCtx
  ) {
    return;
  }

  drawRecordingBackground();

  drawRecordingBoard();

  await drawCameraToRecording();


  /*
    Small SNK watermark.
  */

  recordCtx.save();

  recordCtx.fillStyle =
    "rgba(11,79,156,0.7)";

  recordCtx.font =
    "bold 18px Segoe UI, Arial";

  recordCtx.fillText(
    "SNK Smart Board",
    24,
    recordCanvas.height - 24
  );

  recordCtx.restore();


  if (recordingActive) {

    recordingAnimationId =
      requestAnimationFrame(
        renderRecordingFrame
      );
  }
}


/* =========================================================
   START RECORDING
   ========================================================= */

async function startRecording() {

  if (recordingActive) {
    return;
  }

  /*
    Microphone is required.
  */

  if (!micStream) {

    await startMicrophone();
  }

  if (!micStream) {

    showToast(
      "Turn on microphone first"
    );

    return;
  }


  /*
    Camera is optional.
  */


  try {

    recordedChunks = [];

    recordCanvas.width =
      1280;

    recordCanvas.height =
      720;


    recordingStream =
      recordCanvas.captureStream(
        30
      );


    /*
      Add microphone only.
      Camera is drawn into the
      recording canvas, so camera
      is NOT added as a second video
      track.
    */

    micStream
      .getAudioTracks()
      .forEach(
        (track) => {

          recordingStream.addTrack(
            track
          );
        }
      );


    const mimeType =
      getSupportedMimeType();


    mediaRecorder =
      mimeType
        ? new MediaRecorder(
            recordingStream,
            {
              mimeType
            }
          )
        : new MediaRecorder(
            recordingStream
          );


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
      finishRecording;


    mediaRecorder.onerror =
      (event) => {

        console.error(
          "MediaRecorder error:",
          event
        );

        showToast(
          "Recording error"
        );
      };


    mediaRecorder.start(
      1000
    );


    recordingActive = true;
    recordingPaused = false;

    recordingStartedAt =
      Date.now();

    recordingPausedAt = 0;
    totalPausedTime = 0;


    updateRecordingControls();

    startRecordingTimer();

    renderRecordingFrame();

    showToast(
      "Recording started"
    );

  } catch (error) {

    console.error(
      "Recording start error:",
      error
    );

    showToast(
      "Could not start recording"
    );
  }
}


/* =========================================================
   PAUSE RECORDING
   ========================================================= */

function pauseRecording() {

  if (
    !mediaRecorder ||
    !recordingActive ||
    recordingPaused
  ) {
    return;
  }

  if (
    mediaRecorder.state ===
    "recording"
  ) {

    mediaRecorder.pause();

    recordingPaused = true;

    recordingPausedAt =
      Date.now();

    updateRecordingControls();

    showToast(
      "Recording paused"
    );
  }
}


/* =========================================================
   RESUME RECORDING
   ========================================================= */

function resumeRecording() {

  if (
    !mediaRecorder ||
    !recordingActive ||
    !recordingPaused
  ) {
    return;
  }

  if (
    mediaRecorder.state ===
    "paused"
  ) {

    mediaRecorder.resume();

    if (recordingPausedAt) {

      totalPausedTime +=
        Date.now() -
        recordingPausedAt;
    }

    recordingPausedAt = 0;

    recordingPaused = false;

    updateRecordingControls();

    showToast(
      "Recording resumed"
    );
  }
}


/* =========================================================
   STOP RECORDING
   ========================================================= */

function stopRecording() {

  if (
    !mediaRecorder ||
    !recordingActive
  ) {
    return;
  }

  try {

    if (
      mediaRecorder.state !==
      "inactive"
    ) {

      mediaRecorder.stop();
    }

  } catch (error) {

    console.error(
      error
    );

    finishRecording();
  }
}


/* =========================================================
   FINISH RECORDING
   ========================================================= */

function finishRecording() {

  recordingActive = false;

  recordingPaused = false;

  cancelAnimationFrame(
    recordingAnimationId
  );

  recordingAnimationId = null;

  clearInterval(
    recordingTimerId
  );

  recordingTimerId = null;


  if (recordingStream) {

    recordingStream
      .getTracks()
      .forEach(
        (track) =>
          track.stop()
      );

    recordingStream = null;
  }


  if (!recordedChunks.length) {

    updateRecordingControls();

    showToast(
      "No recording data"
    );

    return;
  }


  const mimeType =
    mediaRecorder &&
    mediaRecorder.mimeType
      ? mediaRecorder.mimeType
      : "video/webm";


  const blob =
    new Blob(
      recordedChunks,
      {
        type: mimeType
      }
    );


  if (recordingBlobUrl) {

    URL.revokeObjectURL(
      recordingBlobUrl
    );
  }


  recordingBlobUrl =
    URL.createObjectURL(
      blob
    );


  const video =
    $("recordedVideo");

  if (video) {

    video.src =
      recordingBlobUrl;

    video.load();
  }


  const area =
    $("recordedVideoArea");

  if (area) {
    area.hidden = false;
  }


  updateRecordingControls();

  showToast(
    "Recording ready"
  );
}


/* =========================================================
   RECORDING TIMER
   ========================================================= */

function startRecordingTimer() {

  clearInterval(
    recordingTimerId
  );

  recordingTimerId =
    setInterval(
      updateRecordingTimer,
      250
    );

  updateRecordingTimer();
}


function updateRecordingTimer() {

  const timer =
    $("recordingPanelTimer");

  if (!timer) return;

  if (!recordingStartedAt) {

    timer.textContent =
      "00:00:00";

    return;
  }

  let elapsed =
    Date.now() -
    recordingStartedAt -
    totalPausedTime;

  if (
    recordingPaused &&
    recordingPausedAt
  ) {

    elapsed =
      recordingPausedAt -
      recordingStartedAt -
      totalPausedTime;
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

  timer.textContent =
    [
      hours,
      minutes,
      seconds
    ]
      .map(
        (value) =>
          String(value).padStart(
            2,
            "0"
          )
      )
      .join(":");
}


/* =========================================================
   RECORDING CONTROLS UI
   ========================================================= */

function updateRecordingControls() {

  const start =
    $("startRecordingBtn");

  const pause =
    $("pauseRecordingBtn");

  const resume =
    $("resumeRecordingBtn");

  const stop =
    $("stopRecordingBtn");

  const status =
    $("recordingPanelStatus");


  if (start) {

    start.disabled =
      recordingActive;
  }

  if (pause) {

    pause.disabled =
      !recordingActive ||
      recordingPaused;
  }

  if (resume) {

    resume.disabled =
      !recordingActive ||
      !recordingPaused;
  }

  if (stop) {

    stop.disabled =
      !recordingActive;
  }


  if (status) {

    if (recordingActive) {

      status.textContent =
        recordingPaused
          ? "Recording paused"
          : "Recording in progress";

    } else {

      status.textContent =
        recordingBlobUrl
          ? "Recording completed"
          : "Ready to record";
    }
  }
}


/* =========================================================
   DOWNLOAD RECORDING
   ========================================================= */

function downloadRecording() {

  if (!recordingBlobUrl) {

    showToast(
      "No recording available"
    );

    return;
  }

  const link =
    document.createElement("a");

  link.href =
    recordingBlobUrl;

  link.download =
    `SNK-Smart-Board-${getDateFileName()}.webm`;

  document.body.appendChild(
    link
  );

  link.click();

  link.remove();

  showToast(
    "Download started"
  );
}


/* =========================================================
   DATE FILE NAME
   ========================================================= */

function getDateFileName() {

  const date =
    new Date();

  return date
    .toISOString()
    .replace(
      /[:.]/g,
      "-"
    )
    .replace(
      "T",
      "_"
    )
    .slice(
      0,
      19
    );
}


/* =========================================================
   SAVE COMPOSITE PNG
   ========================================================= */

async function saveCompositePNG() {

  const canvas =
    document.createElement(
      "canvas"
    );

  canvas.width =
    1280;

  canvas.height =
    720;

  const ctx =
    canvas.getContext("2d");


  /*
    Background.
  */

  ctx.fillStyle =
    "#ffffff";

  ctx.fillRect(
    0,
    0,
    canvas.width,
    canvas.height
  );


  /*
    PDF / image.
  */

  if (
    pdfActive &&
    pdfCanvas &&
    pdfCanvas.width
  ) {

    drawContain(
      ctx,
      pdfCanvas,
      0,
      0,
      canvas.width,
      canvas.height
    );

  } else if (
    slideImage &&
    currentSlideData &&
    slideImage.complete
  ) {

    drawImageContain(
      ctx,
      slideImage,
      0,
      0,
      canvas.width,
      canvas.height
    );
  }


  /*
    Board drawing.
  */

  ctx.drawImage(
    drawingCanvas,
    0,
    0,
    canvas.width,
    canvas.height
  );


  /*
    Text.
  */

  const stageRect =
    boardStage.getBoundingClientRect();

  const scaleX =
    canvas.width /
    stageRect.width;

  const scaleY =
    canvas.height /
    stageRect.height;

  textItems.forEach(
    (item) => {

      ctx.fillStyle =
        item.color ||
        "#172033";

      ctx.font =
        `${item.size * scaleX}px Segoe UI, Arial`;

      ctx.fillText(
        item.text,
        item.x * scaleX,
        item.y * scaleY
      );
    }
  );


  /*
    Camera.

    Camera image is asynchronous,
    therefore wait before export.
  */

  if (cameraEnabled) {

    const cameraFrame =
      await processCameraFrame();

    if (cameraFrame) {

      const x =
        cameraState.x *
        scaleX;

      const y =
        cameraState.y *
        scaleY;

      const width =
        cameraState.width *
        scaleX;

      const height =
        cameraState.height *
        scaleY;

      ctx.save();

      if (
        cameraState.shape ===
        "circle"
      ) {

        ctx.beginPath();

        ctx.arc(
          x + width / 2,
          y + height / 2,
          Math.min(
            width,
            height
          ) / 2,
          0,
          Math.PI * 2
        );

        ctx.clip();

      } else if (
        cameraState.shape ===
        "rounded"
      ) {

        roundedRectPath(
          ctx,
          x,
          y,
          width,
          height,
          18 * scaleX
        );

        ctx.clip();
      }


      if (cameraState.mirror) {

        ctx.translate(
          x + width,
          y
        );

        ctx.scale(
          -1,
          1
        );

        ctx.drawImage(
          cameraFrame,
          0,
          0,
          width,
          height
        );

      } else {

        ctx.drawImage(
          cameraFrame,
          x,
          y,
          width,
          height
        );
      }

      ctx.restore();
    }
  }


  canvas.toBlob(
    (blob) => {

      if (!blob) {

        showToast(
          "Could not save PNG"
        );

        return;
      }

      const url =
        URL.createObjectURL(
          blob
        );

      const link =
        document.createElement("a");

      link.href = url;

      link.download =
        `SNK-Smart-Board-${getDateFileName()}.png`;

      document.body.appendChild(
        link
      );

      link.click();

      link.remove();

      setTimeout(
        () =>
          URL.revokeObjectURL(
            url
          ),
        1000
      );

      showToast(
        "PNG saved"
      );
    },
    "image/png"
  );
}


/* =========================================================
   LOCAL STORAGE
   ========================================================= */

function saveAllData() {

  try {

    localStorage.setItem(
      "snkSmartBoardPages",
      JSON.stringify(
        pages
      )
    );

  } catch (error) {

    console.warn(
      "Could not save board:",
      error
    );
  }
}


/* =========================================================
   LOAD LOCAL STORAGE
   ========================================================= */

function loadAllData() {

  try {

    const saved =
      localStorage.getItem(
        "snkSmartBoardPages"
      );

    if (!saved) {
      return;
    }

    const parsed =
      JSON.parse(saved);

    if (
      Array.isArray(parsed) &&
      parsed.length
    ) {

      pages = parsed;

      currentPageIndex = 0;

      textItems =
        pages[0].textItems || [];

      currentSlideData =
        pages[0].slideData || null;
    }

  } catch (error) {

    console.warn(
      "Could not load board:",
      error
    );
  }
}


/* =========================================================
   NEW BOARD
   ========================================================= */

function newBoard() {

  const confirmed =
    window.confirm(
      "Create a new board?"
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

  currentSlideData = null;

  pdfActive = false;

  undoStack = [];
  redoStack = [];

  if (drawingCanvas) {

    const rect =
      boardStage.getBoundingClientRect();

    drawingCtx.clearRect(
      0,
      0,
      rect.width,
      rect.height
    );
  }

  renderTextLayer();

  renderSlide();

  closePdf();

  if ($("notesInput")) {

    $("notesInput").value =
      "";
  }

  renderPageList();

  updatePageNumber();

  saveAllData();

  if (welcomeScreen) {

    welcomeScreen.style.display =
      "flex";
  }

  showToast(
    "New board created"
  );
}


/* =========================================================
   FULLSCREEN
   ========================================================= */

async function toggleFullscreen() {

  if (!document.fullscreenElement) {

    try {

      await boardStageWrapper.requestFullscreen();

      document.body.classList.add(
        "fullscreen-mode"
      );

    } catch (error) {

      document.body.classList.add(
        "fullscreen-mode"
      );
    }

  } else {

    try {

      await document.exitFullscreen();

    } catch (error) {}

    document.body.classList.remove(
      "fullscreen-mode"
    );
  }
}


/* =========================================================
   ZOOM
   ========================================================= */

function applyZoom() {

  if (!boardStage) return;

  boardStage.style.transform =
    `scale(${zoomLevel})`;

  const zoomValue =
    $("zoomValue");

  if (zoomValue) {

    zoomValue.textContent =
      `${Math.round(
        zoomLevel * 100
      )}%`;
  }
}


function zoomIn() {

  zoomLevel =
    Math.min(
      1.5,
      zoomLevel + 0.1
    );

  applyZoom();
}


function zoomOut() {

  zoomLevel =
    Math.max(
      0.6,
      zoomLevel - 0.1
    );

  applyZoom();
}


function resetZoom() {

  zoomLevel = 1;

  applyZoom();
}


/* =========================================================
   NOTES
   ========================================================= */

function setupNotes() {

  const input =
    $("notesInput");

  if (!input) return;

  input.addEventListener(
    "input",
    () => {

      if (
        pages[currentPageIndex]
      ) {

        pages[currentPageIndex].notes =
          input.value;
      }

      const status =
        $("notesStatus");

      if (status) {

        status.textContent =
          "Saving...";
      }

      clearTimeout(
        setupNotes.timer
      );

      setupNotes.timer =
        setTimeout(
          () => {

            saveAllData();

            if (status) {

              status.textContent =
                "Saved locally";
            }

          },
          500
        );
    }
  );
}


/* =========================================================
   CAMERA SETTINGS
   ========================================================= */

function setupCameraSettings() {

  const background =
    $("cameraBackground");

  const backgroundPanel =
    $("cameraBackgroundPanel");

  const shape =
    $("cameraShape");

  const shapePanel =
    $("cameraShapePanel");

  const mirrorCheck =
    $("cameraMirrorCheck");

  const shadowCheck =
    $("cameraShadowCheck");


  if (background) {

    background.addEventListener(
      "change",
      () => {

        setCameraBackground(
          background.value
        );

        if (backgroundPanel) {
          backgroundPanel.value =
            background.value;
        }
      }
    );
  }


  if (backgroundPanel) {

    backgroundPanel.addEventListener(
      "change",
      () => {

        setCameraBackground(
          backgroundPanel.value
        );

        if (background) {
          background.value =
            backgroundPanel.value;
        }
      }
    );
  }


  if (shape) {

    shape.addEventListener(
      "change",
      () => {

        setCameraShape(
          shape.value
        );

        if (shapePanel) {
          shapePanel.value =
            shape.value;
        }
      }
    );
  }


  if (shapePanel) {

    shapePanel.addEventListener(
      "change",
      () => {

        setCameraShape(
          shapePanel.value
        );

        if (shape) {
          shape.value =
            shapePanel.value;
        }
      }
    );
  }


  if (mirrorCheck) {

    mirrorCheck.addEventListener(
      "change",
      () => {

        toggleCameraMirror(
          mirrorCheck.checked
        );
      }
    );
  }


  if (shadowCheck) {

    shadowCheck.addEventListener(
      "change",
      () => {

        toggleCameraShadow(
          shadowCheck.checked
        );
      }
    );
  }


  const mirrorBtn =
    $("cameraMirrorBtn");

  if (mirrorBtn) {

    mirrorBtn.addEventListener(
      "click",
      () => {

        toggleCameraMirror();

        if (mirrorCheck) {

          mirrorCheck.checked =
            cameraState.mirror;
        }
      }
    );
  }


  const closeBtn =
    $("cameraCloseBtn");

  if (closeBtn) {

    closeBtn.addEventListener(
      "click",
      stopCamera
    );
  }


  const settingsBtn =
    $("cameraSettingsBtn");

  if (settingsBtn) {

    settingsBtn.addEventListener(
      "click",
      () => {

        const panel =
          $("cameraSettings");

        if (!panel) return;

        panel.hidden =
          !panel.hidden;
      }
    );
  }


  const closeSettings =
    $("closeCameraSettings");

  if (closeSettings) {

    closeSettings.addEventListener(
      "click",
      () => {

        const panel =
          $("cameraSettings");

        if (panel) {
          panel.hidden = true;
        }
      }
    );
  }
}


/* =========================================================
   RECORDING PANEL
   ========================================================= */

function openRecordingPanel() {

  const panel =
    $("recordingPanel");

  if (!panel) return;

  panel.hidden = false;

  updateRecordingControls();

  updateMicStatus();

  const cameraStatus =
    $("recordingPanelCamera");

  if (cameraStatus) {

    cameraStatus.textContent =
      cameraEnabled
        ? "On"
        : "Off";
  }
}


function closeRecordingPanel() {

  if (recordingActive) {

    showToast(
      "Stop recording first"
    );

    return;
  }

  const panel =
    $("recordingPanel");

  if (panel) {
    panel.hidden = true;
  }
}


/* =========================================================
   PERMISSION MODAL
   ========================================================= */

function openPermissionModal() {

  const modal =
    $("permissionModal");

  if (modal) {
    modal.hidden = false;
  }
}


function closePermissionModal() {

  const modal =
    $("permissionModal");

  if (modal) {
    modal.hidden = true;
  }
}


/* =========================================================
   EVENT LISTENERS
   ========================================================= */

function setupEventListeners() {

  /* Drawing */

  if (drawingCanvas) {

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
  }


  /* Tools */

  $("penBtn")?.addEventListener(
    "click",
    () =>
      setTool("pen")
  );

  $("markerBtn")?.addEventListener(
    "click",
    () =>
      setTool("marker")
  );

  $("eraserBtn")?.addEventListener(
    "click",
    () =>
      setTool("eraser")
  );

  $("textBtn")?.addEventListener(
    "click",
    () =>
      setTool("text")
  );

  $("shapeBtn")?.addEventListener(
    "click",
    () =>
      setTool("shape")
  );


  /* Color */

  $("colorPicker")?.addEventListener(
    "input",
    (event) => {

      currentColor =
        event.target.value;
    }
  );


  /* Size */

  $("sizeSlider")?.addEventListener(
    "input",
    (event) => {

      currentSize =
        Number(
          event.target.value
        );

      const value =
        $("sizeValue");

      if (value) {

        value.textContent =
          `${currentSize} px`;
      }
    }
  );


  /* Undo */

  $("undoBtn")?.addEventListener(
    "click",
    undo
  );


  /* Redo */

  $("redoBtn")?.addEventListener(
    "click",
    redo
  );


  /* Clear */

  $("clearBtn")?.addEventListener(
    "click",
    clearBoard
  );


  /* Image */

  $("imageBtn")?.addEventListener(
    "click",
    openImagePicker
  );


  $("imageInput")?.addEventListener(
    "change",
    (event) => {

      const file =
        event.target.files?.[0];

      handleImageUpload(
        file
      );

      event.target.value =
        "";
    }
  );


  /* PDF */

  $("pdfBtn")?.addEventListener(
    "click",
    openPdfPicker
  );


  $("pdfInput")?.addEventListener(
    "change",
    async (event) => {

      const file =
        event.target.files?.[0];

      await handlePdfUpload(
        file
      );

      event.target.value =
        "";
    }
  );


  /* PDF controls */

  $("pdfPrevBtn")?.addEventListener(
    "click",
    previousPdfPage
  );

  $("pdfNextBtn")?.addEventListener(
    "click",
    nextPdfPage
  );

  $("pdfCloseBtn")?.addEventListener(
    "click",
    closePdf
  );


  /* Pages */

  $("addPageBtn")?.addEventListener(
    "click",
    addPage
  );

  $("prevPageBtn")?.addEventListener(
    "click",
    () =>
      loadPage(
        currentPageIndex - 1
      )
  );

  $("nextPageBtn")?.addEventListener(
    "click",
    () =>
      loadPage(
        currentPageIndex + 1
      )
  );


  /* Notes */

  setupNotes();


  /* Camera */

  $("cameraBtn")?.addEventListener(
    "click",
    async () => {

      if (cameraEnabled) {

        stopCamera();

      } else {

        await startCamera();
      }
    }
  );


  /* Microphone */

  $("micBtn")?.addEventListener(
    "click",
    async () => {

      if (micEnabled) {

        stopMicrophone();

      } else {

        await startMicrophone();
      }
    }
  );


  /* Camera settings */

  setupCameraSettings();


  /* Recording */

  $("recordBtn")?.addEventListener(
    "click",
    openRecordingPanel
  );

  $("startRecordingBtn")?.addEventListener(
    "click",
    startRecording
  );

  $("pauseRecordingBtn")?.addEventListener(
    "click",
    pauseRecording
  );

  $("resumeRecordingBtn")?.addEventListener(
    "click",
    resumeRecording
  );

  $("stopRecordingBtn")?.addEventListener(
    "click",
    stopRecording
  );

  $("downloadRecordingBtn")?.addEventListener(
    "click",
    downloadRecording
  );


  /* Save */

  $("saveBtn")?.addEventListener(
    "click",
    saveCompositePNG
  );


  /* New */

  $("newBoardBtn")?.addEventListener(
    "click",
    newBoard
  );


  /* Fullscreen */

  $("fullscreenBtn")?.addEventListener(
    "click",
    toggleFullscreen
  );


  /* Zoom */

  $("zoomInBtn")?.addEventListener(
    "click",
    zoomIn
  );

  $("zoomOutBtn")?.addEventListener(
    "click",
    zoomOut
  );

  $("resetZoomBtn")?.addEventListener(
    "click",
    resetZoom
  );


  /* Permission */

  $("allowCameraBtn")?.addEventListener(
    "click",
    async () => {

      await startCamera();

      closePermissionModal();
    }
  );


  $("allowMicBtn")?.addEventListener(
    "click",
    async () => {

      await startMicrophone();

      closePermissionModal();
    }
  );


  $("closePermissionModal")?.addEventListener(
    "click",
    closePermissionModal
  );


  /* Camera */

  setupCameraDragging();

  setupCameraResize();
}


/* =========================================================
   KEYBOARD SHORTCUTS
   ========================================================= */

function setupKeyboardShortcuts() {

  document.addEventListener(
    "keydown",
    (event) => {

      if (
        event.target.tagName ===
        "INPUT" ||
        event.target.tagName ===
        "TEXTAREA"
      ) {
        return;
      }


      if (
        event.ctrlKey &&
        event.key.toLowerCase() ===
          "z"
      ) {

        event.preventDefault();

        undo();

        return;
      }


      if (
        event.ctrlKey &&
        event.key.toLowerCase() ===
          "y"
      ) {

        event.preventDefault();

        redo();

        return;
      }


      if (
        event.key ===
        "Escape"
      ) {

        if (
          recordingActive
        ) {

          showToast(
            "Stop recording first"
          );

          return;
        }

        const panel =
          $("recordingPanel");

        if (panel) {
          panel.hidden = true;
        }
      }


      if (
        event.key.toLowerCase() ===
        "p"
      ) {

        setTool("pen");
      }


      if (
        event.key.toLowerCase() ===
        "e"
      ) {

        setTool("eraser");
      }


      if (
        event.key.toLowerCase() ===
        "m"
      ) {

        setTool("marker");
      }
    }
  );
}


/* =========================================================
   WINDOW RESIZE
   ========================================================= */

window.addEventListener(
  "resize",
  () => {

    resizeDrawingCanvas();

    if (cameraEnabled) {

      const rect =
        boardStage.getBoundingClientRect();

      cameraState.x =
        Math.min(
          cameraState.x,
          Math.max(
            0,
            rect.width -
              cameraState.width
          )
        );

      cameraState.y =
        Math.min(
          cameraState.y,
          Math.max(
            0,
            rect.height -
              cameraState.height
          )
        );

      updateCameraOverlay();
    }

    if (pdfActive) {

      renderPdfPage();
    }
  }
);


/* =========================================================
   FULLSCREEN CHANGE
   ========================================================= */

document.addEventListener(
  "fullscreenchange",
  () => {

    if (
      !document.fullscreenElement
    ) {

      document.body.classList.remove(
        "fullscreen-mode"
      );

    } else {

      document.body.classList.add(
        "fullscreen-mode"
      );
    }

    setTimeout(
      () => {

        resizeDrawingCanvas();

        if (pdfActive) {
          renderPdfPage();
        }

        if (cameraEnabled) {
          updateCameraOverlay();
        }

      },
      200
    );
  }
);


/* =========================================================
   BEFORE UNLOAD
   ========================================================= */

window.addEventListener(
  "beforeunload",
  () => {

    if (cameraStream) {

      cameraStream
        .getTracks()
        .forEach(
          (track) =>
            track.stop()
        );
    }

    if (micStream) {

      micStream
        .getTracks()
        .forEach(
          (track) =>
            track.stop()
        );
    }

    if (recordingStream) {

      recordingStream
        .getTracks()
        .forEach(
          (track) =>
            track.stop()
        );
    }

    if (pdfFileUrl) {

      URL.revokeObjectURL(
        pdfFileUrl
      );
    }

    if (recordingBlobUrl) {

      URL.revokeObjectURL(
        recordingBlobUrl
      );
    }
  }
);


/* =========================================================
   INITIALIZE
   ========================================================= */

function initializeApp() {

  loadAllData();

  /*
    Initial board size.
  */

  requestAnimationFrame(
    () => {

      resizeDrawingCanvas();

      renderPageList();

      updatePageNumber();

      renderCurrentPage();

      initializeCameraPosition();

      updateCameraOverlay();

      setTool("pen");

      applyZoom();

      updateMicStatus();

      updateRecordingControls();

      setBoardStatus(
        "Ready"
      );
    }
  );
}


/* =========================================================
   START
   ========================================================= */

setupEventListeners();

setupKeyboardShortcuts();

initializeApp();
