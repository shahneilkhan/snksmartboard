/* =========================================================
   SNK SMART BOARD
   TEACHER WORKSPACE
   STEP 12.6.3
   PROFESSIONAL CAMERA + RECORDING ENGINE
   ========================================================= */

"use strict";


/* =========================================================
   SESSION PROTECTION
   ========================================================= */

(function checkTeacherSession() {

  const raw =
    sessionStorage.getItem(
      "snkSmartBoardSession"
    );

  if (!raw) {
    window.location.href = "../login.html";
    return;
  }

  try {

    const session =
      JSON.parse(raw);

    if (
      !session ||
      session.role !== "teacher"
    ) {
      window.location.href = "../login.html";
    }

  } catch (error) {

    sessionStorage.removeItem(
      "snkSmartBoardSession"
    );

    window.location.href =
      "../login.html";
  }

})();


/* =========================================================
   DOM HELPERS
   ========================================================= */

const $ = (selector) =>
  document.querySelector(selector);

const $$ = (selector) =>
  Array.from(
    document.querySelectorAll(selector)
  );


/* =========================================================
   ELEMENTS
   ========================================================= */

const board =
  $("#board");

const drawingCanvas =
  $("#drawingCanvas");

const pdfCanvas =
  $("#pdfCanvas");

const imageLayer =
  $("#imageLayer");

const boardBackground =
  $("#boardBackground");

const welcomeBoard =
  $("#welcomeBoard");

const cameraBox =
  $("#cameraBox");

const mentorVideo =
  $("#mentorVideo");

const cameraResize =
  $("#cameraResize");

const cameraEffect =
  $("#cameraEffect");

const imageInput =
  $("#imageInput");

const pdfInput =
  $("#pdfInput");

const colorPicker =
  $("#colorPicker");

const sizeSlider =
  $("#sizeSlider");

const toast =
  $("#toast");

const recordingModal =
  $("#recordingModal");

const recordingPreview =
  $("#recordingPreview");

const downloadRecording =
  $("#downloadRecording");

const recordingLight =
  $(".recording-light");

const recordTimer =
  $(".record-timer");

const pageIndicator =
  $("[data-page-indicator]");

const zoomValue =
  $("[data-zoom-value]");

const pdfStatus =
  $("[data-pdf-status]");


/* =========================================================
   PDF.JS
   ========================================================= */

if (
  typeof pdfjsLib !== "undefined"
) {

  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

}


/* =========================================================
   MAIN STATE
   ========================================================= */

const state = {

  /* ---------------------------------
     Drawing
     --------------------------------- */

  tool: "pen",

  color:
    colorPicker
      ? colorPicker.value
      : "#1677ff",

  size:
    sizeSlider
      ? Number(sizeSlider.value)
      : 4,

  drawing: false,

  lastX: 0,
  lastY: 0,

  undoStack: [],
  redoStack: [],


  /* ---------------------------------
     Pages
     --------------------------------- */

  pages: [
    {
      drawing: null,
      image: null,
      pdfPage: 0
    }
  ],

  currentPage: 0,


  /* ---------------------------------
     Zoom
     --------------------------------- */

  zoom: 1,


  /* ---------------------------------
     PDF
     --------------------------------- */

  pdfDocument: null,

  pdfPageNumber: 1,

  pdfTotalPages: 0,

  pdfLoaded: false,

  pdfFileName: "",


  /* ---------------------------------
     Image
     --------------------------------- */

  currentImage: null,


  /* ---------------------------------
     Camera
     --------------------------------- */

  cameraStream: null,

  cameraEnabled: false,

  cameraMirrored: false,

  cameraShape: "rounded",

  cameraEffect: "normal",

  cameraShadow: true,

  cameraX: 24,

  cameraY: 24,

  cameraWidth: 210,

  cameraHeight: 145,

  cameraDragging: false,

  cameraResizing: false,

  cameraDragOffsetX: 0,

  cameraDragOffsetY: 0,

  cameraResizeStartX: 0,

  cameraResizeStartY: 0,

  cameraResizeStartWidth: 210,

  cameraResizeStartHeight: 145,


  /* ---------------------------------
     Camera Processing
     --------------------------------- */

  segmentation:
    null,

  segmentationReady:
    false,

  segmentationBusy:
    false,

  processedCameraCanvas:
    null,

  processedCameraCtx:
    null,


  /* ---------------------------------
     Microphone
     --------------------------------- */

  microphoneStream:
    null,


  /* ---------------------------------
     Recording
     --------------------------------- */

  recording:
    false,

  paused:
    false,

  mediaRecorder:
    null,

  recordStream:
    null,

  recordCanvas:
    null,

  recordCtx:
    null,

  recordedChunks:
    [],

  recordingBlob:
    null,

  recordingUrl:
    null,

  recordingStartTime:
    0,

  recordingElapsedBeforePause:
    0,

  timerInterval:
    null,

  animationFrame:
    null,

  recordingMime:
    "",


  /* ---------------------------------
     Save
     --------------------------------- */

  lastSavedAt:
    null

};


/* =========================================================
   CANVAS CONTEXT
   ========================================================= */

const ctx =
  drawingCanvas
    ? drawingCanvas.getContext(
        "2d",
        {
          willReadFrequently: true
        }
      )
    : null;


/* =========================================================
   TOAST
   ========================================================= */

let toastTimer = null;

function showToast(
  message,
  duration = 2500
) {

  if (!toast) {
    return;
  }

  toast.textContent =
    message;

  toast.classList.add(
    "show"
  );

  clearTimeout(
    toastTimer
  );

  toastTimer =
    setTimeout(() => {

      toast.classList.remove(
        "show"
      );

    }, duration);

}


/* =========================================================
   BOARD SIZE
   ========================================================= */

function resizeDrawingCanvas() {

  if (
    !drawingCanvas ||
    !board
  ) {
    return;
  }

  const rect =
    board.getBoundingClientRect();

  if (
    rect.width <= 0 ||
    rect.height <= 0
  ) {
    return;
  }

  const oldCanvas =
    document.createElement(
      "canvas"
    );

  oldCanvas.width =
    drawingCanvas.width;

  oldCanvas.height =
    drawingCanvas.height;

  const oldCtx =
    oldCanvas.getContext("2d");

  if (
    drawingCanvas.width &&
    drawingCanvas.height
  ) {

    oldCtx.drawImage(
      drawingCanvas,
      0,
      0
    );

  }

  const dpr =
    Math.min(
      window.devicePixelRatio || 1,
      2
    );

  drawingCanvas.width =
    Math.round(
      rect.width * dpr
    );

  drawingCanvas.height =
    Math.round(
      rect.height * dpr
    );

  drawingCanvas.style.width =
    rect.width + "px";

  drawingCanvas.style.height =
    rect.height + "px";

  ctx.setTransform(
    dpr,
    0,
    0,
    dpr,
    0,
    0
  );

  ctx.lineCap =
    "round";

  ctx.lineJoin =
    "round";

  ctx.imageSmoothingEnabled =
    true;

  if (
    oldCanvas.width &&
    oldCanvas.height
  ) {

    ctx.drawImage(
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
   INITIAL RESIZE
   ========================================================= */

window.addEventListener(
  "resize",
  () => {

    resizeDrawingCanvas();

    setTimeout(
      renderCurrentPage,
      50
    );

  }
);


/* =========================================================
   DRAWING STYLE
   ========================================================= */

function applyDrawingStyle(
  pressure = 0.5
) {

  let width =
    Number(state.size);

  if (
    pressure &&
    pressure > 0 &&
    pressure <= 1
  ) {

    width *=
      0.7 +
      pressure * 0.6;

  }

  ctx.lineWidth =
    Math.max(
      1,
      width
    );

  ctx.lineCap =
    "round";

  ctx.lineJoin =
    "round";


  if (
    state.tool ===
    "marker"
  ) {

    ctx.globalAlpha =
      0.35;

    ctx.strokeStyle =
      state.color;

    ctx.globalCompositeOperation =
      "source-over";

  }

  else if (
    state.tool ===
    "eraser"
  ) {

    ctx.globalAlpha =
      1;

    ctx.strokeStyle =
      "#ffffff";

    ctx.globalCompositeOperation =
      "destination-out";

    ctx.lineWidth =
      Math.max(
        10,
        width * 3
      );

  }

  else {

    ctx.globalAlpha =
      1;

    ctx.strokeStyle =
      state.color;

    ctx.globalCompositeOperation =
      "source-over";

  }

}


/* =========================================================
   DRAW SEGMENT
   ========================================================= */

function drawSegment(
  x1,
  y1,
  x2,
  y2,
  pressure = 0.5
) {

  if (!ctx) {
    return;
  }

  applyDrawingStyle(
    pressure
  );

  ctx.beginPath();

  ctx.moveTo(
    x1,
    y1
  );

  ctx.lineTo(
    x2,
    y2
  );

  ctx.stroke();

}


/* =========================================================
   POINTER POSITION
   ========================================================= */

function getCanvasPoint(
  event
) {

  const rect =
    drawingCanvas.getBoundingClientRect();

  return {

    x:
      event.clientX -
      rect.left,

    y:
      event.clientY -
      rect.top

  };

}


/* =========================================================
   SAVE DRAWING SNAPSHOT
   ========================================================= */

function saveDrawingSnapshot() {

  if (!drawingCanvas) {
    return;
  }

  state.undoStack.push(
    drawingCanvas.toDataURL(
      "image/png"
    )
  );

  if (
    state.undoStack.length >
    30
  ) {

    state.undoStack.shift();

  }

  state.redoStack = [];

}


/* =========================================================
   POINTER DOWN
   ========================================================= */

drawingCanvas.addEventListener(
  "pointerdown",
  (event) => {

    if (
      state.tool === "text" ||
      state.tool === "shape"
    ) {

      handleSpecialTool(
        event
      );

      return;

    }

    state.drawing = true;

    drawingCanvas.setPointerCapture(
      event.pointerId
    );

    saveDrawingSnapshot();

    const point =
      getCanvasPoint(event);

    state.lastX =
      point.x;

    state.lastY =
      point.y;

    drawSegment(
      point.x,
      point.y,
      point.x + 0.01,
      point.y + 0.01,
      event.pressure || 0.5
    );

    welcomeBoard?.style.setProperty(
      "display",
      "none"
    );

  }
);


/* =========================================================
   POINTER MOVE
   ========================================================= */

drawingCanvas.addEventListener(
  "pointermove",
  (event) => {

    if (!state.drawing) {
      return;
    }

    const point =
      getCanvasPoint(event);

    drawSegment(
      state.lastX,
      state.lastY,
      point.x,
      point.y,
      event.pressure || 0.5
    );

    state.lastX =
      point.x;

    state.lastY =
      point.y;

  }
);


/* =========================================================
   POINTER UP
   ========================================================= */

function finishDrawing(
  event
) {

  if (!state.drawing) {
    return;
  }

  state.drawing = false;

  try {

    drawingCanvas.releasePointerCapture(
      event.pointerId
    );

  } catch (_) {}

  ctx.globalAlpha = 1;

  ctx.globalCompositeOperation =
    "source-over";

  saveCurrentPage();

}


drawingCanvas.addEventListener(
  "pointerup",
  finishDrawing
);

drawingCanvas.addEventListener(
  "pointercancel",
  finishDrawing
);

drawingCanvas.addEventListener(
  "pointerleave",
  (event) => {

    if (
      state.drawing &&
      event.pointerType ===
      "mouse"
    ) {

      finishDrawing(
        event
      );

    }

  }
);


/* =========================================================
   TOOL SELECT
   ========================================================= */

$$("[data-tool]")
  .forEach((button) => {

    button.addEventListener(
      "click",
      () => {

        state.tool =
          button.dataset.tool;

        $$("[data-tool]")
          .forEach((item) => {

            item.classList.toggle(
              "active",
              item === button
            );

          });


        if (
          state.tool ===
          "eraser"
        ) {

          drawingCanvas.style.cursor =
            "cell";

        }

        else {

          drawingCanvas.style.cursor =
            "crosshair";

        }

      }
    );

  });


/* =========================================================
   COLOR
   ========================================================= */

colorPicker?.addEventListener(
  "input",
  () => {

    state.color =
      colorPicker.value;

  }
);


/* =========================================================
   SIZE
   ========================================================= */

sizeSlider?.addEventListener(
  "input",
  () => {

    state.size =
      Number(
        sizeSlider.value
      );

  }
);


/* =========================================================
   UNDO
   ========================================================= */

function undo() {

  if (
    state.undoStack.length === 0
  ) {

    showToast(
      "Nothing to undo."
    );

    return;

  }

  const current =
    drawingCanvas.toDataURL(
      "image/png"
    );

  state.redoStack.push(
    current
  );

  const previous =
    state.undoStack.pop();

  restoreCanvasImage(
    previous
  );

}


/* =========================================================
   REDO
   ========================================================= */

function redo() {

  if (
    state.redoStack.length === 0
  ) {

    showToast(
      "Nothing to redo."
    );

    return;

  }

  state.undoStack.push(
    drawingCanvas.toDataURL(
      "image/png"
    )
  );

  const next =
    state.redoStack.pop();

  restoreCanvasImage(
    next
  );

}


/* =========================================================
   RESTORE CANVAS IMAGE
   ========================================================= */

function restoreCanvasImage(
  dataUrl
) {

  const image =
    new Image();

  image.onload =
    () => {

      ctx.clearRect(
        0,
        0,
        drawingCanvas.width,
        drawingCanvas.height
      );

      const rect =
        drawingCanvas.getBoundingClientRect();

      ctx.drawImage(
        image,
        0,
        0,
        rect.width,
        rect.height
      );

      saveCurrentPage();

    };

  image.src =
    dataUrl;

}


/* =========================================================
   CLEAR
   ========================================================= */

function clearBoard() {

  saveDrawingSnapshot();

  ctx.clearRect(
    0,
    0,
    drawingCanvas.width,
    drawingCanvas.height
  );

  state.redoStack = [];

  if (welcomeBoard) {
    welcomeBoard.style.display =
      "grid";
  }

  saveCurrentPage();

  showToast(
    "Board cleared."
  );

}


/* =========================================================
   NEW BOARD
   ========================================================= */

function newBoard() {

  state.pages = [
    {
      drawing: null,
      image: null,
      pdfPage: 0
    }
  ];

  state.currentPage = 0;

  state.undoStack = [];

  state.redoStack = [];

  state.currentImage = null;

  state.pdfDocument = null;

  state.pdfLoaded = false;

  state.pdfPageNumber = 1;

  state.pdfTotalPages = 0;

  imageLayer.innerHTML = "";

  ctx.clearRect(
    0,
    0,
    drawingCanvas.width,
    drawingCanvas.height
  );

  if (pdfCanvas) {

    const pdfCtx =
      pdfCanvas.getContext(
        "2d"
      );

    pdfCtx.clearRect(
      0,
      0,
      pdfCanvas.width,
      pdfCanvas.height
    );

  }

  welcomeBoard?.style.setProperty(
    "display",
    "grid"
  );

  updatePageIndicator();

  updatePdfStatus();

  showToast(
    "New board created."
  );

}


/* =========================================================
   SPECIAL TOOL
   ========================================================= */

function handleSpecialTool(
  event
) {

  const point =
    getCanvasPoint(event);

  if (
    state.tool === "text"
  ) {

    const text =
      window.prompt(
        "Enter text:"
      );

    if (!text) {
      return;
    }

    saveDrawingSnapshot();

    ctx.globalAlpha = 1;

    ctx.globalCompositeOperation =
      "source-over";

    ctx.fillStyle =
      state.color;

    ctx.font =
      `${Math.max(
        18,
        state.size * 5
      )}px Arial`;

    ctx.fillText(
      text,
      point.x,
      point.y
    );

    saveCurrentPage();

    showToast(
      "Text added."
    );

  }

  else if (
    state.tool === "shape"
  ) {

    saveDrawingSnapshot();

    ctx.globalAlpha = 1;

    ctx.globalCompositeOperation =
      "source-over";

    ctx.strokeStyle =
      state.color;

    ctx.lineWidth =
      Math.max(
        2,
        state.size
      );

    ctx.strokeRect(
      point.x - 50,
      point.y - 30,
      100,
      60
    );

    saveCurrentPage();

    showToast(
      "Shape added."
    );

  }

}


/* =========================================================
   PAGE SAVE
   ========================================================= */

function saveCurrentPage() {

  if (
    !state.pages[
      state.currentPage
    ]
  ) {
    return;
  }

  state.pages[
    state.currentPage
  ].drawing =
    drawingCanvas.toDataURL(
      "image/png"
    );

}


/* =========================================================
   PAGE RESTORE
   ========================================================= */

function renderCurrentPage() {

  if (!drawingCanvas) {
    return;
  }

  const page =
    state.pages[
      state.currentPage
    ];

  ctx.clearRect(
    0,
    0,
    drawingCanvas.width,
    drawingCanvas.height
  );

  state.undoStack = [];

  state.redoStack = [];


  if (
    page &&
    page.drawing
  ) {

    restoreCanvasImage(
      page.drawing
    );

  }


  updatePageIndicator();

}


/* =========================================================
   ADD PAGE
   ========================================================= */

function addPage() {

  saveCurrentPage();

  state.pages.push({
    drawing: null,
    image: null,
    pdfPage: 0
  });

  state.currentPage =
    state.pages.length - 1;

  ctx.clearRect(
    0,
    0,
    drawingCanvas.width,
    drawingCanvas.height
  );

  imageLayer.innerHTML = "";

  welcomeBoard?.style.setProperty(
    "display",
    "grid"
  );

  updatePageIndicator();

  showToast(
    "New page added."
  );

}


/* =========================================================
   NEXT PAGE
   ========================================================= */

function nextPage() {

  if (
    state.currentPage >=
    state.pages.length - 1
  ) {

    return;

  }

  saveCurrentPage();

  state.currentPage++;

  renderCurrentPage();

}


/* =========================================================
   PREVIOUS PAGE
   ========================================================= */

function previousPage() {

  if (
    state.currentPage <= 0
  ) {

    return;

  }

  saveCurrentPage();

  state.currentPage--;

  renderCurrentPage();

}


/* =========================================================
   PAGE INDICATOR
   ========================================================= */

function updatePageIndicator() {

  if (!pageIndicator) {
    return;
  }

  pageIndicator.textContent =
    `${state.currentPage + 1} / ${state.pages.length}`;

}


/* =========================================================
   ZOOM
   ========================================================= */

function setZoom(
  value
) {

  state.zoom =
    Math.max(
      0.5,
      Math.min(
        2,
        value
      )
    );

  board.style.transform =
    `scale(${state.zoom})`;

  board.style.transformOrigin =
    "center center";

  if (zoomValue) {

    zoomValue.textContent =
      `${Math.round(
        state.zoom * 100
      )}%`;

  }

}


function zoomIn() {

  setZoom(
    state.zoom + 0.1
  );

}


function zoomOut() {

  setZoom(
    state.zoom - 0.1
  );

}


/* =========================================================
   IMAGE UPLOAD
   ========================================================= */

function openImagePicker() {

  imageInput?.click();

}


imageInput?.addEventListener(
  "change",
  () => {

    const file =
      imageInput.files?.[0];

    if (!file) {
      return;
    }

    const reader =
      new FileReader();

    reader.onload =
      () => {

        imageLayer.innerHTML =
          "";

        const image =
          document.createElement(
            "img"
          );

        image.src =
          reader.result;

        image.className =
          "uploaded-image";

        image.style.left =
          "10%";

        image.style.top =
          "10%";

        image.style.width =
          "60%";

        image.style.height =
          "auto";

        imageLayer.appendChild(
          image
        );

        state.currentImage =
          image;

        welcomeBoard?.style.setProperty(
          "display",
          "none"
        );

        makeImageDraggable(
          image
        );

        showToast(
          "Image added to board."
        );

      };

    reader.readAsDataURL(
      file
    );

    imageInput.value =
      "";

  }
);


/* =========================================================
   IMAGE DRAG
   ========================================================= */

function makeImageDraggable(
  image
) {

  let dragging = false;

  let startX = 0;

  let startY = 0;

  let startLeft = 0;

  let startTop = 0;


  image.addEventListener(
    "pointerdown",
    (event) => {

      dragging = true;

      image.setPointerCapture(
        event.pointerId
      );

      startX =
        event.clientX;

      startY =
        event.clientY;

      startLeft =
        parseFloat(
          image.style.left
        ) || 0;

      startTop =
        parseFloat(
          image.style.top
        ) || 0;

      image.style.cursor =
        "grabbing";

    }
  );


  image.addEventListener(
    "pointermove",
    (event) => {

      if (!dragging) {
        return;
      }

      const rect =
        board.getBoundingClientRect();

      const dx =
        (
          event.clientX -
          startX
        ) /
        rect.width *
        100;

      const dy =
        (
          event.clientY -
          startY
        ) /
        rect.height *
        100;

      image.style.left =
        `${startLeft + dx}%`;

      image.style.top =
        `${startTop + dy}%`;

    }
  );


  image.addEventListener(
    "pointerup",
    (event) => {

      dragging = false;

      image.style.cursor =
        "grab";

      try {
        image.releasePointerCapture(
          event.pointerId
        );
      } catch (_) {}

    }
  );

}


/* =========================================================
   PDF UPLOAD
   ========================================================= */

function openPdfPicker() {

  pdfInput?.click();

}


pdfInput?.addEventListener(
  "change",
  async () => {

    const file =
      pdfInput.files?.[0];

    if (!file) {
      return;
    }

    if (
      typeof pdfjsLib ===
      "undefined"
    ) {

      showToast(
        "PDF engine is not loaded."
      );

      return;

    }

    try {

      const arrayBuffer =
        await file.arrayBuffer();

      state.pdfDocument =
        await pdfjsLib.getDocument({
          data: arrayBuffer
        }).promise;

      state.pdfTotalPages =
        state.pdfDocument.numPages;

      state.pdfPageNumber =
        1;

      state.pdfLoaded =
        true;

      state.pdfFileName =
        file.name;

      await renderPdfPage(
        state.pdfPageNumber
      );

      updatePdfStatus();

      welcomeBoard?.style.setProperty(
        "display",
        "none"
      );

      showToast(
        `${file.name} loaded.`
      );

    } catch (error) {

      console.error(
        "PDF error:",
        error
      );

      showToast(
        "Could not open this PDF."
      );

    }

    pdfInput.value =
      "";

  }
);


/* =========================================================
   RENDER PDF PAGE
   ========================================================= */

async function renderPdfPage(
  pageNumber
) {

  if (
    !state.pdfDocument ||
    !pdfCanvas
  ) {
    return;
  }

  const page =
    await state.pdfDocument.getPage(
      pageNumber
    );

  const boardRect =
    board.getBoundingClientRect();

  const baseViewport =
    page.getViewport({
      scale: 1
    });

  const scale =
    Math.min(
      boardRect.width /
      baseViewport.width,

      boardRect.height /
      baseViewport.height
    );

  const viewport =
    page.getViewport({
      scale
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

  pdfCanvas.style.left =
    `${(
      boardRect.width -
      viewport.width
    ) / 2}px`;

  pdfCanvas.style.top =
    `${(
      boardRect.height -
      viewport.height
    ) / 2}px`;

  pdfCanvas.style.right =
    "auto";

  pdfCanvas.style.bottom =
    "auto";

  const pdfCtx =
    pdfCanvas.getContext(
      "2d"
    );

  pdfCtx.setTransform(
    dpr,
    0,
    0,
    dpr,
    0,
    0
  );

  await page.render({

    canvasContext:
      pdfCtx,

    viewport

  }).promise;

  state.pdfPageNumber =
    pageNumber;

  updatePdfStatus();

}


/* =========================================================
   PDF NEXT
   ========================================================= */

async function nextPdfPage() {

  if (
    !state.pdfLoaded
  ) {
    showToast(
      "Open a PDF first."
    );

    return;
  }

  if (
    state.pdfPageNumber >=
    state.pdfTotalPages
  ) {
    return;
  }

  await renderPdfPage(
    state.pdfPageNumber + 1
  );

}


/* =========================================================
   PDF PREVIOUS
   ========================================================= */

async function previousPdfPage() {

  if (
    !state.pdfLoaded
  ) {
    showToast(
      "Open a PDF first."
    );

    return;
  }

  if (
    state.pdfPageNumber <= 1
  ) {
    return;
  }

  await renderPdfPage(
    state.pdfPageNumber - 1
  );

}


/* =========================================================
   PDF STATUS
   ========================================================= */

function updatePdfStatus() {

  if (!pdfStatus) {
    return;
  }

  if (
    state.pdfLoaded
  ) {

    pdfStatus.textContent =
      `PDF ${state.pdfPageNumber} / ${state.pdfTotalPages}`;

  }

  else {

    pdfStatus.textContent =
      "No PDF";

  }

}


/* =========================================================
   CAMERA INITIALIZATION
   ========================================================= */

async function startCamera() {

  if (
    state.cameraStream
  ) {

    state.cameraEnabled =
      true;

    cameraBox.classList.add(
      "camera-on"
    );

    return;

  }

  if (
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia
  ) {

    showToast(
      "Camera is not supported by this browser."
    );

    return;

  }

  try {

    const stream =
      await navigator.mediaDevices.getUserMedia({

        video: {

          facingMode:
            "user",

          width: {
            ideal: 1280
          },

          height: {
            ideal: 720
          },

          frameRate: {
            ideal: 30
          }

        },

        audio: false

      });


    state.cameraStream =
      stream;

    mentorVideo.srcObject =
      stream;

    await mentorVideo.play();

    state.cameraEnabled =
      true;

    cameraBox.classList.add(
      "camera-on"
    );

    applyCameraAppearance();

    await initializeSegmentation();

    showToast(
      "Camera turned on."
    );

  } catch (error) {

    console.error(
      "Camera error:",
      error
    );

    showToast(
      "Camera permission was denied or unavailable."
    );

  }

}


/* =========================================================
   STOP CAMERA
   ========================================================= */

function stopCamera() {

  if (
    state.cameraStream
  ) {

    state.cameraStream
      .getTracks()
      .forEach(
        track =>
          track.stop()
      );

  }

  state.cameraStream =
    null;

  state.cameraEnabled =
    false;

  mentorVideo.srcObject =
    null;

  cameraBox.classList.remove(
    "camera-on"
  );

  showToast(
    "Camera turned off."
  );

}


/* =========================================================
   CAMERA TOGGLE
   ========================================================= */

function toggleCamera() {

  if (
    state.cameraEnabled
  ) {

    stopCamera();

  }

  else {

    startCamera();

  }

}


/* =========================================================
   CAMERA MIRROR
   ========================================================= */

function toggleCameraMirror() {

  state.cameraMirrored =
    !state.cameraMirrored;

  applyCameraAppearance();

}


/* =========================================================
   CAMERA APPEARANCE
   ========================================================= */

function applyCameraAppearance() {

  if (!mentorVideo) {
    return;
  }

  mentorVideo.classList.toggle(
    "mirrored",
    state.cameraMirrored
  );


  cameraBox.classList.remove(
    "rectangle",
    "rounded",
    "circle",
    "no-shadow",
    "effect-normal",
    "effect-soft-blur",
    "effect-office",
    "effect-classroom",
    "effect-gradient"
  );


  cameraBox.classList.add(
    state.cameraShape
  );


  cameraBox.classList.add(
    `effect-${state.cameraEffect}`
  );


  if (
    !state.cameraShadow
  ) {

    cameraBox.classList.add(
      "no-shadow"
    );

  }

}


/* =========================================================
   CAMERA EFFECT SELECT
   ========================================================= */

cameraEffect?.addEventListener(
  "change",
  () => {

    state.cameraEffect =
      cameraEffect.value;

    applyCameraAppearance();

    if (
      state.cameraEffect !==
      "normal"
    ) {

      initializeSegmentation();

    }

  }
);


/* =========================================================
   CAMERA SHAPE
   ========================================================= */

$$("[data-camera-shape]")
  .forEach((button) => {

    button.addEventListener(
      "click",
      () => {

        state.cameraShape =
          button.dataset.cameraShape;

        applyCameraAppearance();

        $$("[data-camera-shape]")
          .forEach(
            item =>
              item.classList.toggle(
                "active",
                item === button
              )
          );

      }
    );

  });


/* =========================================================
   CAMERA SHADOW
   ========================================================= */

function toggleCameraShadow() {

  state.cameraShadow =
    !state.cameraShadow;

  applyCameraAppearance();

}


/* =========================================================
   CAMERA CENTER
   ========================================================= */

function centerCamera() {

  const rect =
    board.getBoundingClientRect();

  state.cameraWidth =
    Math.min(
      state.cameraWidth,
      rect.width * 0.45
    );

  state.cameraHeight =
    Math.min(
      state.cameraHeight,
      rect.height * 0.45
    );

  state.cameraX =
    (
      rect.width -
      state.cameraWidth
    ) / 2;

  state.cameraY =
    (
      rect.height -
      state.cameraHeight
    ) / 2;

  updateCameraBoxPosition();

  showToast(
    "Camera centered."
  );

}


/* =========================================================
   CAMERA POSITION
   ========================================================= */

function updateCameraBoxPosition() {

  cameraBox.style.left =
    `${state.cameraX}px`;

  cameraBox.style.top =
    `${state.cameraY}px`;

  cameraBox.style.width =
    `${state.cameraWidth}px`;

  cameraBox.style.height =
    `${state.cameraHeight}px`;

}


/* =========================================================
   CAMERA DRAG
   ========================================================= */

cameraBox.addEventListener(
  "pointerdown",
  (event) => {

    if (
      event.target ===
      cameraResize
    ) {
      return;
    }

    state.cameraDragging =
      true;

    cameraBox.setPointerCapture(
      event.pointerId
    );

    state.cameraDragOffsetX =
      event.clientX -
      state.cameraX -
      board.getBoundingClientRect().left;

    state.cameraDragOffsetY =
      event.clientY -
      state.cameraY -
      board.getBoundingClientRect().top;

  }
);


cameraBox.addEventListener(
  "pointermove",
  (event) => {

    if (
      !state.cameraDragging
    ) {
      return;
    }

    const rect =
      board.getBoundingClientRect();

    let x =
      event.clientX -
      rect.left -
      state.cameraDragOffsetX;

    let y =
      event.clientY -
      rect.top -
      state.cameraDragOffsetY;


    x =
      Math.max(
        0,
        Math.min(
          x,
          rect.width -
          state.cameraWidth
        )
      );

    y =
      Math.max(
        0,
        Math.min(
          y,
          rect.height -
          state.cameraHeight
        )
      );


    state.cameraX =
      x;

    state.cameraY =
      y;

    updateCameraBoxPosition();

  }
);


cameraBox.addEventListener(
  "pointerup",
  (event) => {

    state.cameraDragging =
      false;

    try {

      cameraBox.releasePointerCapture(
        event.pointerId
      );

    } catch (_) {}

  }
);


/* =========================================================
   CAMERA RESIZE
   ========================================================= */

cameraResize.addEventListener(
  "pointerdown",
  (event) => {

    event.stopPropagation();

    state.cameraResizing =
      true;

    cameraResize.setPointerCapture(
      event.pointerId
    );

    state.cameraResizeStartX =
      event.clientX;

    state.cameraResizeStartY =
      event.clientY;

    state.cameraResizeStartWidth =
      state.cameraWidth;

    state.cameraResizeStartHeight =
      state.cameraHeight;

  }
);


cameraResize.addEventListener(
  "pointermove",
  (event) => {

    if (
      !state.cameraResizing
    ) {
      return;
    }

    const dx =
      event.clientX -
      state.cameraResizeStartX;

    const dy =
      event.clientY -
      state.cameraResizeStartY;


    let newWidth =
      state.cameraResizeStartWidth +
      dx;

    let newHeight =
      state.cameraResizeStartHeight +
      dy;


    newWidth =
      Math.max(
        110,
        Math.min(
          600,
          newWidth
        )
      );

    newHeight =
      Math.max(
        90,
        Math.min(
          500,
          newHeight
        )
      );


    if (
      state.cameraShape ===
      "circle"
    ) {

      const size =
        Math.max(
          newWidth,
          newHeight
        );

      newWidth =
        size;

      newHeight =
        size;

    }


    const rect =
      board.getBoundingClientRect();


    newWidth =
      Math.min(
        newWidth,
        rect.width -
        state.cameraX
      );


    newHeight =
      Math.min(
        newHeight,
        rect.height -
        state.cameraY
      );


    state.cameraWidth =
      newWidth;

    state.cameraHeight =
      newHeight;

    updateCameraBoxPosition();

  }
);


cameraResize.addEventListener(
  "pointerup",
  (event) => {

    state.cameraResizing =
      false;

    try {

      cameraResize.releasePointerCapture(
        event.pointerId
      );

    } catch (_) {}

  }
);


/* =========================================================
   MEDIA PIPE SELFIE SEGMENTATION
   ========================================================= */

async function initializeSegmentation() {

  if (
    typeof SelfieSegmentation ===
    "undefined"
  ) {

    /*
     * The HTML can later include
     * MediaPipe Selfie Segmentation.
     *
     * If it is not available, the system
     * automatically falls back to normal
     * camera rendering / blur.
     */

    state.segmentationReady =
      false;

    return;

  }


  if (
    state.segmentation
  ) {

    return;

  }


  try {

    state.segmentation =
      new SelfieSegmentation({

        locateFile:
          (file) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`

      });


    state.segmentation.setOptions({

      modelSelection:
        1,

      selfieMode:
        false

    });


    state.segmentation.onResults(
      handleSegmentationResults
    );


    state.segmentationReady =
      true;

  } catch (error) {

    console.warn(
      "Segmentation unavailable:",
      error
    );

    state.segmentation =
      null;

    state.segmentationReady =
      false;

  }

}


/* =========================================================
   PROCESSED CAMERA CANVAS
   ========================================================= */

function ensureProcessedCameraCanvas() {

  if (
    state.processedCameraCanvas
  ) {

    return;

  }

  const canvas =
    document.createElement(
      "canvas"
    );

  canvas.width =
    640;

  canvas.height =
    360;

  canvas.style.display =
    "none";

  canvas.id =
    "cameraProcessedCanvas";

  document.body.appendChild(
    canvas
  );

  state.processedCameraCanvas =
    canvas;

  state.processedCameraCtx =
    canvas.getContext(
      "2d"
    );

}


/* =========================================================
   SEGMENTATION RESULTS
   ========================================================= */

function handleSegmentationResults(
  results
) {

  if (
    !state.processedCameraCanvas ||
    !state.processedCameraCtx
  ) {
    return;
  }

  const canvas =
    state.processedCameraCanvas;

  const pctx =
    state.processedCameraCtx;

  const width =
    canvas.width;

  const height =
    canvas.height;


  pctx.clearRect(
    0,
    0,
    width,
    height
  );


  /* -----------------------------------------------
     ORIGINAL
     ----------------------------------------------- */

  if (
    state.cameraEffect ===
    "normal"
  ) {

    drawCameraSource(
      pctx,
      results.image,
      width,
      height
    );

    return;

  }


  /* -----------------------------------------------
     GRADIENT
     ----------------------------------------------- */

  if (
    state.cameraEffect ===
    "gradient"
  ) {

    const gradient =
      pctx.createLinearGradient(
        0,
        0,
        width,
        height
      );

    gradient.addColorStop(
      0,
      "#dcefff"
    );

    gradient.addColorStop(
      1,
      "#b8d6f1"
    );

    pctx.fillStyle =
      gradient;

    pctx.fillRect(
      0,
      0,
      width,
      height
    );

    drawPersonUsingMask(
      pctx,
      results,
      width,
      height
    );

    return;

  }


  /* -----------------------------------------------
     OFFICE
     ----------------------------------------------- */

  if (
    state.cameraEffect ===
    "office"
  ) {

    drawOfficeBackground(
      pctx,
      width,
      height
    );

    drawPersonUsingMask(
      pctx,
      results,
      width,
      height
    );

    return;

  }


  /* -----------------------------------------------
     CLASSROOM
     ----------------------------------------------- */

  if (
    state.cameraEffect ===
    "classroom"
  ) {

    drawClassroomBackground(
      pctx,
      width,
      height
    );

    drawPersonUsingMask(
      pctx,
      results,
      width,
      height
    );

    return;

  }


  /* -----------------------------------------------
     SOFT BLUR
     ----------------------------------------------- */

  if (
    state.cameraEffect ===
    "soft-blur"
  ) {

    drawBlurredBackground(
      pctx,
      results.image,
      width,
      height
    );

    drawPersonUsingMask(
      pctx,
      results,
      width,
      height
    );

  }

}


/* =========================================================
   DRAW CAMERA SOURCE
   ========================================================= */

function drawCameraSource(
  context,
  source,
  width,
  height
) {

  context.save();

  if (
    state.cameraMirrored
  ) {

    context.translate(
      width,
      0
    );

    context.scale(
      -1,
      1
    );

  }

  context.drawImage(
    source,
    0,
    0,
    width,
    height
  );

  context.restore();

}


/* =========================================================
   DRAW BLURRED BACKGROUND
   ========================================================= */

function drawBlurredBackground(
  context,
  source,
  width,
  height
) {

  context.save();

  context.filter =
    "blur(14px)";

  context.drawImage(
    source,
    -12,
    -12,
    width + 24,
    height + 24
  );

  context.restore();

}


/* =========================================================
   DRAW PERSON USING MASK
   ========================================================= */

function drawPersonUsingMask(
  context,
  results,
  width,
  height
) {

  if (
    !results.segmentationMask
  ) {

    drawCameraSource(
      context,
      results.image,
      width,
      height
    );

    return;

  }


  const personCanvas =
    document.createElement(
      "canvas"
    );

  personCanvas.width =
    width;

  personCanvas.height =
    height;

  const personCtx =
    personCanvas.getContext(
      "2d"
    );


  personCtx.save();

  if (
    state.cameraMirrored
  ) {

    personCtx.translate(
      width,
      0
    );

    personCtx.scale(
      -1,
      1
    );

  }

  personCtx.drawImage(
    results.image,
    0,
    0,
    width,
    height
  );

  personCtx.restore();


  const maskCanvas =
    document.createElement(
      "canvas"
    );

  maskCanvas.width =
    width;

  maskCanvas.height =
    height;

  const maskCtx =
    maskCanvas.getContext(
      "2d"
    );


  maskCtx.drawImage(
    results.segmentationMask,
    0,
    0,
    width,
    height
  );


  personCtx.globalCompositeOperation =
    "destination-in";

  personCtx.drawImage(
    maskCanvas,
    0,
    0
  );


  context.drawImage(
    personCanvas,
    0,
    0
  );

}


/* =========================================================
   OFFICE BACKGROUND
   ========================================================= */

function drawOfficeBackground(
  context,
  width,
  height
) {

  const gradient =
    context.createLinearGradient(
      0,
      0,
      0,
      height
    );

  gradient.addColorStop(
    0,
    "#e9eef3"
  );

  gradient.addColorStop(
    1,
    "#b8c6d2"
  );

  context.fillStyle =
    gradient;

  context.fillRect(
    0,
    0,
    width,
    height
  );


  /* Window */

  context.fillStyle =
    "#cde6f8";

  context.fillRect(
    width * 0.08,
    height * 0.12,
    width * 0.28,
    height * 0.35
  );


  context.strokeStyle =
    "#ffffff";

  context.lineWidth =
    5;

  context.beginPath();

  context.moveTo(
    width * 0.22,
    height * 0.12
  );

  context.lineTo(
    width * 0.22,
    height * 0.47
  );

  context.moveTo(
    width * 0.08,
    height * 0.295
  );

  context.lineTo(
    width * 0.36,
    height * 0.295
  );

  context.stroke();


  /* Desk */

  context.fillStyle =
    "#8b6b52";

  context.fillRect(
    0,
    height * 0.75,
    width,
    height * 0.25
  );


  /* Plant */

  context.fillStyle =
    "#4b8f62";

  context.beginPath();

  context.arc(
    width * 0.82,
    height * 0.67,
    height * 0.08,
    0,
    Math.PI * 2
  );

  context.fill();


  context.fillStyle =
    "#6c4a35";

  context.fillRect(
    width * 0.79,
    height * 0.72,
    width * 0.06,
    height * 0.12
  );

}


/* =========================================================
   CLASSROOM BACKGROUND
   ========================================================= */

function drawClassroomBackground(
  context,
  width,
  height
) {

  context.fillStyle =
    "#e9f2f7";

  context.fillRect(
    0,
    0,
    width,
    height
  );


  /* Board */

  context.fillStyle =
    "#395f65";

  context.fillRect(
    width * 0.08,
    height * 0.14,
    width * 0.55,
    height * 0.43
  );


  /* Board frame */

  context.strokeStyle =
    "#8b6b52";

  context.lineWidth =
    10;

  context.strokeRect(
    width * 0.08,
    height * 0.14,
    width * 0.55,
    height * 0.43
  );


  /* Simple writing */

  context.strokeStyle =
    "rgba(255,255,255,0.72)";

  context.lineWidth =
    3;

  context.beginPath();

  context.moveTo(
    width * 0.14,
    height * 0.28
  );

  context.lineTo(
    width * 0.48,
    height * 0.28
  );

  context.moveTo(
    width * 0.14,
    height * 0.38
  );

  context.lineTo(
    width * 0.42,
    height * 0.38
  );

  context.moveTo(
    width * 0.14,
    height * 0.48
  );

  context.lineTo(
    width * 0.52,
    height * 0.48
  );

  context.stroke();


  /* Teacher desk */

  context.fillStyle =
    "#866b55";

  context.fillRect(
    width * 0.63,
    height * 0.64,
    width * 0.25,
    height * 0.12
  );


  /* Floor */

  context.fillStyle =
    "#c8bcae";

  context.fillRect(
    0,
    height * 0.76,
    width,
    height * 0.24
  );

}


/* =========================================================
   START CAMERA PROCESS LOOP
   ========================================================= */

function processCameraFrame() {

  if (
    !state.cameraEnabled ||
    !state.cameraStream
  ) {

    return;

  }

  if (
    state.cameraEffect ===
    "normal"
  ) {

    return;

  }

  if (
    !state.segmentationReady ||
    !state.segmentation
  ) {

    return;

  }

  if (
    state.segmentationBusy
  ) {

    return;

  }

  if (
    mentorVideo.readyState <
    2
  ) {

    return;

  }


  ensureProcessedCameraCanvas();

  state.segmentationBusy =
    true;


  state.segmentation.send({
    image: mentorVideo
  })
  .catch(
    error =>
      console.warn(
        "Segmentation frame error:",
        error
      )
  )
  .finally(() => {

    state.segmentationBusy =
      false;

  });

}


/* =========================================================
   CAMERA PROCESS LOOP
   ========================================================= */

function cameraProcessingLoop() {

  processCameraFrame();

  requestAnimationFrame(
    cameraProcessingLoop
  );

}

cameraProcessingLoop();


/* =========================================================
   RECORDING CANVAS
   ========================================================= */

function createRecordingCanvas() {

  if (
    state.recordCanvas
  ) {

    return;

  }

  const canvas =
    document.createElement(
      "canvas"
    );

  canvas.width =
    1280;

  canvas.height =
    720;

  canvas.id =
    "recordCanvas";

  state.recordCanvas =
    canvas;

  state.recordCtx =
    canvas.getContext(
      "2d"
    );

}


/* =========================================================
   CONTAIN DRAW
   ========================================================= */

function drawContain(
  context,
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

  const sourceRatio =
    source.width /
    source.height;

  const targetRatio =
    width /
    height;

  let drawWidth =
    width;

  let drawHeight =
    height;

  let drawX =
    x;

  let drawY =
    y;


  if (
    sourceRatio >
    targetRatio
  ) {

    drawHeight =
      width /
      sourceRatio;

    drawY =
      y +
      (
        height -
        drawHeight
      ) / 2;

  }

  else {

    drawWidth =
      height *
      sourceRatio;

    drawX =
      x +
      (
        width -
        drawWidth
      ) / 2;

  }


  context.drawImage(
    source,
    drawX,
    drawY,
    drawWidth,
    drawHeight
  );

}


/* =========================================================
   DRAW BOARD TO RECORDING
   ========================================================= */

function drawBoardToRecording(
  context
) {

  const width =
    state.recordCanvas.width;

  const height =
    state.recordCanvas.height;


  /* -----------------------------------------------
     WHITE BOARD
     ----------------------------------------------- */

  context.fillStyle =
    "#ffffff";

  context.fillRect(
    0,
    0,
    width,
    height
  );


  /* -----------------------------------------------
     PDF
     ----------------------------------------------- */

  if (
    state.pdfLoaded &&
    pdfCanvas &&
    pdfCanvas.width
  ) {

    drawContain(
      context,
      pdfCanvas,
      0,
      0,
      width,
      height
    );

  }


  /* -----------------------------------------------
     IMAGE
     ----------------------------------------------- */

  const image =
    imageLayer.querySelector(
      "img"
    );

  if (image) {

    const boardRect =
      board.getBoundingClientRect();

    const imageRect =
      image.getBoundingClientRect();


    const scaleX =
      width /
      boardRect.width;

    const scaleY =
      height /
      boardRect.height;


    const x =
      (
        imageRect.left -
        boardRect.left
      ) *
      scaleX;

    const y =
      (
        imageRect.top -
        boardRect.top
      ) *
      scaleY;


    const imageWidth =
      imageRect.width *
      scaleX;

    const imageHeight =
      imageRect.height *
      scaleY;


    if (
      image.complete
    ) {

      context.drawImage(
        image,
        x,
        y,
        imageWidth,
        imageHeight
      );

    }

  }


  /* -----------------------------------------------
     DRAWING
     ----------------------------------------------- */

  if (
    drawingCanvas.width
  ) {

    context.drawImage(
      drawingCanvas,
      0,
      0,
      width,
      height
    );

  }


  /* -----------------------------------------------
     CAMERA
     ----------------------------------------------- */

  drawCameraToRecording(
    context
  );


  /* -----------------------------------------------
     WATERMARK
     ----------------------------------------------- */

  context.save();

  context.fillStyle =
    "rgba(16,32,51,0.68)";

  context.font =
    "700 18px Arial";

  context.fillText(
    "SNK Smart Board",
    25,
    height - 25
  );

  context.restore();

}


/* =========================================================
   GET PROCESSED CAMERA SOURCE
   ========================================================= */

function getCameraRecordingSource() {

  if (
    state.cameraEffect !==
      "normal" &&
    state.processedCameraCanvas
  ) {

    return (
      state.processedCameraCanvas
    );

  }

  return mentorVideo;

}


/* =========================================================
   DRAW CAMERA TO RECORDING
   ========================================================= */

function drawCameraToRecording(
  context
) {

  if (
    !state.cameraEnabled ||
    !mentorVideo ||
    mentorVideo.readyState < 2
  ) {

    return;

  }


  const boardRect =
    board.getBoundingClientRect();

  const recordWidth =
    state.recordCanvas.width;

  const recordHeight =
    state.recordCanvas.height;


  const scaleX =
    recordWidth /
    boardRect.width;

  const scaleY =
    recordHeight /
    boardRect.height;


  let x =
    state.cameraX *
    scaleX;

  let y =
    state.cameraY *
    scaleY;

  let width =
    state.cameraWidth *
    scaleX;

  let height =
    state.cameraHeight *
    scaleY;


  const source =
    getCameraRecordingSource();


  context.save();


  /* -----------------------------------------------
     SHADOW
     ----------------------------------------------- */

  if (
    state.cameraShadow
  ) {

    context.shadowColor =
      "rgba(0,0,0,0.28)";

    context.shadowBlur =
      24;

    context.shadowOffsetY =
      8;

  }


  /* -----------------------------------------------
     SHAPE CLIP
     ----------------------------------------------- */

  context.beginPath();


  if (
    state.cameraShape ===
    "circle"
  ) {

    const radius =
      Math.min(
        width,
        height
      ) / 2;

    context.arc(
      x + width / 2,
      y + height / 2,
      radius,
      0,
      Math.PI * 2
    );

  }

  else if (
    state.cameraShape ===
    "rounded"
  ) {

    const radius =
      Math.min(
        24,
        width / 8,
        height / 8
      );

    roundedRectPath(
      context,
      x,
      y,
      width,
      height,
      radius
    );

  }

  else {

    context.rect(
      x,
      y,
      width,
      height
    );

  }


  context.clip();


  /* -----------------------------------------------
     MIRROR
     ----------------------------------------------- */

  if (
    state.cameraMirrored
  ) {

    context.translate(
      x + width,
      y
    );

    context.scale(
      -1,
      1
    );

    context.drawImage(
      source,
      0,
      0,
      width,
      height
    );

  }

  else {

    context.drawImage(
      source,
      x,
      y,
      width,
      height
    );

  }


  context.restore();


  /* -----------------------------------------------
     FRAME
     ----------------------------------------------- */

  context.save();

  context.shadowColor =
    "transparent";

  context.shadowBlur =
    0;

  context.lineWidth =
    state.cameraShape ===
    "circle"
      ? 5
      : 4;

  context.strokeStyle =
    "rgba(255,255,255,0.95)";


  context.beginPath();


  if (
    state.cameraShape ===
    "circle"
  ) {

    const radius =
      Math.min(
        width,
        height
      ) / 2;

    context.arc(
      x + width / 2,
      y + height / 2,
      radius - 2,
      0,
      Math.PI * 2
    );

  }

  else if (
    state.cameraShape ===
    "rounded"
  ) {

    roundedRectPath(
      context,
      x + 2,
      y + 2,
      width - 4,
      height - 4,
      22
    );

  }

  else {

    context.rect(
      x + 2,
      y + 2,
      width - 4,
      height - 4
    );

  }


  context.stroke();

  context.restore();

}


/* =========================================================
   ROUNDED RECT PATH
   ========================================================= */

function roundedRectPath(
  context,
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

  context.moveTo(
    x + r,
    y
  );

  context.arcTo(
    x + width,
    y,
    x + width,
    y + height,
    r
  );

  context.arcTo(
    x + width,
    y + height,
    x,
    y + height,
    r
  );

  context.arcTo(
    x,
    y + height,
    x,
    y,
    r
  );

  context.arcTo(
    x,
    y,
    x + width,
    y,
    r
  );

}


/* =========================================================
   RECORDING MIME
   ========================================================= */

function getSupportedMime() {

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
   MICROPHONE
   ========================================================= */

async function startMicrophone() {

  if (
    state.microphoneStream
  ) {

    return;

  }

  if (
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia
  ) {

    showToast(
      "Microphone is not supported."
    );

    return;

  }


  try {

    state.microphoneStream =
      await navigator.mediaDevices.getUserMedia({

        audio: {

          echoCancellation:
            true,

          noiseSuppression:
            true,

          autoGainControl:
            true

        },

        video: false

      });

  } catch (error) {

    console.error(
      "Microphone error:",
      error
    );

    showToast(
      "Microphone permission was denied."
    );

  }

}


/* =========================================================
   STOP MICROPHONE
   ========================================================= */

function stopMicrophone() {

  if (
    state.microphoneStream
  ) {

    state.microphoneStream
      .getTracks()
      .forEach(
        track =>
          track.stop()
      );

  }

  state.microphoneStream =
    null;

}


/* =========================================================
   START RECORDING
   ========================================================= */

async function startRecording() {

  if (
    state.recording
  ) {

    return;

  }


  createRecordingCanvas();

  await startMicrophone();


  const canvasStream =
    state.recordCanvas.captureStream(
      30
    );


  state.recordStream =
    new MediaStream();


  canvasStream
    .getVideoTracks()
    .forEach(
      track =>
        state.recordStream.addTrack(
          track
        )
    );


  if (
    state.microphoneStream
  ) {

    state.microphoneStream
      .getAudioTracks()
      .forEach(
        track =>
          state.recordStream.addTrack(
            track
          )
      );

  }


  const mime =
    getSupportedMime();

  state.recordingMime =
    mime;


  try {

    state.mediaRecorder =
      mime
        ? new MediaRecorder(
            state.recordStream,
            {
              mimeType: mime
            }
          )
        : new MediaRecorder(
            state.recordStream
          );

  } catch (error) {

    console.error(
      "MediaRecorder error:",
      error
    );

    showToast(
      "This browser cannot record the board."
    );

    stopMicrophone();

    return;

  }


  state.recordedChunks =
    [];

  state.recordingBlob =
    null;


  state.mediaRecorder.ondataavailable =
    (event) => {

      if (
        event.data &&
        event.data.size > 0
      ) {

        state.recordedChunks.push(
          event.data
        );

      }

    };


  state.mediaRecorder.onstop =
    finalizeRecording;


  state.mediaRecorder.onerror =
    (event) => {

      console.error(
        "Recording error:",
        event
      );

      showToast(
        "Recording error occurred."
      );

    };


  state.mediaRecorder.start(
    1000
  );


  state.recording =
    true;

  state.paused =
    false;

  state.recordingStartTime =
    performance.now();

  state.recordingElapsedBeforePause =
    0;


  updateRecordingButtons();

  updateRecordingStatus();

  startRecordingTimer();

  startRecordingRenderLoop();

  showToast(
    "Class recording started."
  );

}


/* =========================================================
   RECORDING RENDER LOOP
   ========================================================= */

function startRecordingRenderLoop() {

  if (
    state.animationFrame
  ) {

    cancelAnimationFrame(
      state.animationFrame
    );

  }


  function frame() {

    if (
      !state.recording
    ) {

      return;

    }


    if (
      !state.paused
    ) {

      drawBoardToRecording(
        state.recordCtx
      );

    }


    state.animationFrame =
      requestAnimationFrame(
        frame
      );

  }


  frame();

}


/* =========================================================
   PAUSE RECORDING
   ========================================================= */

function pauseRecording() {

  if (
    !state.recording ||
    state.paused
  ) {

    return;

  }

  if (
    state.mediaRecorder &&
    state.mediaRecorder.state ===
      "recording"
  ) {

    state.mediaRecorder.pause();

  }


  state.recordingElapsedBeforePause +=
    performance.now() -
    state.recordingStartTime;


  state.paused =
    true;

  updateRecordingButtons();

  updateRecordingStatus();

}


/* =========================================================
   RESUME RECORDING
   ========================================================= */

function resumeRecording() {

  if (
    !state.recording ||
    !state.paused
  ) {

    return;

  }


  if (
    state.mediaRecorder &&
    state.mediaRecorder.state ===
      "paused"
  ) {

    state.mediaRecorder.resume();

  }


  state.recordingStartTime =
    performance.now();

  state.paused =
    false;

  updateRecordingButtons();

  updateRecordingStatus();

}


/* =========================================================
   STOP RECORDING
   ========================================================= */

function stopRecording() {

  if (
    !state.recording
  ) {

    return;

  }


  if (
    state.mediaRecorder &&
    state.mediaRecorder.state !==
      "inactive"
  ) {

    state.mediaRecorder.stop();

  }

  else {

    finalizeRecording();

  }

}


/* =========================================================
   FINALIZE RECORDING
   ========================================================= */

function finalizeRecording() {

  state.recording =
    false;

  state.paused =
    false;


  if (
    state.animationFrame
  ) {

    cancelAnimationFrame(
      state.animationFrame
    );

    state.animationFrame =
      null;

  }


  stopRecordingTimer();


  stopMicrophone();


  if (
    state.recordStream
  ) {

    state.recordStream
      .getTracks()
      .forEach(
        track =>
          track.stop()
      );

  }


  const mime =
    state.recordingMime ||
    "video/webm";


  state.recordingBlob =
    new Blob(
      state.recordedChunks,
      {
        type: mime
      }
    );


  if (
    state.recordingUrl
  ) {

    URL.revokeObjectURL(
      state.recordingUrl
    );

  }


  state.recordingUrl =
    URL.createObjectURL(
      state.recordingBlob
    );


  if (
    recordingPreview
  ) {

    recordingPreview.src =
      state.recordingUrl;

  }


  updateRecordingButtons();

  updateRecordingStatus();


  if (
    recordingModal
  ) {

    recordingModal.classList.add(
      "show"
    );

  }


  showToast(
    "Class recording is ready."
  );

}


/* =========================================================
   RECORDING TIMER
   ========================================================= */

function startRecordingTimer() {

  stopRecordingTimer();

  state.timerInterval =
    setInterval(
      updateRecordingTimer,
      250
    );

  updateRecordingTimer();

}


function stopRecordingTimer() {

  if (
    state.timerInterval
  ) {

    clearInterval(
      state.timerInterval
    );

    state.timerInterval =
      null;

  }

}


function updateRecordingTimer() {

  if (
    !recordTimer
  ) {
    return;
  }


  let elapsed =
    state.recordingElapsedBeforePause;


  if (
    state.recording &&
    !state.paused
  ) {

    elapsed +=
      performance.now() -
      state.recordingStartTime;

  }


  const seconds =
    Math.floor(
      elapsed / 1000
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


  recordTimer.textContent =
    [
      String(hours).padStart(
        2,
        "0"
      ),

      String(minutes).padStart(
        2,
        "0"
      ),

      String(secs).padStart(
        2,
        "0"
      )

    ].join(":");

}


/* =========================================================
   RECORDING UI
   ========================================================= */

function updateRecordingButtons() {

  const startBtn =
    document.querySelector(
      '[data-action="startRecording"]'
    );

  const pauseBtn =
    document.querySelector(
      '[data-action="pauseRecording"]'
    );

  const resumeBtn =
    document.querySelector(
      '[data-action="resumeRecording"]'
    );

  const stopBtn =
    document.querySelector(
      '[data-action="stopRecording"]'
    );


  if (startBtn) {

    startBtn.disabled =
      state.recording;

  }


  if (pauseBtn) {

    pauseBtn.disabled =
      !state.recording ||
      state.paused;

  }


  if (resumeBtn) {

    resumeBtn.disabled =
      !state.recording ||
      !state.paused;

  }


  if (stopBtn) {

    stopBtn.disabled =
      !state.recording;

  }


  const topRecord =
    document.querySelector(
      ".record-button"
    );


  if (topRecord) {

    topRecord.disabled =
      state.recording;

  }

}


/* =========================================================
   RECORDING STATUS
   ========================================================= */

function updateRecordingStatus() {

  if (
    recordingLight
  ) {

    recordingLight.classList.toggle(
      "active",
      state.recording &&
      !state.paused
    );

  }

}


/* =========================================================
   DOWNLOAD RECORDING
   ========================================================= */

downloadRecording?.addEventListener(
  "click",
  () => {

    if (
      !state.recordingBlob ||
      !state.recordingUrl
    ) {

      showToast(
        "No recording available."
      );

      return;

    }


    const link =
      document.createElement(
        "a"
      );

    link.href =
      state.recordingUrl;

    link.download =
      `SNK-Smart-Board-${formatFileDate()}.webm`;

    document.body.appendChild(
      link
    );

    link.click();

    link.remove();


    showToast(
      "Recording download started."
    );

  }
);


/* =========================================================
   RECORDING MODAL CLOSE
   ========================================================= */

document
  .querySelector(
    ".modal-close"
  )
  ?.addEventListener(
    "click",
    () => {

      recordingModal?.classList.remove(
        "show"
      );

    }
  );


recordingModal?.addEventListener(
  "click",
  (event) => {

    if (
      event.target ===
      recordingModal
    ) {

      recordingModal.classList.remove(
        "show"
      );

    }

  }
);


/* =========================================================
   SAVE COMPOSITE PNG
   ========================================================= */

function saveCompositeImage() {

  createRecordingCanvas();

  drawBoardToRecording(
    state.recordCtx
  );


  state.recordCanvas.toBlob(
    (blob) => {

      if (!blob) {

        showToast(
          "Could not create image."
        );

        return;

      }


      const url =
        URL.createObjectURL(
          blob
        );

      const link =
        document.createElement(
          "a"
        );

      link.href =
        url;

      link.download =
        `SNK-Smart-Board-${formatFileDate()}.png`;

      document.body.appendChild(
        link
      );

      link.click();

      link.remove();

      URL.revokeObjectURL(
        url
      );


      showToast(
        "Board saved as PNG."
      );

    },
    "image/png"
  );

}


/* =========================================================
   DATE FORMAT
   ========================================================= */

function formatFileDate() {

  const now =
    new Date();

  return [

    now.getFullYear(),

    String(
      now.getMonth() + 1
    ).padStart(
      2,
      "0"
    ),

    String(
      now.getDate()
    ).padStart(
      2,
      "0"
    ),

    "-",

    String(
      now.getHours()
    ).padStart(
      2,
      "0"
    ),

    String(
      now.getMinutes()
    ).padStart(
      2,
      "0"
    ),

    String(
      now.getSeconds()
    ).padStart(
      2,
      "0"
    )

  ].join("");

}


/* =========================================================
   FULLSCREEN
   ========================================================= */

async function toggleFullscreen() {

  try {

    if (
      !document.fullscreenElement
    ) {

      await document.documentElement
        .requestFullscreen();

    }

    else {

      await document.exitFullscreen();

    }

  } catch (error) {

    console.warn(
      "Fullscreen error:",
      error
    );

    showToast(
      "Fullscreen is not available."
    );

  }

}


/* =========================================================
   BUTTON ACTION SYSTEM
   ========================================================= */

$$("[data-action]")
  .forEach((button) => {

    button.addEventListener(
      "click",
      async () => {

        const action =
          button.dataset.action;


        switch (action) {

          case "undo":
            undo();
            break;


          case "redo":
            redo();
            break;


          case "clear":
            clearBoard();
            break;


          case "save":
            saveCompositeImage();
            break;


          case "fullscreen":
            toggleFullscreen();
            break;


          case "image":
            openImagePicker();
            break;


          case "pdf":
            openPdfPicker();
            break;


          case "previousPdf":
            await previousPdfPage();
            break;


          case "nextPdf":
            await nextPdfPage();
            break;


          case "previousPage":
            previousPage();
            break;


          case "nextPage":
            nextPage();
            break;


          case "addPage":
            addPage();
            break;


          case "zoomIn":
            zoomIn();
            break;


          case "zoomOut":
            zoomOut();
            break;


          case "cameraToggle":
            toggleCamera();
            break;


          case "cameraMirror":
            toggleCameraMirror();
            break;


          case "cameraCenter":
            centerCamera();
            break;


          case "cameraShadow":
            toggleCameraShadow();
            break;


          case "microphone":

            if (
              state.microphoneStream
            ) {

              stopMicrophone();

              showToast(
                "Microphone turned off."
              );

            }

            else {

              await startMicrophone();

              if (
                state.microphoneStream
              ) {

                showToast(
                  "Microphone turned on."
                );

              }

            }

            break;


          case "startRecording":
            await startRecording();
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


          case "back":
            history.back();
            break;


          default:

            console.warn(
              "Unknown Smart Board action:",
              action
            );

        }

      }
    );

  });


/* =========================================================
   CAMERA TOGGLE BUTTON TEXT
   ========================================================= */

function updateCameraButton() {

  const button =
    document.querySelector(
      "[data-camera-toggle]"
    );

  if (!button) {
    return;
  }

  button.textContent =
    state.cameraEnabled
      ? "Camera Off"
      : "Camera On";

  button.classList.toggle(
    "primary",
    !state.cameraEnabled
  );

}


/* =========================================================
   CAMERA STATE WATCHER
   ========================================================= */

setInterval(
  updateCameraButton,
  500
);


/* =========================================================
   KEYBOARD SHORTCUTS
   ========================================================= */

document.addEventListener(
  "keydown",
  (event) => {

    const tag =
      event.target?.tagName;

    if (
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      tag === "SELECT"
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
        recordingModal
      ) {

        recordingModal.classList.remove(
          "show"
        );

      }

    }

  }
);


/* =========================================================
   BEFORE UNLOAD
   ========================================================= */

window.addEventListener(
  "beforeunload",
  () => {

    if (
      state.cameraStream
    ) {

      state.cameraStream
        .getTracks()
        .forEach(
          track =>
            track.stop()
        );

    }


    if (
      state.microphoneStream
    ) {

      state.microphoneStream
        .getTracks()
        .forEach(
          track =>
            track.stop()
        );

    }


    if (
      state.recordStream
    ) {

      state.recordStream
        .getTracks()
        .forEach(
          track =>
            track.stop()
        );

    }


    if (
      state.recordingUrl
    ) {

      URL.revokeObjectURL(
        state.recordingUrl
      );

    }

  }
);


/* =========================================================
   INITIALIZE
   ========================================================= */

function initializeSmartBoard() {

  resizeDrawingCanvas();

  updatePageIndicator();

  updatePdfStatus();

  setZoom(1);

  updateCameraButton();

  updateRecordingButtons();

  updateRecordingStatus();

  updateCameraBoxPosition();


  if (cameraEffect) {

    state.cameraEffect =
      cameraEffect.value ||
      "normal";

  }


  applyCameraAppearance();


  /*
   * Prepare camera segmentation.
   * If MediaPipe is loaded later, it will
   * become available automatically.
   */

  initializeSegmentation();


  console.log(
    "SNK Smart Board initialized."
  );

}


if (
  document.readyState ===
  "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    initializeSmartBoard
  );

}

else {

  initializeSmartBoard();

}


/* =========================================================
   PUBLIC API
   ========================================================= */

window.SNKSmartBoard = {

  state,

  startCamera,

  stopCamera,

  toggleCamera,

  toggleCameraMirror,

  centerCamera,

  startRecording,

  pauseRecording,

  resumeRecording,

  stopRecording,

  undo,

  redo,

  clearBoard,

  newBoard,

  addPage,

  nextPage,

  previousPage,

  nextPdfPage,

  previousPdfPage,

  zoomIn,

  zoomOut,

  saveCompositeImage,

  showToast

};


/* =========================================================
   END
   ========================================================= */
