/* =========================================================
   SNK SMART BOARD
   STEP 10.3 — PROFESSIONAL CAMERA + RECORDING ENGINE
   ========================================================= */

"use strict";

/* =========================================================
   GLOBAL ELEMENTS
========================================================= */

const $ = (id) => document.getElementById(id);

const boardStage =
  $("boardStage") ||
  $("boardStageWrapper") ||
  document.querySelector(".board-stage");

const drawingCanvas = $("drawingCanvas");
const textLayer = $("textLayer");
const slideLayer = $("slideLayer");
const pdfCanvas = $("pdfCanvas");

const mentorVideo = $("mentorVideo");
const cameraOverlay = $("cameraOverlay");

const imageInput = $("imageInput");
const pdfInput = $("pdfInput");

const toastEl = $("toast");

const recordCanvas = document.createElement("canvas");
recordCanvas.width = 1280;
recordCanvas.height = 720;

const recordCtx = recordCanvas.getContext("2d", {
  alpha: false
});

let drawingCtx = null;

if (drawingCanvas) {
  drawingCtx = drawingCanvas.getContext("2d", {
    willReadFrequently: true
  });
}

/* =========================================================
   APP STATE
========================================================= */

let currentTool = "pen";

let currentColor = "#111827";

let brushSize = 4;

let isDrawing = false;

let lastX = 0;
let lastY = 0;

let undoStack = [];
let redoStack = [];

let shapeStartX = 0;
let shapeStartY = 0;
let shapeSnapshot = null;

let currentShape = "rectangle";

let pages = [
  {
    drawingData: null,
    textItems: [],
    notes: "",
    slideData: null
  }
];

let currentPageIndex = 0;

let currentZoom = 1;

let pdfDoc = null;
let pdfPageNumber = 1;
let pdfPageCount = 0;
let pdfActive = false;
let pdfFileUrl = null;

let currentSlideImage = null;

let toastTimer = null;

/* =========================================================
   CAMERA STATE
========================================================= */

let cameraStream = null;

let micStream = null;

let cameraEnabled = false;

let micEnabled = false;

let cameraState = {
  x: 930,
  y: 35,
  width: 300,
  height: 170,

  shape: "rounded",

  effect: "none",

  background: "none",

  mirror: true,

  shadow: true,

  frame: true
};

let cameraDragging = false;
let cameraResizing = false;

let cameraDragOffsetX = 0;
let cameraDragOffsetY = 0;

let cameraResizeStart = null;

/* =========================================================
   AI CAMERA PROCESSING
========================================================= */

let selfieSegmentation = null;

let segmentationAvailable = false;

let segmentationBusy = false;

let segmentationResults = null;

let cameraProcessedCanvas = document.createElement("canvas");

cameraProcessedCanvas.width = 640;
cameraProcessedCanvas.height = 360;

let cameraProcessedCtx =
  cameraProcessedCanvas.getContext("2d", {
    willReadFrequently: true
  });

let personCanvas = document.createElement("canvas");

personCanvas.width = 640;
personCanvas.height = 360;

let personCtx =
  personCanvas.getContext("2d", {
    willReadFrequently: true
  });

let cameraProcessingAnimation = null;

/* =========================================================
   RECORDING STATE
========================================================= */

let mediaRecorder = null;

let recordingStream = null;

let recordedChunks = [];

let recordingActive = false;

let recordingPaused = false;

let recordingStartedAt = 0;

let recordingPausedAt = 0;

let totalPausedTime = 0;

let recordingAnimation = null;

let recordingBlobUrl = null;

/* =========================================================
   INITIALIZATION
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  initializeCanvas();

  initializeButtons();

  initializeDrawingTools();

  initializeImageUpload();

  initializePdfUpload();

  initializeCamera();

  initializeCameraSettings();

  initializePages();

  initializeNotes();

  initializeZoom();

  initializeKeyboardShortcuts();

  loadSavedBoard();

  renderCurrentPage();

  updateCameraUI();

  showToast("SNK Smart Board Ready");
});

/* =========================================================
   CANVAS
========================================================= */

function initializeCanvas() {
  if (!drawingCanvas || !boardStage) {
    return;
  }

  resizeDrawingCanvas();

  window.addEventListener("resize", resizeDrawingCanvas);

  drawingCanvas.style.touchAction = "none";

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

function resizeDrawingCanvas() {
  if (!drawingCanvas || !boardStage) {
    return;
  }

  const rect = boardStage.getBoundingClientRect();

  const oldCanvas = document.createElement("canvas");

  oldCanvas.width = drawingCanvas.width || 1;

  oldCanvas.height = drawingCanvas.height || 1;

  const oldCtx = oldCanvas.getContext("2d");

  if (drawingCanvas.width > 0 && drawingCanvas.height > 0) {
    oldCtx.drawImage(
      drawingCanvas,
      0,
      0
    );
  }

  drawingCanvas.width = Math.max(
    1,
    Math.floor(rect.width)
  );

  drawingCanvas.height = Math.max(
    1,
    Math.floor(rect.height)
  );

  drawingCanvas.style.width = `${rect.width}px`;

  drawingCanvas.style.height = `${rect.height}px`;

  drawingCtx = drawingCanvas.getContext("2d", {
    willReadFrequently: true
  });

  drawingCtx.lineCap = "round";

  drawingCtx.lineJoin = "round";

  if (
    oldCanvas.width > 1 &&
    oldCanvas.height > 1
  ) {
    drawingCtx.drawImage(
      oldCanvas,
      0,
      0,
      oldCanvas.width,
      oldCanvas.height,
      0,
      0,
      drawingCanvas.width,
      drawingCanvas.height
    );
  }

  updateCanvasLayerSize();
}

function updateCanvasLayerSize() {
  if (!textLayer || !boardStage) {
    return;
  }

  const rect = boardStage.getBoundingClientRect();

  textLayer.style.width = `${rect.width}px`;

  textLayer.style.height = `${rect.height}px`;
}

/* =========================================================
   DRAWING
========================================================= */

function handlePointerDown(event) {
  if (!drawingCtx || !drawingCanvas) {
    return;
  }

  if (
    currentTool === "text" ||
    currentTool === "shape"
  ) {
    return;
  }

  if (
    event.button !== undefined &&
    event.button !== 0 &&
    event.pointerType !== "touch" &&
    event.pointerType !== "pen"
  ) {
    return;
  }

  const point = getCanvasPoint(event);

  isDrawing = true;

  lastX = point.x;

  lastY = point.y;

  try {
    drawingCanvas.setPointerCapture(event.pointerId);
  } catch (error) {}

  saveHistory();

  drawingCtx.beginPath();

  drawingCtx.moveTo(
    lastX,
    lastY
  );

  drawingCtx.lineWidth = getPressureSize(event);

  if (currentTool === "eraser") {
    drawingCtx.globalCompositeOperation =
      "destination-out";

    drawingCtx.strokeStyle =
      "rgba(0,0,0,1)";
  } else {
    drawingCtx.globalCompositeOperation =
      "source-over";

    drawingCtx.strokeStyle =
      currentTool === "marker"
        ? hexToRgba(currentColor, 0.25)
        : currentColor;
  }

  drawingCtx.lineWidth =
    getPressureSize(event);

  drawingCtx.lineCap = "round";

  drawingCtx.lineJoin = "round";

  drawingCtx.lineTo(
    lastX + 0.01,
    lastY + 0.01
  );

  drawingCtx.stroke();
}

function handlePointerMove(event) {
  if (!isDrawing || !drawingCtx) {
    return;
  }

  const point = getCanvasPoint(event);

  drawingCtx.lineTo(
    point.x,
    point.y
  );

  drawingCtx.lineWidth =
    getPressureSize(event);

  drawingCtx.stroke();

  lastX = point.x;
  lastY = point.y;
}

function handlePointerUp(event) {
  if (!isDrawing) {
    return;
  }

  isDrawing = false;

  if (drawingCtx) {
    drawingCtx.closePath();

    drawingCtx.globalCompositeOperation =
      "source-over";
  }

  try {
    drawingCanvas.releasePointerCapture(
      event.pointerId
    );
  } catch (error) {}

  saveCurrentPageState();
}

function getCanvasPoint(event) {
  const rect =
    drawingCanvas.getBoundingClientRect();

  return {
    x:
      (event.clientX - rect.left) *
      (drawingCanvas.width / rect.width),

    y:
      (event.clientY - rect.top) *
      (drawingCanvas.height / rect.height)
  };
}

function getPressureSize(event) {
  let pressure = event.pressure;

  if (!pressure || pressure <= 0) {
    pressure = 0.5;
  }

  if (event.pointerType === "mouse") {
    pressure = 0.65;
  }

  return Math.max(
    1,
    brushSize * (0.55 + pressure)
  );
}

/* =========================================================
   TOOL BUTTONS
========================================================= */

function initializeDrawingTools() {
  const toolButtons =
    document.querySelectorAll(
      "[data-tool]"
    );

  toolButtons.forEach((button) => {
    button.addEventListener(
      "click",
      () => {
        const tool =
          button.dataset.tool;

        if (!tool) {
          return;
        }

        setTool(tool);
      }
    );
  });

  const colorInput =
    $("colorPicker") ||
    $("colorInput");

  if (colorInput) {
    colorInput.addEventListener(
      "input",
      () => {
        currentColor =
          colorInput.value;

        updateToolButtons();
      }
    );
  }

  const sizeInput =
    $("brushSize") ||
    $("sizeSlider");

  if (sizeInput) {
    sizeInput.addEventListener(
      "input",
      () => {
        brushSize =
          Number(sizeInput.value) || 4;

        updateSizeLabel();
      }
    );
  }

  const undoBtn =
    $("undoBtn");

  if (undoBtn) {
    undoBtn.addEventListener(
      "click",
      undo
    );
  }

  const redoBtn =
    $("redoBtn");

  if (redoBtn) {
    redoBtn.addEventListener(
      "click",
      redo
    );
  }

  const clearBtn =
    $("clearBtn");

  if (clearBtn) {
    clearBtn.addEventListener(
      "click",
      clearBoard
    );
  }

  const textBtn =
    $("textBtn");

  if (textBtn) {
    textBtn.addEventListener(
      "click",
      () => {
        setTool("text");
      }
    );
  }

  const shapeBtn =
    $("shapeBtn");

  if (shapeBtn) {
    shapeBtn.addEventListener(
      "click",
      () => {
        setTool("shape");
      }
    );
  }
}

function setTool(tool) {
  currentTool = tool;

  if (drawingCanvas) {
    drawingCanvas.style.cursor =
      tool === "eraser"
        ? "cell"
        : tool === "text"
        ? "text"
        : tool === "shape"
        ? "crosshair"
        : "crosshair";
  }

  updateToolButtons();
}

function updateToolButtons() {
  document
    .querySelectorAll("[data-tool]")
    .forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset.tool === currentTool
      );
    });
}

function updateSizeLabel() {
  const label =
    $("sizeValue");

  if (label) {
    label.textContent =
      `${brushSize}px`;
  }
}

/* =========================================================
   HISTORY
========================================================= */

function saveHistory() {
  if (!drawingCanvas) {
    return;
  }

  try {
    undoStack.push(
      drawingCanvas.toDataURL(
        "image/png"
      )
    );

    if (undoStack.length > 30) {
      undoStack.shift();
    }

    redoStack = [];
  } catch (error) {
    console.warn(
      "History error:",
      error
    );
  }
}

function restoreCanvasData(dataUrl) {
  if (!drawingCtx || !dataUrl) {
    return;
  }

  const image =
    new Image();

  image.onload = () => {
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
      drawingCanvas.width,
      drawingCanvas.height
    );

    saveCurrentPageState();
  };

  image.src = dataUrl;
}

function undo() {
  if (
    undoStack.length === 0 ||
    !drawingCanvas
  ) {
    return;
  }

  const current =
    drawingCanvas.toDataURL(
      "image/png"
    );

  redoStack.push(current);

  const previous =
    undoStack.pop();

  restoreCanvasData(previous);

  showToast("Undo");
}

function redo() {
  if (
    redoStack.length === 0 ||
    !drawingCanvas
  ) {
    return;
  }

  const current =
    drawingCanvas.toDataURL(
      "image/png"
    );

  undoStack.push(current);

  const next =
    redoStack.pop();

  restoreCanvasData(next);

  showToast("Redo");
}

function clearBoard() {
  if (!drawingCtx) {
    return;
  }

  saveHistory();

  drawingCtx.clearRect(
    0,
    0,
    drawingCanvas.width,
    drawingCanvas.height
  );

  saveCurrentPageState();

  showToast("Board cleared");
}

/* =========================================================
   TEXT
========================================================= */

function addTextAt(x, y) {
  const text =
    window.prompt(
      "Enter text:"
    );

  if (!text) {
    return;
  }

  const size =
    Math.max(
      16,
      brushSize * 4
    );

  const item = {
    text,
    x,
    y,
    size,
    color: currentColor
  };

  pages[
    currentPageIndex
  ].textItems.push(item);

  renderTextItems();

  saveCurrentPageState();

  setTool("pen");
}

function renderTextItems() {
  if (!textLayer) {
    return;
  }

  textLayer.innerHTML = "";

  const items =
    pages[
      currentPageIndex
    ].textItems || [];

  items.forEach(
    (item, index) => {
      const element =
        document.createElement(
          "div"
        );

      element.className =
        "board-text-item";

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

      element.title =
        "Double-click to remove";

      element.addEventListener(
        "dblclick",
        () => {
          items.splice(
            index,
            1
          );

          renderTextItems();

          saveCurrentPageState();
        }
      );

      textLayer.appendChild(
        element
      );
    }
  );
}

/* =========================================================
   IMAGE UPLOAD
========================================================= */

function initializeImageUpload() {
  const imageBtn =
    $("imageBtn");

  if (imageBtn && imageInput) {
    imageBtn.addEventListener(
      "click",
      () => {
        imageInput.click();
      }
    );
  }

  if (imageInput) {
    imageInput.addEventListener(
      "change",
      handleImageUpload
    );
  }
}

function handleImageUpload(event) {
  const file =
    event.target.files?.[0];

  if (!file) {
    return;
  }

  if (!file.type.startsWith("image/")) {
    showToast(
      "Please select an image"
    );

    return;
  }

  const reader =
    new FileReader();

  reader.onload = () => {
    const dataUrl =
      reader.result;

    pages[
      currentPageIndex
    ].slideData = dataUrl;

    currentSlideImage =
      new Image();

    currentSlideImage.onload =
      () => {
        renderCurrentSlide();

        saveCurrentPageState();

        showToast(
          "Image added to board"
        );
      };

    currentSlideImage.src =
      dataUrl;
  };

  reader.readAsDataURL(file);

  imageInput.value = "";
}

function renderCurrentSlide() {
  if (!slideLayer) {
    return;
  }

  slideLayer.innerHTML = "";

  const data =
    pages[
      currentPageIndex
    ].slideData;

  if (!data) {
    slideLayer.hidden = true;

    return;
  }

  const image =
    document.createElement(
      "img"
    );

  image.className =
    "uploaded-slide";

  image.src =
    data;

  image.draggable = false;

  slideLayer.appendChild(
    image
  );

  slideLayer.hidden = false;

  currentSlideImage =
    image;
}

/* =========================================================
   PDF UPLOAD — PDF.JS
========================================================= */

function initializePdfUpload() {
  const pdfBtn =
    $("pdfBtn");

  if (pdfBtn && pdfInput) {
    pdfBtn.addEventListener(
      "click",
      () => {
        pdfInput.click();
      }
    );
  }

  if (pdfInput) {
    pdfInput.addEventListener(
      "change",
      handlePdfUpload
    );
  }

  const prev =
    $("pdfPrevBtn");

  if (prev) {
    prev.addEventListener(
      "click",
      () => {
        changePdfPage(-1);
      }
    );
  }

  const next =
    $("pdfNextBtn");

  if (next) {
    next.addEventListener(
      "click",
      () => {
        changePdfPage(1);
      }
    );
  }

  const close =
    $("pdfCloseBtn");

  if (close) {
    close.addEventListener(
      "click",
      closePdf
    );
  }
}

async function handlePdfUpload(event) {
  const file =
    event.target.files?.[0];

  if (!file) {
    return;
  }

  if (
    !window.pdfjsLib
  ) {
    showToast(
      "PDF.js is not loaded"
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

    pdfDoc =
      await pdfjsLib.getDocument({
        url: pdfFileUrl
      }).promise;

    pdfPageCount =
      pdfDoc.numPages;

    pdfPageNumber = 1;

    pdfActive = true;

    await renderPdfPage();

    updatePdfUI();

    showToast(
      "PDF loaded"
    );
  } catch (error) {
    console.error(error);

    showToast(
      "Could not load PDF"
    );
  }

  pdfInput.value = "";
}

async function renderPdfPage() {
  if (
    !pdfDoc ||
    !pdfCanvas ||
    !boardStage
  ) {
    return;
  }

  const page =
    await pdfDoc.getPage(
      pdfPageNumber
    );

  const baseViewport =
    page.getViewport({
      scale: 1
    });

  const stageRect =
    boardStage.getBoundingClientRect();

  const scale =
    Math.min(
      stageRect.width /
        baseViewport.width,

      stageRect.height /
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

  const outputScale =
    window.devicePixelRatio || 1;

  pdfCanvas.width =
    Math.floor(
      viewport.width *
        outputScale
    );

  pdfCanvas.height =
    Math.floor(
      viewport.height *
        outputScale
    );

  pdfCanvas.style.width =
    `${viewport.width}px`;

  pdfCanvas.style.height =
    `${viewport.height}px`;

  const ctx =
    pdfCanvas.getContext(
      "2d"
    );

  ctx.setTransform(
    outputScale,
    0,
    0,
    outputScale,
    0,
    0
  );

  await page.render({
    canvasContext: ctx,
    viewport
  }).promise;

  pdfCanvas.hidden = false;

  updatePdfUI();
}

async function changePdfPage(direction) {
  if (!pdfDoc) {
    return;
  }

  const newPage =
    pdfPageNumber +
    direction;

  if (
    newPage < 1 ||
    newPage > pdfPageCount
  ) {
    return;
  }

  pdfPageNumber =
    newPage;

  await renderPdfPage();
}

function closePdf() {
  pdfActive = false;

  pdfDoc = null;

  pdfPageCount = 0;

  pdfPageNumber = 1;

  if (pdfCanvas) {
    pdfCanvas.hidden = true;
  }

  updatePdfUI();

  showToast(
    "PDF closed"
  );
}

function updatePdfUI() {
  const toolbar =
    $("pdfToolbar");

  if (toolbar) {
    toolbar.hidden =
      !pdfActive;
  }

  const info =
    $("pdfPageInfo");

  if (info) {
    info.textContent =
      pdfActive
        ? `${pdfPageNumber} / ${pdfPageCount}`
        : "";
  }
}

/* =========================================================
   CAMERA INITIALIZATION
========================================================= */

function initializeCamera() {
  const cameraBtn =
    $("cameraBtn");

  if (cameraBtn) {
    cameraBtn.addEventListener(
      "click",
      toggleCamera
    );
  }

  if (!cameraOverlay) {
    return;
  }

  cameraOverlay.style.touchAction =
    "none";

  cameraOverlay.addEventListener(
    "pointerdown",
    handleCameraPointerDown
  );

  cameraOverlay.addEventListener(
    "pointermove",
    handleCameraPointerMove
  );

  cameraOverlay.addEventListener(
    "pointerup",
    handleCameraPointerUp
  );

  cameraOverlay.addEventListener(
    "pointercancel",
    handleCameraPointerUp
  );

  const close =
    $("cameraCloseBtn");

  if (close) {
    close.addEventListener(
      "click",
      disableCamera
    );
  }

  const mirror =
    $("cameraMirrorBtn");

  if (mirror) {
    mirror.addEventListener(
      "click",
      () => {
        cameraState.mirror =
          !cameraState.mirror;

        updateCameraVisual();

        showToast(
          cameraState.mirror
            ? "Camera mirrored"
            : "Camera normal"
        );
      }
    );
  }
}

async function toggleCamera() {
  if (cameraEnabled) {
    disableCamera();

    return;
  }

  await enableCamera();
}

async function enableCamera() {
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

    cameraEnabled = true;

    if (mentorVideo) {
      mentorVideo.srcObject =
        cameraStream;

      mentorVideo.muted = true;

      mentorVideo.playsInline = true;

      await mentorVideo.play().catch(
        () => {}
      );
    }

    if (cameraOverlay) {
      cameraOverlay.hidden =
        false;
    }

    updateCameraUI();

    initializeSelfieSegmentation();

    startCameraProcessing();

    showToast(
      "Camera ON"
    );
  } catch (error) {
    console.error(error);

    cameraEnabled = false;

    showToast(
      "Camera permission denied"
    );
  }
}

function disableCamera() {
  cameraEnabled = false;

  stopCameraProcessing();

  if (cameraStream) {
    cameraStream
      .getTracks()
      .forEach(
        (track) => track.stop()
      );

    cameraStream = null;
  }

  if (mentorVideo) {
    mentorVideo.srcObject =
      null;
  }

  if (cameraOverlay) {
    cameraOverlay.hidden =
      true;
  }

  updateCameraUI();

  showToast(
    "Camera OFF"
  );
}

function updateCameraUI() {
  const button =
    $("cameraBtn");

  if (button) {
    button.classList.toggle(
      "active",
      cameraEnabled
    );
  }

  const indicator =
    $("cameraIndicator");

  if (indicator) {
    indicator.textContent =
      cameraEnabled
        ? "Camera ON"
        : "Camera OFF";
  }
}

/* =========================================================
   CAMERA DRAG
========================================================= */

function handleCameraPointerDown(event) {
  if (
    event.target.closest(
      ".camera-controls"
    ) ||
    event.target.closest(
      ".camera-settings"
    ) ||
    event.target.closest(
      ".camera-resize-handle"
    ) ||
    event.target.closest(
      "button"
    ) ||
    event.target.closest(
      "select"
    ) ||
    event.target.closest(
      "input"
    )
  ) {
    return;
  }

  if (!cameraOverlay) {
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

  try {
    cameraOverlay.setPointerCapture(
      event.pointerId
    );
  } catch (error) {}
}

function handleCameraPointerMove(event) {
  if (
    !cameraDragging ||
    !boardStage ||
    !cameraOverlay
  ) {
    return;
  }

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

  updateCameraVisual();
}

function handleCameraPointerUp(event) {
  cameraDragging = false;

  try {
    cameraOverlay.releasePointerCapture(
      event.pointerId
    );
  } catch (error) {}
}

/* =========================================================
   CAMERA RESIZE
========================================================= */

function initializeCameraSettings() {
  const resizeHandle =
    $("cameraResizeHandle");

  if (resizeHandle) {
    resizeHandle.style.touchAction =
      "none";

    resizeHandle.addEventListener(
      "pointerdown",
      startCameraResize
    );

    resizeHandle.addEventListener(
      "pointermove",
      moveCameraResize
    );

    resizeHandle.addEventListener(
      "pointerup",
      stopCameraResize
    );

    resizeHandle.addEventListener(
      "pointercancel",
      stopCameraResize
    );
  }

  const shape =
    $("cameraShape");

  if (shape) {
    shape.addEventListener(
      "change",
      () => {
        cameraState.shape =
          shape.value;

        updateCameraVisual();
      }
    );
  }

  const effect =
    $("cameraEffect");

  if (effect) {
    effect.addEventListener(
      "change",
      () => {
        cameraState.effect =
          effect.value;

        updateCameraVisual();
      }
    );
  }

  const background =
    $("cameraBackground");

  if (background) {
    background.addEventListener(
      "change",
      () => {
        cameraState.background =
          background.value;

        updateCameraVisual();
      }
    );
  }

  document
    .querySelectorAll(
      "[data-camera-background]"
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          () => {
            cameraState.background =
              button.dataset.cameraBackground;

            if (background) {
              background.value =
                cameraState.background;
            }

            updateCameraVisual();
          }
        );
      }
    );

  const shadow =
    $("cameraShadow");

  if (shadow) {
    shadow.addEventListener(
      "change",
      () => {
        cameraState.shadow =
          shadow.checked;

        updateCameraVisual();
      }
    );
  }

  const frame =
    $("cameraFrame");

  if (frame) {
    frame.addEventListener(
      "change",
      () => {
        cameraState.frame =
          frame.checked;

        updateCameraVisual();
      }
    );
  }
}

function startCameraResize(event) {
  event.stopPropagation();

  cameraResizing = true;

  cameraResizeStart = {
    pointerX:
      event.clientX,

    pointerY:
      event.clientY,

    width:
      cameraState.width,

    height:
      cameraState.height
  };

  try {
    event.currentTarget.setPointerCapture(
      event.pointerId
    );
  } catch (error) {}
}

function moveCameraResize(event) {
  if (
    !cameraResizing ||
    !cameraResizeStart
  ) {
    return;
  }

  const dx =
    event.clientX -
    cameraResizeStart.pointerX;

  const dy =
    event.clientY -
    cameraResizeStart.pointerY;

  let newWidth =
    cameraResizeStart.width +
    dx;

  let newHeight =
    cameraResizeStart.height +
    dy;

  const ratio =
    16 / 9;

  if (
    cameraState.shape ===
    "circle"
  ) {
    const size =
      Math.max(
        130,
        newWidth,
        newHeight
      );

    newWidth = size;
    newHeight = size;
  } else {
    newWidth =
      Math.max(
        130,
        newWidth
      );

    newHeight =
      Math.max(
        90,
        newWidth / ratio
      );
  }

  if (boardStage) {
    const rect =
      boardStage.getBoundingClientRect();

    newWidth =
      Math.min(
        newWidth,
        rect.width -
          cameraState.x
      );

    newHeight =
      Math.min(
        newHeight,
        rect.height -
          cameraState.y
      );
  }

  cameraState.width =
    newWidth;

  cameraState.height =
    newHeight;

  updateCameraVisual();
}

function stopCameraResize(event) {
  cameraResizing = false;

  cameraResizeStart = null;

  try {
    event.currentTarget.releasePointerCapture(
      event.pointerId
    );
  } catch (error) {}
}

/* =========================================================
   CAMERA VISUAL
========================================================= */

function updateCameraVisual() {
  if (!cameraOverlay) {
    return;
  }

  cameraOverlay.style.left =
    `${cameraState.x}px`;

  cameraOverlay.style.top =
    `${cameraState.y}px`;

  cameraOverlay.style.width =
    `${cameraState.width}px`;

  cameraOverlay.style.height =
    `${cameraState.height}px`;

  cameraOverlay.classList.toggle(
    "camera-rounded",
    cameraState.shape ===
      "rounded"
  );

  cameraOverlay.classList.toggle(
    "camera-circle",
    cameraState.shape ===
      "circle"
  );

  cameraOverlay.classList.toggle(
    "camera-rectangle",
    cameraState.shape ===
      "rectangle"
  );

  cameraOverlay.classList.toggle(
    "camera-shadow-off",
    !cameraState.shadow
  );

  cameraOverlay.classList.toggle(
    "camera-frame-off",
    !cameraState.frame
  );

  if (mentorVideo) {
    mentorVideo.classList.toggle(
      "camera-mirror",
      cameraState.mirror
    );

    mentorVideo.classList.toggle(
      "camera-soft-blur",
      cameraState.effect ===
        "soft-blur"
    );
  }

  updateCameraBackgroundLayer();
}

/* =========================================================
   CAMERA BACKGROUND
========================================================= */

function updateCameraBackgroundLayer() {
  if (!cameraOverlay) {
    return;
  }

  let layer =
    cameraOverlay.querySelector(
      ".camera-background-layer"
    );

  if (!layer) {
    layer =
      document.createElement(
        "div"
      );

    layer.className =
      "camera-background-layer";

    cameraOverlay.prepend(
      layer
    );
  }

  layer.className =
    `camera-background-layer background-${cameraState.background}`;

  layer.hidden =
    cameraState.background ===
    "none" ||
    cameraState.background ===
    "transparent";
}

/* =========================================================
   MEDIAPIPE SELFIE SEGMENTATION
========================================================= */

function initializeSelfieSegmentation() {
  if (
    !window.SelfieSegmentation ||
    selfieSegmentation
  ) {
    segmentationAvailable =
      !!window.SelfieSegmentation;

    return;
  }

  try {
    selfieSegmentation =
      new SelfieSegmentation({
        locateFile: (file) => {
          return (
            "https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/" +
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

    segmentationAvailable =
      true;

    console.log(
      "MediaPipe Selfie Segmentation ready"
    );
  } catch (error) {
    console.warn(
      "MediaPipe initialization failed",
      error
    );

    segmentationAvailable =
      false;
  }
}

function startCameraProcessing() {
  stopCameraProcessing();

  const loop = async () => {
    if (!cameraEnabled) {
      return;
    }

    if (
      mentorVideo &&
      mentorVideo.readyState >= 2 &&
      segmentationAvailable &&
      selfieSegmentation &&
      !segmentationBusy
    ) {
      segmentationBusy = true;

      try {
        await selfieSegmentation.send({
          image: mentorVideo
        });
      } catch (error) {
        console.warn(
          "Segmentation error:",
          error
        );
      }

      segmentationBusy = false;
    }

    updateProcessedCameraFallback();

    cameraProcessingAnimation =
      requestAnimationFrame(loop);
  };

  loop();
}

function stopCameraProcessing() {
  if (
    cameraProcessingAnimation
  ) {
    cancelAnimationFrame(
      cameraProcessingAnimation
    );

    cameraProcessingAnimation =
      null;
  }

  segmentationBusy = false;
}

function handleSegmentationResults(
  results
) {
  segmentationResults =
    results;

  if (
    !results ||
    !results.segmentationMask ||
    !results.image
  ) {
    return;
  }

  renderProcessedCamera(
    results
  );
}

function renderProcessedCamera(
  results
) {
  const image =
    results.image;

  const mask =
    results.segmentationMask;

  if (!image || !mask) {
    return;
  }

  const width =
    cameraProcessedCanvas.width;

  const height =
    cameraProcessedCanvas.height;

  cameraProcessedCtx.clearRect(
    0,
    0,
    width,
    height
  );

  /*
     NONE
     ------------------------------------------------------
     Show raw camera.
  */

  if (
    cameraState.background ===
    "none"
  ) {
    cameraProcessedCtx.drawImage(
      image,
      0,
      0,
      width,
      height
    );

    return;
  }

  /*
     TRANSPARENT
     ------------------------------------------------------
     Person only.
  */

  if (
    cameraState.background ===
    "transparent"
  ) {
    drawPersonCutout(
      image,
      mask
    );

    return;
  }

  /*
     SOFT BLUR
     ------------------------------------------------------
     Blurred camera background + person.
  */

  if (
    cameraState.effect ===
      "soft-blur" ||
    cameraState.background ===
      "soft-blur"
  ) {
    drawBlurBackground(
      image
    );

    drawPersonOnTop(
      image,
      mask
    );

    return;
  }

  /*
     OFFICE / CLASSROOM / GRADIENT
  */

  drawPresetBackground(
    cameraState.background
  );

  drawPersonOnTop(
    image,
    mask
  );
}

function drawBlurBackground(
  image
) {
  const width =
    cameraProcessedCanvas.width;

  const height =
    cameraProcessedCanvas.height;

  cameraProcessedCtx.save();

  cameraProcessedCtx.filter =
    "blur(12px)";

  cameraProcessedCtx.drawImage(
    image,
    -10,
    -10,
    width + 20,
    height + 20
  );

  cameraProcessedCtx.restore();
}

function drawPersonCutout(
  image,
  mask
) {
  const width =
    personCanvas.width;

  const height =
    personCanvas.height;

  personCtx.clearRect(
    0,
    0,
    width,
    height
  );

  personCtx.drawImage(
    mask,
    0,
    0,
    width,
    height
  );

  personCtx.globalCompositeOperation =
    "source-in";

  personCtx.drawImage(
    image,
    0,
    0,
    width,
    height
  );

  personCtx.globalCompositeOperation =
    "source-over";

  cameraProcessedCtx.drawImage(
    personCanvas,
    0,
    0,
    cameraProcessedCanvas.width,
    cameraProcessedCanvas.height
  );
}

function drawPersonOnTop(
  image,
  mask
) {
  drawPersonCutout(
    image,
    mask
  );
}

function drawPresetBackground(
  type
) {
  const ctx =
    cameraProcessedCtx;

  const width =
    cameraProcessedCanvas.width;

  const height =
    cameraProcessedCanvas.height;

  ctx.save();

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
      "#eaf4ff"
    );

    gradient.addColorStop(
      1,
      "#c9def2"
    );

    ctx.fillStyle =
      gradient;

    ctx.fillRect(
      0,
      0,
      width,
      height
    );

    drawOfficeElements(
      ctx,
      width,
      height
    );
  } else if (
    type === "classroom"
  ) {
    const gradient =
      ctx.createLinearGradient(
        0,
        0,
        0,
        height
      );

    gradient.addColorStop(
      0,
      "#eef8f3"
    );

    gradient.addColorStop(
      1,
      "#d8e9df"
    );

    ctx.fillStyle =
      gradient;

    ctx.fillRect(
      0,
      0,
      width,
      height
    );

    drawClassroomElements(
      ctx,
      width,
      height
    );
  } else if (
    type === "gradient"
  ) {
    const gradient =
      ctx.createLinearGradient(
        0,
        0,
        width,
        height
      );

    gradient.addColorStop(
      0,
      "#dceeff"
    );

    gradient.addColorStop(
      1,
      "#f5faff"
    );

    ctx.fillStyle =
      gradient;

    ctx.fillRect(
      0,
      0,
      width,
      height
    );
  } else {
    ctx.clearRect(
      0,
      0,
      width,
      height
    );
  }

  ctx.restore();
}

function drawOfficeElements(
  ctx,
  width,
  height
) {
  ctx.fillStyle =
    "rgba(255,255,255,.55)";

  ctx.fillRect(
    width * 0.06,
    height * 0.12,
    width * 0.30,
    height * 0.30
  );

  ctx.fillStyle =
    "rgba(80,110,140,.12)";

  ctx.fillRect(
    width * 0.02,
    height * 0.82,
    width * 0.96,
    height * 0.12
  );

  ctx.fillStyle =
    "rgba(255,255,255,.65)";

  ctx.fillRect(
    width * 0.65,
    height * 0.16,
    width * 0.24,
    height * 0.25
  );
}

function drawClassroomElements(
  ctx,
  width,
  height
) {
  ctx.fillStyle =
    "rgba(255,255,255,.58)";

  ctx.fillRect(
    width * 0.10,
    height * 0.12,
    width * 0.80,
    height * 0.32
  );

  ctx.fillStyle =
    "rgba(60,90,80,.18)";

  ctx.fillRect(
    width * 0.08,
    height * 0.80,
    width * 0.84,
    height * 0.12
  );

  ctx.strokeStyle =
    "rgba(60,90,80,.18)";

  ctx.lineWidth = 8;

  ctx.beginPath();

  ctx.moveTo(
    width * 0.12,
    height * 0.74
  );

  ctx.lineTo(
    width * 0.88,
    height * 0.74
  );

  ctx.stroke();
}

function updateProcessedCameraFallback() {
  if (
    !mentorVideo ||
    mentorVideo.readyState < 2
  ) {
    return;
  }

  if (
    segmentationAvailable &&
    segmentationResults
  ) {
    return;
  }

  const width =
    cameraProcessedCanvas.width;

  const height =
    cameraProcessedCanvas.height;

  cameraProcessedCtx.clearRect(
    0,
    0,
    width,
    height
  );

  if (
    cameraState.background !==
    "none"
  ) {
    drawPresetBackground(
      cameraState.background
    );
  }

  if (
    cameraState.background ===
    "none"
  ) {
    cameraProcessedCtx.drawImage(
      mentorVideo,
      0,
      0,
      width,
      height
    );
  } else {
    cameraProcessedCtx.save();

    if (
      cameraState.effect ===
      "soft-blur"
    ) {
      cameraProcessedCtx.filter =
        "blur(5px)";
    }

    cameraProcessedCtx.drawImage(
      mentorVideo,
      0,
      0,
      width,
      height
    );

    cameraProcessedCtx.restore();
  }
}

/* =========================================================
   PAGES
========================================================= */

function initializePages() {
  const add =
    $("addPageBtn");

  if (add) {
    add.addEventListener(
      "click",
      addNewPage
    );
  }

  const prev =
    $("prevPageBtn");

  if (prev) {
    prev.addEventListener(
      "click",
      () =>
        changeBoardPage(-1)
    );
  }

  const next =
    $("nextPageBtn");

  if (next) {
    next.addEventListener(
      "click",
      () =>
        changeBoardPage(1)
    );
  }

  renderPageList();
}

function addNewPage() {
  saveCurrentPageState();

  pages.push({
    drawingData: null,
    textItems: [],
    notes: "",
    slideData: null
  });

  currentPageIndex =
    pages.length - 1;

  undoStack = [];
  redoStack = [];

  renderCurrentPage();

  renderPageList();

  showToast(
    `Page ${pages.length} created`
  );
}

function changeBoardPage(
  direction
) {
  const next =
    currentPageIndex +
    direction;

  if (
    next < 0 ||
    next >= pages.length
  ) {
    return;
  }

  saveCurrentPageState();

  currentPageIndex =
    next;

  undoStack = [];
  redoStack = [];

  renderCurrentPage();

  renderPageList();
}

function renderCurrentPage() {
  if (!drawingCtx) {
    return;
  }

  drawingCtx.clearRect(
    0,
    0,
    drawingCanvas.width,
    drawingCanvas.height
  );

  const page =
    pages[
      currentPageIndex
    ];

  if (
    page &&
    page.drawingData
  ) {
    const image =
      new Image();

    image.onload = () => {
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
        drawingCanvas.width,
        drawingCanvas.height
      );
    };

    image.src =
      page.drawingData;
  }

  renderTextItems();

  renderCurrentSlide();

  updateNotesUI();

  updatePageCounter();
}

function saveCurrentPageState() {
  if (!drawingCanvas) {
    return;
  }

  const page =
    pages[
      currentPageIndex
    ];

  if (!page) {
    return;
  }

  page.drawingData =
    drawingCanvas.toDataURL(
      "image/png"
    );
}

function renderPageList() {
  const list =
    $("pageList");

  if (!list) {
    return;
  }

  list.innerHTML = "";

  pages.forEach(
    (_, index) => {
      const button =
        document.createElement(
          "button"
        );

      button.className =
        "page-item";

      button.classList.toggle(
        "active",
        index ===
          currentPageIndex
      );

      button.textContent =
        `Page ${index + 1}`;

      button.addEventListener(
        "click",
        () => {
          saveCurrentPageState();

          currentPageIndex =
            index;

          undoStack = [];
          redoStack = [];

          renderCurrentPage();

          renderPageList();
        }
      );

      list.appendChild(
        button
      );
    }
  );
}

function updatePageCounter() {
  const counter =
    $("pageCounter");

  if (counter) {
    counter.textContent =
      `${currentPageIndex + 1} / ${pages.length}`;
  }
}

/* =========================================================
   NOTES
========================================================= */

function initializeNotes() {
  const input =
    $("notesInput");

  if (!input) {
    return;
  }

  input.addEventListener(
    "input",
    () => {
      pages[
        currentPageIndex
      ].notes =
        input.value;

      const status =
        $("notesStatus");

      if (status) {
        status.textContent =
          "Saved";
      }

      saveBoardToStorage();
    }
  );
}

function updateNotesUI() {
  const input =
    $("notesInput");

  if (!input) {
    return;
  }

  input.value =
    pages[
      currentPageIndex
    ].notes || "";
}

/* =========================================================
   BUTTONS
========================================================= */

function initializeButtons() {
  const newBtn =
    $("newBoardBtn");

  if (newBtn) {
    newBtn.addEventListener(
      "click",
      newBoard
    );
  }

  const saveBtn =
    $("saveBtn");

  if (saveBtn) {
    saveBtn.addEventListener(
      "click",
      saveCompositePNG
    );
  }

  const fullscreenBtn =
    $("fullscreenBtn");

  if (fullscreenBtn) {
    fullscreenBtn.addEventListener(
      "click",
      toggleFullscreen
    );
  }

  const recordBtn =
    $("recordBtn");

  if (recordBtn) {
    recordBtn.addEventListener(
      "click",
      openRecordingPanel
    );
  }

  const startRecordBtn =
    $("startRecordingBtn");

  if (startRecordBtn) {
    startRecordBtn.addEventListener(
      "click",
      startRecording
    );
  }

  const pauseRecordBtn =
    $("pauseRecordingBtn");

  if (pauseRecordBtn) {
    pauseRecordBtn.addEventListener(
      "click",
      pauseRecording
    );
  }

  const resumeRecordBtn =
    $("resumeRecordingBtn");

  if (resumeRecordBtn) {
    resumeRecordBtn.addEventListener(
      "click",
      resumeRecording
    );
  }

  const stopRecordBtn =
    $("stopRecordingBtn");

  if (stopRecordBtn) {
    stopRecordBtn.addEventListener(
      "click",
      stopRecording
    );
  }

  const micBtn =
    $("micBtn");

  if (micBtn) {
    micBtn.addEventListener(
      "click",
      toggleMicrophone
    );
  }
}

/* =========================================================
   NEW BOARD
========================================================= */

function newBoard() {
  const confirmReset =
    window.confirm(
      "Start a new board?"
    );

  if (!confirmReset) {
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

  undoStack = [];
  redoStack = [];

  if (drawingCtx) {
    drawingCtx.clearRect(
      0,
      0,
      drawingCanvas.width,
      drawingCanvas.height
    );
  }

  closePdf();

  renderCurrentPage();

  renderPageList();

  saveBoardToStorage();

  showToast(
    "New board created"
  );
}

/* =========================================================
   SAVE COMPOSITE PNG
========================================================= */

async function saveCompositePNG() {
  const canvas =
    await createCompositeCanvas();

  if (!canvas) {
    return;
  }

  const link =
    document.createElement("a");

  link.download =
    `snk-smart-board-page-${currentPageIndex + 1}.png`;

  link.href =
    canvas.toDataURL(
      "image/png"
    );

  link.click();

  showToast(
    "PNG saved"
  );
}

/* =========================================================
   RECORDING PANEL
========================================================= */

function openRecordingPanel() {
  const panel =
    $("recordingPanel");

  if (!panel) {
    startRecording();

    return;
  }

  panel.hidden = false;

  updateRecordingUI();
}

function closeRecordingPanel() {
  const panel =
    $("recordingPanel");

  if (panel) {
    panel.hidden = true;
  }
}

/* =========================================================
   MICROPHONE
========================================================= */

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
      await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

    micEnabled = true;

    updateMicUI();

    showToast(
      "Microphone ON"
    );
  } catch (error) {
    console.error(error);

    micEnabled = false;

    showToast(
      "Microphone permission denied"
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

    micStream = null;
  }

  micEnabled = false;

  updateMicUI();
}

function updateMicUI() {
  const button =
    $("micBtn");

  if (button) {
    button.classList.toggle(
      "active",
      micEnabled
    );
  }

  const indicator =
    $("micIndicator");

  if (indicator) {
    indicator.textContent =
      micEnabled
        ? "Mic ON"
        : "Mic OFF";
  }
}

/* =========================================================
   START RECORDING
========================================================= */

async function startRecording() {
  if (recordingActive) {
    return;
  }

  try {
    saveCurrentPageState();

    if (!micEnabled) {
      await enableMicrophone();
    }

    if (
      !micStream ||
      micStream.getAudioTracks()
        .length === 0
    ) {
      showToast(
        "Microphone is required"
      );

      return;
    }

    if (
      !window.MediaRecorder
    ) {
      showToast(
        "MediaRecorder not supported"
      );

      return;
    }

    recordedChunks = [];

    recordingBlobUrl = null;

    const videoStream =
      recordCanvas.captureStream(
        30
      );

    recordingStream =
      new MediaStream();

    videoStream
      .getVideoTracks()
      .forEach(
        (track) => {
          recordingStream.addTrack(
            track
          );
        }
      );

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
      getSupportedRecordingMime();

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
      handleRecordingStop;

    mediaRecorder.onerror =
      (event) => {
        console.error(
          "Recorder error:",
          event
        );

        showToast(
          "Recording error"
        );
      };

    recordingStartedAt =
      performance.now();

    recordingPausedAt = 0;

    totalPausedTime = 0;

    recordingActive = true;

    recordingPaused = false;

    mediaRecorder.start(
      1000
    );

    startRecordingRenderLoop();

    updateRecordingUI();

    showToast(
      "Recording started"
    );
  } catch (error) {
    console.error(error);

    cleanupRecordingStream();

    showToast(
      "Could not start recording"
    );
  }
}

function getSupportedRecordingMime() {
  const types = [
    "video/webm;codecs=vp9,opus",

    "video/webm;codecs=vp8,opus",

    "video/webm"
  ];

  for (const type of types) {
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
   RECORDING RENDER LOOP
========================================================= */

function startRecordingRenderLoop() {
  stopRecordingRenderLoop();

  const loop = () => {
    if (!recordingActive) {
      return;
    }

    renderRecordingFrame();

    updateRecordingTimer();

    recordingAnimation =
      requestAnimationFrame(loop);
  };

  loop();
}

function stopRecordingRenderLoop() {
  if (
    recordingAnimation
  ) {
    cancelAnimationFrame(
      recordingAnimation
    );

    recordingAnimation =
      null;
  }
}

/* =========================================================
   RECORDING FRAME
========================================================= */

function renderRecordingFrame() {
  if (!recordCtx) {
    return;
  }

  const width =
    recordCanvas.width;

  const height =
    recordCanvas.height;

  recordCtx.save();

  recordCtx.fillStyle =
    "#ffffff";

  recordCtx.fillRect(
    0,
    0,
    width,
    height
  );

  /*
     PDF
  */

  if (
    pdfActive &&
    pdfCanvas &&
    !pdfCanvas.hidden
  ) {
    drawContain(
      recordCtx,
      pdfCanvas,
      0,
      0,
      width,
      height
    );
  }

  /*
     IMAGE SLIDE
  */

  else if (
    currentSlideImage &&
    currentSlideImage.complete
  ) {
    drawContain(
      recordCtx,
      currentSlideImage,
      0,
      0,
      width,
      height
    );
  }

  /*
     DRAWING
  */

  if (drawingCanvas) {
    recordCtx.drawImage(
      drawingCanvas,
      0,
      0,
      width,
      height
    );
  }

  /*
     TEXT
  */

  drawTextItemsToRecording();

  /*
     CAMERA
  */

  if (
    cameraEnabled
  ) {
    drawCameraToRecording();
  }

  /*
     SMALL BRANDING
  */

  drawRecordingBrand();

  recordCtx.restore();
}

/* =========================================================
   DRAW TEXT TO RECORDING
========================================================= */

function drawTextItemsToRecording() {
  const items =
    pages[
      currentPageIndex
    ].textItems || [];

  if (!items.length) {
    return;
  }

  const scaleX =
    recordCanvas.width /
    drawingCanvas.width;

  const scaleY =
    recordCanvas.height /
    drawingCanvas.height;

  items.forEach(
    (item) => {
      recordCtx.save();

      recordCtx.fillStyle =
        item.color || "#111827";

      recordCtx.font =
        `${item.size * scaleX}px Arial`;

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
   DRAW CAMERA TO RECORDING
========================================================= */

function drawCameraToRecording() {
  if (
    !boardStage ||
    !cameraEnabled
  ) {
    return;
  }

  let source =
    cameraProcessedCanvas;

  if (
    !segmentationAvailable &&
    cameraState.background ===
      "none"
  ) {
    source =
      mentorVideo;
  }

  if (
    !source ||
    (
      source instanceof HTMLVideoElement &&
      source.readyState < 2
    )
  ) {
    return;
  }

  const stageRect =
    boardStage.getBoundingClientRect();

  if (
    stageRect.width <= 0 ||
    stageRect.height <= 0
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

  recordCtx.save();

  applyCameraClip(
    recordCtx,
    x,
    y,
    width,
    height,
    cameraState.shape
  );

  if (cameraState.mirror) {
    recordCtx.translate(
      x + width,
      y
    );

    recordCtx.scale(
      -1,
      1
    );

    drawCameraSource(
      source,
      0,
      0,
      width,
      height
    );
  } else {
    drawCameraSource(
      source,
      x,
      y,
      width,
      height
    );
  }

  recordCtx.restore();

  /*
     Frame
  */

  if (cameraState.frame) {
    recordCtx.save();

    recordCtx.strokeStyle =
      "rgba(255,255,255,.95)";

    recordCtx.lineWidth = 4;

    drawCameraShapePath(
      recordCtx,
      x,
      y,
      width,
      height,
      cameraState.shape
    );

    recordCtx.stroke();

    recordCtx.restore();
  }
}

function drawCameraSource(
  source,
  x,
  y,
  width,
  height
) {
  try {
    recordCtx.drawImage(
      source,
      x,
      y,
      width,
      height
    );
  } catch (error) {}
}

function applyCameraClip(
  ctx,
  x,
  y,
  width,
  height,
  shape
) {
  ctx.beginPath();

  if (
    shape === "circle"
  ) {
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
  } else if (
    shape === "rounded"
  ) {
    roundedRectPath(
      ctx,
      x,
      y,
      width,
      height,
      24
    );
  } else {
    ctx.rect(
      x,
      y,
      width,
      height
    );
  }

  ctx.clip();
}

function drawCameraShapePath(
  ctx,
  x,
  y,
  width,
  height,
  shape
) {
  ctx.beginPath();

  if (
    shape === "circle"
  ) {
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
  } else if (
    shape === "rounded"
  ) {
    roundedRectPath(
      ctx,
      x,
      y,
      width,
      height,
      24
    );
  } else {
    ctx.rect(
      x,
      y,
      width,
      height
    );
  }
}

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
   RECORDING BRAND
========================================================= */

function drawRecordingBrand() {
  recordCtx.save();

  recordCtx.fillStyle =
    "rgba(17,24,39,.72)";

  recordCtx.font =
    "bold 18px Arial";

  recordCtx.textBaseline =
    "bottom";

  recordCtx.fillText(
    "SNK Smart Board",
    24,
    recordCanvas.height - 22
  );

  recordCtx.restore();
}

/* =========================================================
   PAUSE / RESUME
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
      performance.now();

    updateRecordingUI();

    showToast(
      "Recording paused"
    );
  }
}

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

    if (
      recordingPausedAt
    ) {
      totalPausedTime +=
        performance.now() -
        recordingPausedAt;
    }

    recordingPausedAt = 0;

    recordingPaused = false;

    updateRecordingUI();

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

  recordingActive = false;

  stopRecordingRenderLoop();

  if (
    mediaRecorder.state !==
    "inactive"
  ) {
    mediaRecorder.stop();
  }
}

function handleRecordingStop() {
  const blob =
    new Blob(
      recordedChunks,
      {
        type:
          mediaRecorder?.mimeType ||
          "video/webm"
      }
    );

  if (
    recordingBlobUrl
  ) {
    URL.revokeObjectURL(
      recordingBlobUrl
    );
  }

  recordingBlobUrl =
    URL.createObjectURL(
      blob
    );

  showRecordedVideo(
    recordingBlobUrl
  );

  cleanupRecordingStream();

  updateRecordingUI();

  showToast(
    "Recording finished"
  );
}

/* =========================================================
   SHOW RECORDED VIDEO
========================================================= */

function showRecordedVideo(
  url
) {
  const video =
    $("recordedVideo");

  if (video) {
    video.src =
      url;

    video.controls = true;

    video.load();
  }

  const area =
    $("recordedVideoArea");

  if (area) {
    area.hidden = false;
  }

  const download =
    $("downloadRecordingBtn");

  if (download) {
    download.hidden = false;

    download.onclick = () => {
      const link =
        document.createElement(
          "a"
        );

      link.href =
        url;

      link.download =
        `snk-smart-board-${Date.now()}.webm`;

      link.click();
    };
  }
}

/* =========================================================
   RECORDING CLEANUP
========================================================= */

function cleanupRecordingStream() {
  stopRecordingRenderLoop();

  if (recordingStream) {
    recordingStream
      .getTracks()
      .forEach(
        (track) => track.stop()
      );

    recordingStream = null;
  }

  mediaRecorder = null;

  recordingPaused = false;
}

/* =========================================================
   RECORDING UI
========================================================= */

function updateRecordingUI() {
  const status =
    $("recordingPanelStatus");

  const timer =
    $("recordingPanelTimer");

  const start =
    $("startRecordingBtn");

  const pause =
    $("pauseRecordingBtn");

  const resume =
    $("resumeRecordingBtn");

  const stop =
    $("stopRecordingBtn");

  if (status) {
    if (recordingActive) {
      status.textContent =
        recordingPaused
          ? "Paused"
          : "Recording";
    } else {
      status.textContent =
        "Ready";
    }
  }

  if (start) {
    start.hidden =
      recordingActive;
  }

  if (pause) {
    pause.hidden =
      !recordingActive ||
      recordingPaused;
  }

  if (resume) {
    resume.hidden =
      !recordingActive ||
      !recordingPaused;
  }

  if (stop) {
    stop.hidden =
      !recordingActive;
  }

  if (timer) {
    timer.textContent =
      formatRecordingTime(
        getRecordingElapsed()
      );
  }
}

function updateRecordingTimer() {
  const timer =
    $("recordingPanelTimer");

  if (!timer) {
    return;
  }

  timer.textContent =
    formatRecordingTime(
      getRecordingElapsed()
    );
}

function getRecordingElapsed() {
  if (!recordingStartedAt) {
    return 0;
  }

  const now =
    performance.now();

  let paused =
    totalPausedTime;

  if (
    recordingPaused &&
    recordingPausedAt
  ) {
    paused +=
      now -
      recordingPausedAt;
  }

  return Math.max(
    0,
    now -
      recordingStartedAt -
      paused
  );
}

function formatRecordingTime(
  milliseconds
) {
  const totalSeconds =
    Math.floor(
      milliseconds / 1000
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

  return [
    String(hours).padStart(
      2,
      "0"
    ),

    String(minutes).padStart(
      2,
      "0"
    ),

    String(seconds).padStart(
      2,
      "0"
    )
  ].join(":");
}

/* =========================================================
   COMPOSITE CANVAS
========================================================= */

async function createCompositeCanvas() {
  const canvas =
    document.createElement(
      "canvas"
    );

  canvas.width =
    recordCanvas.width;

  canvas.height =
    recordCanvas.height;

  const ctx =
    canvas.getContext("2d");

  ctx.fillStyle =
    "#ffffff";

  ctx.fillRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  if (
    pdfActive &&
    pdfCanvas &&
    !pdfCanvas.hidden
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
    currentSlideImage &&
    currentSlideImage.complete
  ) {
    drawContain(
      ctx,
      currentSlideImage,
      0,
      0,
      canvas.width,
      canvas.height
    );
  }

  if (drawingCanvas) {
    ctx.drawImage(
      drawingCanvas,
      0,
      0,
      canvas.width,
      canvas.height
    );
  }

  drawTextItemsToContext(
    ctx,
    canvas
  );

  if (
    cameraEnabled
  ) {
    drawCameraToContext(
      ctx,
      canvas
    );
  }

  return canvas;
}

function drawTextItemsToContext(
  ctx,
  canvas
) {
  if (!drawingCanvas) {
    return;
  }

  const scaleX =
    canvas.width /
    drawingCanvas.width;

  const scaleY =
    canvas.height /
    drawingCanvas.height;

  const items =
    pages[
      currentPageIndex
    ].textItems || [];

  items.forEach(
    (item) => {
      ctx.save();

      ctx.fillStyle =
        item.color ||
        "#111827";

      ctx.font =
        `${item.size * scaleX}px Arial`;

      ctx.textBaseline =
        "top";

      ctx.fillText(
        item.text,
        item.x * scaleX,
        item.y * scaleY
      );

      ctx.restore();
    }
  );
}

function drawCameraToContext(
  ctx,
  canvas
) {
  const stageRect =
    boardStage?.getBoundingClientRect();

  if (!stageRect) {
    return;
  }

  const scaleX =
    canvas.width /
    stageRect.width;

  const scaleY =
    canvas.height /
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

  let source =
    cameraProcessedCanvas;

  if (
    !segmentationAvailable &&
    cameraState.background ===
      "none"
  ) {
    source =
      mentorVideo;
  }

  if (!source) {
    return;
  }

  ctx.save();

  applyCameraClip(
    ctx,
    x,
    y,
    width,
    height,
    cameraState.shape
  );

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
      source,
      0,
      0,
      width,
      height
    );
  } else {
    ctx.drawImage(
      source,
      x,
      y,
      width,
      height
    );
  }

  ctx.restore();
}

/* =========================================================
   CONTAIN DRAWING
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
    !source ||
    !source.width ||
    !source.height
  ) {
    return;
  }

  const ratio =
    Math.min(
      width /
        source.width,
      height /
        source.height
    );

  const drawWidth =
    source.width *
    ratio;

  const drawHeight =
    source.height *
    ratio;

  const drawX =
    x +
    (width -
      drawWidth) /
      2;

  const drawY =
    y +
    (height -
      drawHeight) /
      2;

  ctx.drawImage(
    source,
    drawX,
    drawY,
    drawWidth,
    drawHeight
  );
}

/* =========================================================
   ZOOM
========================================================= */

function initializeZoom() {
  const zoomIn =
    $("zoomInBtn");

  const zoomOut =
    $("zoomOutBtn");

  const reset =
    $("resetZoomBtn");

  if (zoomIn) {
    zoomIn.addEventListener(
      "click",
      () => changeZoom(0.1)
    );
  }

  if (zoomOut) {
    zoomOut.addEventListener(
      "click",
      () => changeZoom(-0.1)
    );
  }

  if (reset) {
    reset.addEventListener(
      "click",
      () => {
        currentZoom = 1;

        applyZoom();
      }
    );
  }
}

function changeZoom(
  amount
) {
  currentZoom =
    Math.max(
      0.5,
      Math.min(
        2,
        currentZoom +
          amount
      )
    );

  applyZoom();
}

function applyZoom() {
  const value =
    $("zoomValue");

  if (value) {
    value.textContent =
      `${Math.round(
        currentZoom * 100
      )}%`;
  }

  if (boardStage) {
    boardStage.style.setProperty(
      "--board-zoom",
      currentZoom
    );
  }
}

/* =========================================================
   FULLSCREEN
========================================================= */

async function toggleFullscreen() {
  const target =
    $("boardStageWrapper") ||
    boardStage;

  if (!target) {
    return;
  }

  try {
    if (
      !document.fullscreenElement
    ) {
      await target.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch (error) {
    console.warn(
      "Fullscreen error:",
      error
    );
  }
}

/* =========================================================
   KEYBOARD SHORTCUTS
========================================================= */

function initializeKeyboardShortcuts() {
  document.addEventListener(
    "keydown",
    (event) => {
      if (
        event.target.tagName ===
          "INPUT" ||
        event.target.tagName ===
          "TEXTAREA" ||
        event.target.isContentEditable
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

        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
      }

      if (
        (event.ctrlKey ||
          event.metaKey) &&
        event.key.toLowerCase() ===
          "y"
      ) {
        event.preventDefault();

        redo();
      }

      if (
        event.key === "Escape"
      ) {
        setTool("pen");
      }
    }
  );

  if (drawingCanvas) {
    drawingCanvas.addEventListener(
      "click",
      (event) => {
        if (
          currentTool !==
          "text"
        ) {
          return;
        }

        const point =
          getCanvasPoint(event);

        addTextAt(
          point.x,
          point.y
        );
      }
    );
  }

  if (drawingCanvas) {
    drawingCanvas.addEventListener(
      "pointerdown",
      (event) => {
        if (
          currentTool !==
          "shape"
        ) {
          return;
        }

        startShape(
          event
        );
      }
    );

    drawingCanvas.addEventListener(
      "pointermove",
      (event) => {
        if (
          currentTool !==
          "shape"
        ) {
          return;
        }

        updateShapePreview(
          event
        );
      }
    );

    drawingCanvas.addEventListener(
      "pointerup",
      (event) => {
        if (
          currentTool !==
          "shape"
        ) {
          return;
        }

        finishShape(
          event
        );
      }
    );
  }
}

/* =========================================================
   SHAPES
========================================================= */

function startShape(event) {
  if (!drawingCtx) {
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

  saveHistory();
}

function updateShapePreview(
  event
) {
  if (
    !shapeSnapshot ||
    !drawingCtx
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
    point.x -
    shapeStartX;

  const height =
    point.y -
    shapeStartY;

  drawingCtx.strokeStyle =
    currentColor;

  drawingCtx.lineWidth =
    brushSize;

  drawingCtx.globalCompositeOperation =
    "source-over";

  drawingCtx.beginPath();

  if (
    currentShape ===
    "ellipse"
  ) {
    drawingCtx.ellipse(
      shapeStartX +
        width / 2,
      shapeStartY +
        height / 2,
      Math.abs(width / 2),
      Math.abs(height / 2),
      0,
      0,
      Math.PI * 2
    );
  } else if (
    currentShape ===
    "line"
  ) {
    drawingCtx.moveTo(
      shapeStartX,
      shapeStartY
    );

    drawingCtx.lineTo(
      point.x,
      point.y
    );
  } else {
    drawingCtx.rect(
      shapeStartX,
      shapeStartY,
      width,
      height
    );
  }

  drawingCtx.stroke();
}

function finishShape(event) {
  if (!shapeSnapshot) {
    return;
  }

  updateShapePreview(
    event
  );

  shapeSnapshot = null;

  saveCurrentPageState();
}

/* =========================================================
   LOCAL STORAGE
========================================================= */

function saveBoardToStorage() {
  try {
    saveCurrentPageState();

    localStorage.setItem(
      "snkSmartBoardPages",
      JSON.stringify(
        pages
      )
    );
  } catch (error) {
    console.warn(
      "Storage error:",
      error
    );
  }
}

function loadSavedBoard() {
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
    }
  } catch (error) {
    console.warn(
      "Could not restore board",
      error
    );
  }
}

/* =========================================================
   TOAST
========================================================= */

function showToast(message) {
  if (!toastEl) {
    console.log(message);

    return;
  }

  toastEl.textContent =
    message;

  toastEl.classList.add(
    "show"
  );

  clearTimeout(
    toastTimer
  );

  toastTimer =
    setTimeout(() => {
      toastEl.classList.remove(
        "show"
      );
    }, 2200);
}

/* =========================================================
   COLOR UTILITY
========================================================= */

function hexToRgba(
  hex,
  alpha
) {
  let value =
    hex.replace(
      "#",
      ""
    );

  if (
    value.length === 3
  ) {
    value =
      value
        .split("")
        .map(
          (char) =>
            char + char
        )
        .join("");
  }

  const r =
    parseInt(
      value.substring(
        0,
        2
      ),
      16
    );

  const g =
    parseInt(
      value.substring(
        2,
        4
      ),
      16
    );

  const b =
    parseInt(
      value.substring(
        4,
        6
      ),
      16
    );

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* =========================================================
   PDF / IMAGE RESIZE
========================================================= */

window.addEventListener(
  "resize",
  () => {
    if (pdfActive) {
      renderPdfPage();
    }

    updateCameraVisual();
  }
);

/* =========================================================
   BEFORE UNLOAD CLEANUP
========================================================= */

window.addEventListener(
  "beforeunload",
  () => {
    saveBoardToStorage();

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
   INITIAL UI
========================================================= */

setTimeout(() => {
  updateToolButtons();

  updateSizeLabel();

  updateCameraVisual();

  updateMicUI();

  updateRecordingUI();

  updatePdfUI();

  renderPageList();

  updatePageCounter();
}, 300);
/* =========================================================
   SNK SMART BOARD
   STEP 11.2.2
   LAPTOP PAIRING ENGINE
   ========================================================= */

(function () {

  "use strict";


  // -------------------------------------------------------
  // WAIT FOR FIREBASE
  // -------------------------------------------------------

  function waitForFirebase(callback) {

    if (window.SNKFirebase) {
      callback();
      return;
    }

    setTimeout(function () {
      waitForFirebase(callback);
    }, 100);

  }


  // -------------------------------------------------------
  // STATE
  // -------------------------------------------------------

  const pairingState = {

    code: null,

    connected: false,

    controllerName: null,

    sessionPath: null,

    unsubscribe: null

  };


  // -------------------------------------------------------
  // ELEMENTS
  // -------------------------------------------------------

  const modal =
    document.getElementById("pairingModal");

  const closeButton =
    document.getElementById("closePairing");

  const codeElement =
    document.getElementById("pairingCode");

  const generateButton =
    document.getElementById("generatePairingCode");

  const statusElement =
    document.getElementById("pairingStatus");

  const connectedDevice =
    document.getElementById("connectedDevice");

  const connectedDeviceName =
    document.getElementById("connectedDeviceName");

  const disconnectButton =
    document.getElementById("disconnectController");


  // -------------------------------------------------------
  // RANDOM 6 DIGIT CODE
  // -------------------------------------------------------

  function generateCode() {

    return String(
      Math.floor(
        100000 +
        Math.random() * 900000
      )
    );

  }


  // -------------------------------------------------------
  // OPEN PAIRING
  // -------------------------------------------------------

  window.openSmartBoardPairing = function () {

    if (!modal) return;

    modal.classList.add("show");

    createPairingSession();

  };


  // -------------------------------------------------------
  // CLOSE PAIRING
  // -------------------------------------------------------

  function closePairing() {

    if (!modal) return;

    modal.classList.remove("show");

  }


  if (closeButton) {

    closeButton.addEventListener(
      "click",
      closePairing
    );

  }


  // -------------------------------------------------------
  // CREATE SESSION
  // -------------------------------------------------------

  async function createPairingSession() {

    waitForFirebase(async function () {

      const {

        db,
        ref,
        set,
        onValue,
        remove,
        serverTimestamp

      } = window.SNKFirebase;


      const code =
        generateCode();


      pairingState.code =
        code;


      pairingState.sessionPath =
        "smartBoardSessions/" + code;


      codeElement.textContent =
        code;


      statusElement.textContent =
        "Waiting for phone / tablet...";


      statusElement.className =
        "pairing-status waiting";


      connectedDevice.classList.add(
        "hidden"
      );


      const sessionRef =
        ref(
          db,
          pairingState.sessionPath
        );


      try {

        await set(
          sessionRef,
          {

            boardName:
              "SNK Smart Board",

            code:
              code,

            laptopConnected:
              true,

            controllerConnected:
              false,

            controllerName:
              "",

            createdAt:
              serverTimestamp(),

            lastActivity:
              serverTimestamp()

          }
        );


        console.log(
          "Pairing session created:",
          code
        );


        listenForController();

      }

      catch (error) {

        console.error(
          "Pairing error:",
          error
        );


        statusElement.textContent =
          "Firebase connection failed";

        statusElement.className =
          "pairing-status error";

      }

    });

  }


  // -------------------------------------------------------
  // LISTEN FOR TABLET
  // -------------------------------------------------------

  function listenForController() {

    waitForFirebase(function () {

      const {

        db,
        ref,
        onValue

      } = window.SNKFirebase;


      const sessionRef =
        ref(
          db,
          pairingState.sessionPath
        );


      pairingState.unsubscribe =
        onValue(
          sessionRef,
          function (snapshot) {

            const data =
              snapshot.val();


            if (!data) {

              pairingState.connected =
                false;

              return;

            }


            if (
              data.controllerConnected === true
            ) {

              pairingState.connected =
                true;


              pairingState.controllerName =
                data.controllerName ||
                "Phone / Tablet";


              connectedDeviceName.textContent =
                pairingState.controllerName;


              connectedDevice.classList.remove(
                "hidden"
              );


              statusElement.textContent =
                "Phone / Tablet connected";


              statusElement.className =
                "pairing-status connected";


            }

            else {

              pairingState.connected =
                false;


              connectedDevice.classList.add(
                "hidden"
              );


              statusElement.textContent =
                "Waiting for phone / tablet...";


              statusElement.className =
                "pairing-status waiting";

            }

          }
        );

    });

  }


  // -------------------------------------------------------
  // MANUAL GENERATE
  // -------------------------------------------------------

  if (generateButton) {

    generateButton.addEventListener(
      "click",
      function () {

        createPairingSession();

      }
    );

  }


  // -------------------------------------------------------
  // DISCONNECT
  // -------------------------------------------------------

  async function disconnectController() {

    if (!pairingState.sessionPath) {
      return;
    }


    waitForFirebase(async function () {

      const {

        db,
        ref,
        set

      } = window.SNKFirebase;


      try {

        await set(
          ref(
            db,
            pairingState.sessionPath +
            "/controllerConnected"
          ),
          false
        );


        await set(
          ref(
            db,
            pairingState.sessionPath +
            "/controllerName"
          ),
          ""
        );


        pairingState.connected =
          false;


        connectedDevice.classList.add(
          "hidden"
        );


        statusElement.textContent =
          "Controller disconnected";


        statusElement.className =
          "pairing-status waiting";


      }

      catch (error) {

        console.error(
          "Disconnect error:",
          error
        );

      }

    });

  }


  if (disconnectButton) {

    disconnectButton.addEventListener(
      "click",
      disconnectController
    );

  }


  // -------------------------------------------------------
  // RECEIVE COMMANDS
  // -------------------------------------------------------

  window.SNKSmartBoardReceiveCommand =
    function (command) {

      console.log(
        "Wireless command received:",
        command
      );


      /*
        Step 11.2.3 থেকে এখানে আসবে:

        PEN
        TOUCH
        MARKER
        ERASER
        UNDO
        REDO
        CLEAR
        PAGE
        PDF
        ZOOM
        CAMERA
        RECORDING
      */


      if (
        typeof command === "object" &&
        command.type
      ) {

        console.log(
          "Command type:",
          command.type
        );

      }

    };


  // -------------------------------------------------------
  // GLOBAL PAIRING BUTTON
  // -------------------------------------------------------

  window.SNKSmartBoardPairing =
    {

      open:
        window.openSmartBoardPairing,

      disconnect:
        disconnectController,

      state:
        pairingState

    };


})();
