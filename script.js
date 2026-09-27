/* =========================================================
   SNK SMART BOARD
   STEP 7.1
   BOARD + MICROPHONE RECORDING
========================================================= */


/* =========================================================
   PDF.JS
========================================================= */

import {
  getDocument,
  GlobalWorkerOptions
} from
"https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/build/pdf.mjs";


GlobalWorkerOptions.workerSrc =
"https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/build/pdf.worker.min.mjs";


/* =========================================================
   ELEMENTS
========================================================= */

const board =
  document.getElementById("board");

const drawingCanvas =
  document.getElementById("drawingCanvas");

const drawingCtx =
  drawingCanvas.getContext("2d");

const slideCanvas =
  document.getElementById("slideCanvas");

const slideCtx =
  slideCanvas.getContext("2d");

const slideEmpty =
  document.getElementById("slideEmpty");

const slideControls =
  document.getElementById("slideControls");

const textLayer =
  document.getElementById("textLayer");

const pagesList =
  document.getElementById("pagesList");

const notesInput =
  document.getElementById("notesInput");

const toast =
  document.getElementById("toast");

const boardStatus =
  document.getElementById("boardStatus");

const zoomLabel =
  document.getElementById("zoomLabel");

const slideZoomLabel =
  document.getElementById("slideZoomLabel");

const colorPicker =
  document.getElementById("colorPicker");

const colorValue =
  document.getElementById("colorValue");

const sizeSlider =
  document.getElementById("sizeSlider");

const sizeValue =
  document.getElementById("sizeValue");

const imageInput =
  document.getElementById("imageInput");

const pdfInput =
  document.getElementById("pdfInput");


/* =========================================================
   BUTTONS
========================================================= */

const penBtn =
  document.getElementById("penBtn");

const markerBtn =
  document.getElementById("markerBtn");

const eraserBtn =
  document.getElementById("eraserBtn");

const undoBtn =
  document.getElementById("undoBtn");

const redoBtn =
  document.getElementById("redoBtn");

const clearBtn =
  document.getElementById("clearBtn");

const textBtn =
  document.getElementById("textBtn");

const imageBtn =
  document.getElementById("imageBtn");

const pdfBtn =
  document.getElementById("pdfBtn");

const uploadSlideBtn =
  document.getElementById("uploadSlideBtn");

const previousSlideBtn =
  document.getElementById("previousSlideBtn");

const nextSlideBtn =
  document.getElementById("nextSlideBtn");

const closeSlideBtn =
  document.getElementById("closeSlideBtn");

const slideZoomInBtn =
  document.getElementById("slideZoomInBtn");

const slideZoomOutBtn =
  document.getElementById("slideZoomOutBtn");

const slideNumberInput =
  document.getElementById("slideNumberInput");

const slideTotal =
  document.getElementById("slideTotal");

const zoomInBtn =
  document.getElementById("zoomInBtn");

const zoomOutBtn =
  document.getElementById("zoomOutBtn");

const fitSlideBtn =
  document.getElementById("fitSlideBtn");

const saveBtn =
  document.getElementById("saveBtn");

const newBoardBtn =
  document.getElementById("newBoardBtn");

const fullscreenBtn =
  document.getElementById("fullscreenBtn");

const addPageBtn =
  document.getElementById("addPageBtn");


/* =========================================================
   RECORDING ELEMENTS
========================================================= */

const recordBtn =
  document.getElementById("recordBtn");

const recordBtnText =
  document.getElementById("recordBtnText");

const startRecordBtn =
  document.getElementById("startRecordBtn");

const pauseRecordBtn =
  document.getElementById("pauseRecordBtn");

const stopRecordBtn =
  document.getElementById("stopRecordBtn");

const recordingOverlay =
  document.getElementById("recordingOverlay");

const recordingTimer =
  document.getElementById("recordingTimer");

const recordingBigTimer =
  document.getElementById("recordingBigTimer");

const recordingMainStatus =
  document.getElementById(
    "recordingMainStatus"
  );

const micBtn =
  document.getElementById("micBtn");

const micBtnText =
  document.getElementById("micBtnText");

const audioDot =
  document.getElementById("audioDot");

const audioStatusText =
  document.getElementById(
    "audioStatusText"
  );


/* =========================================================
   DRAWING STATE
========================================================= */

let currentTool = "pen";

let currentColor =
  colorPicker.value;

let currentSize =
  Number(sizeSlider.value);

let isDrawing = false;

let lastX = 0;
let lastY = 0;

let history = [];
let redoHistory = [];


/* =========================================================
   SLIDE STATE
========================================================= */

let slideType = null;

let slideImage = null;

let slideZoom = 1;

let globalZoom = 1;

let pdfDocument = null;

let pdfPageCache =
  new Map();

let currentSlidePage = 1;

let totalSlides = 0;

let isRenderingSlide = false;


/* =========================================================
   PAGE STATE
========================================================= */

let pages = [];

let currentPageIndex = 0;


/* =========================================================
   TEXT STATE
========================================================= */

let currentTextMode = false;


/* =========================================================
   RECORDING STATE
========================================================= */

let mediaRecorder = null;

let recordedChunks = [];

let recordingCanvas = null;

let recordingCtx = null;

let recordingStream = null;

let microphoneStream = null;

let microphoneEnabled = true;

let recordingState = "idle";

let recordingStartTime = 0;

let recordingPausedAt = 0;

let recordingPausedTotal = 0;

let recordingTimerInterval = null;

let recordingAnimationFrame = null;


/* =========================================================
   CREATE PAGE
========================================================= */

function createPage() {

  return {

    name:
      `Page ${pages.length + 1}`,

    drawingData:
      null,

    slideType:
      null,

    slideData:
      null,

    slideName:
      "",

    slidePage:
      1,

    slideTotal:
      0,

    notes:
      "",

    textItems:
      []

  };

}


/* =========================================================
   INITIAL PAGE
========================================================= */

pages.push(
  createPage()
);

renderPages();


/* =========================================================
   TOAST
========================================================= */

let toastTimer = null;

function showToast(message) {

  toast.textContent =
    message;

  toast.classList.add(
    "show"
  );

  clearTimeout(
    toastTimer
  );

  toastTimer =
    setTimeout(
      () => {

        toast.classList.remove(
          "show"
        );

      },
      1800
    );

}


/* =========================================================
   STATUS
========================================================= */

function setStatus(text) {

  boardStatus.textContent =
    text;

}


/* =========================================================
   TOOL
========================================================= */

function setTool(tool) {

  currentTool =
    tool;

  document
    .querySelectorAll(".tool-btn")
    .forEach(
      btn => {

        btn.classList.remove(
          "active"
        );

      }
    );


  if (tool === "pen") {

    penBtn.classList.add(
      "active"
    );

  }


  if (tool === "marker") {

    markerBtn.classList.add(
      "active"
    );

  }


  if (tool === "eraser") {

    eraserBtn.classList.add(
      "active"
    );

  }


  if (tool === "eraser") {

    drawingCanvas.style.cursor =
      "cell";

  } else {

    drawingCanvas.style.cursor =
      "crosshair";

  }

}


penBtn.addEventListener(
  "click",
  () => setTool("pen")
);


markerBtn.addEventListener(
  "click",
  () => setTool("marker")
);


eraserBtn.addEventListener(
  "click",
  () => setTool("eraser")
);


/* =========================================================
   COLOR
========================================================= */

colorPicker.addEventListener(
  "input",
  () => {

    currentColor =
      colorPicker.value;

    colorValue.textContent =
      currentColor.toUpperCase();

  }
);


/* =========================================================
   SIZE
========================================================= */

sizeSlider.addEventListener(
  "input",
  () => {

    currentSize =
      Number(
        sizeSlider.value
      );

    sizeValue.textContent =
      currentSize;

  }
);


/* =========================================================
   CANVAS POSITION
========================================================= */

function getPointerPosition(event) {

  const rect =
    drawingCanvas
      .getBoundingClientRect();

  const scaleX =
    drawingCanvas.width /
    rect.width;

  const scaleY =
    drawingCanvas.height /
    rect.height;

  return {

    x:
      (event.clientX -
        rect.left) *
      scaleX,

    y:
      (event.clientY -
        rect.top) *
      scaleY

  };

}


/* =========================================================
   DRAW START
========================================================= */

drawingCanvas.addEventListener(
  "pointerdown",
  event => {

    if (
      currentTextMode ||
      recordingState === "finalizing"
    ) {

      return;

    }

    isDrawing =
      true;

    drawingCanvas.setPointerCapture(
      event.pointerId
    );

    const pos =
      getPointerPosition(
        event
      );

    lastX =
      pos.x;

    lastY =
      pos.y;

    drawingCtx.beginPath();

    drawingCtx.moveTo(
      lastX,
      lastY
    );

    drawingCtx.lineCap =
      "round";

    drawingCtx.lineJoin =
      "round";


    if (
      currentTool ===
      "eraser"
    ) {

      drawingCtx.globalCompositeOperation =
        "destination-out";

      drawingCtx.globalAlpha =
        1;

      drawingCtx.lineWidth =
        currentSize * 3;

    } else {

      drawingCtx.globalCompositeOperation =
        "source-over";

      drawingCtx.strokeStyle =
        currentColor;


      if (
        currentTool ===
        "marker"
      ) {

        drawingCtx.globalAlpha =
          .28;

        drawingCtx.lineWidth =
          currentSize * 3;

      } else {

        drawingCtx.globalAlpha =
          1;

        drawingCtx.lineWidth =
          currentSize;

      }

    }


    drawingCtx.lineTo(
      lastX + .01,
      lastY + .01
    );

    drawingCtx.stroke();

  }
);


/* =========================================================
   DRAW MOVE
========================================================= */

drawingCanvas.addEventListener(
  "pointermove",
  event => {

    if (!isDrawing) {
      return;
    }

    const pos =
      getPointerPosition(
        event
      );

    drawingCtx.lineTo(
      pos.x,
      pos.y
    );

    drawingCtx.stroke();

    lastX =
      pos.x;

    lastY =
      pos.y;

  }
);


/* =========================================================
   DRAW END
========================================================= */

function stopDrawing() {

  if (!isDrawing) {
    return;
  }

  isDrawing =
    false;

  drawingCtx.closePath();

  drawingCtx.globalAlpha =
    1;

  drawingCtx.globalCompositeOperation =
    "source-over";

  savePageDrawing();

  saveHistory();

}


drawingCanvas.addEventListener(
  "pointerup",
  stopDrawing
);


drawingCanvas.addEventListener(
  "pointercancel",
  stopDrawing
);


/* =========================================================
   PAGE DRAWING
========================================================= */

function savePageDrawing() {

  pages[
    currentPageIndex
  ].drawingData =
    drawingCanvas.toDataURL(
      "image/png"
    );

}


/* =========================================================
   HISTORY
========================================================= */

function saveHistory() {

  history.push(
    drawingCanvas.toDataURL(
      "image/png"
    )
  );

  if (
    history.length > 40
  ) {

    history.shift();

  }

  redoHistory = [];

}


function restoreCanvasFromData(
  data
) {

  drawingCtx.clearRect(
    0,
    0,
    drawingCanvas.width,
    drawingCanvas.height
  );

  if (!data) {
    return;
  }

  const image =
    new Image();

  image.onload =
    () => {

      drawingCtx.drawImage(
        image,
        0,
        0,
        drawingCanvas.width,
        drawingCanvas.height
      );

    };

  image.src =
    data;

}


/* =========================================================
   UNDO
========================================================= */

undoBtn.addEventListener(
  "click",
  () => {

    if (
      history.length <= 1
    ) {

      showToast(
        "Nothing to undo"
      );

      return;

    }

    const current =
      history.pop();

    redoHistory.push(
      current
    );

    const previous =
      history[
        history.length - 1
      ];

    restoreCanvasFromData(
      previous
    );

    pages[
      currentPageIndex
    ].drawingData =
      previous;

  }
);


/* =========================================================
   REDO
========================================================= */

redoBtn.addEventListener(
  "click",
  () => {

    if (
      !redoHistory.length
    ) {

      showToast(
        "Nothing to redo"
      );

      return;

    }

    const next =
      redoHistory.pop();

    history.push(
      next
    );

    restoreCanvasFromData(
      next
    );

    pages[
      currentPageIndex
    ].drawingData =
      next;

  }
);


/* =========================================================
   CLEAR
========================================================= */

clearBtn.addEventListener(
  "click",
  () => {

    if (
      !confirm(
        "Clear all drawing from this page?"
      )
    ) {

      return;

    }

    drawingCtx.clearRect(
      0,
      0,
      drawingCanvas.width,
      drawingCanvas.height
    );

    pages[
      currentPageIndex
    ].drawingData =
      null;

    saveHistory();

    showToast(
      "Drawing cleared"
    );

  }
);


/* =========================================================
   RESIZE
========================================================= */

function resizeCanvas() {

  const rect =
    board.getBoundingClientRect();

  if (
    rect.width <= 0 ||
    rect.height <= 0
  ) {

    return;

  }

  const oldData =
    pages[
      currentPageIndex
    ]?.drawingData;

  const dpr =
    Math.min(
      window.devicePixelRatio || 1,
      2
    );

  drawingCanvas.width =
    Math.floor(
      rect.width * dpr
    );

  drawingCanvas.height =
    Math.floor(
      rect.height * dpr
    );

  drawingCanvas.style.width =
    rect.width + "px";

  drawingCanvas.style.height =
    rect.height + "px";

  drawingCtx.lineCap =
    "round";

  drawingCtx.lineJoin =
    "round";

  restoreCanvasFromData(
    oldData
  );

}


window.addEventListener(
  "resize",
  () => {

    resizeCanvas();

    renderCurrentPage();

  }
);


/* =========================================================
   PAGES
========================================================= */

function renderPages() {

  pagesList.innerHTML =
    "";

  pages.forEach(
    (page,index) => {

      const button =
        document.createElement(
          "button"
        );

      button.className =
        "page-thumb";

      if (
        index ===
        currentPageIndex
      ) {

        button.classList.add(
          "active"
        );

      }

      button.textContent =
        index + 1;

      button.addEventListener(
        "click",
        () => switchPage(index)
      );

      pagesList.appendChild(
        button
      );

    }
  );

}


function switchPage(index) {

  if (
    recordingState ===
    "recording" ||
    recordingState ===
    "paused"
  ) {

    showToast(
      "Stop recording before changing pages"
    );

    return;

  }

  saveCurrentPageState();

  currentPageIndex =
    index;

  history = [];
  redoHistory = [];

  renderPages();

  renderCurrentPage();

  setTimeout(
    saveHistory,
    100
  );

}


function saveCurrentPageState() {

  if (!pages[
    currentPageIndex
  ]) {

    return;

  }

  pages[
    currentPageIndex
  ].drawingData =
    drawingCanvas.toDataURL(
      "image/png"
    );

  pages[
    currentPageIndex
  ].notes =
    notesInput.value;

  pages[
    currentPageIndex
  ].textItems =
    readTextItems();

}


/* =========================================================
   ADD PAGE
========================================================= */

addPageBtn.addEventListener(
  "click",
  () => {

    if (
      recordingState !==
      "idle"
    ) {

      showToast(
        "Stop recording first"
      );

      return;

    }

    saveCurrentPageState();

    pages.push(
      createPage()
    );

    currentPageIndex =
      pages.length - 1;

    renderPages();

    renderCurrentPage();

    history = [];
    redoHistory = [];

    setTimeout(
      saveHistory,
      100
    );

  }
);


/* =========================================================
   RENDER CURRENT PAGE
========================================================= */

function renderCurrentPage() {

  const page =
    pages[
      currentPageIndex
    ];

  if (!page) {
    return;
  }

  notesInput.value =
    page.notes || "";

  restoreCanvasFromData(
    page.drawingData
  );

  renderTextItems(
    page.textItems || []
  );

  if (
    page.slideType ===
      "image" &&
    page.slideData
  ) {

    loadImageFromSavedState(
      page
    );

  } else if (
    page.slideType ===
      "pdf"
  ) {

    if (pdfDocument) {

      totalSlides =
        pdfDocument.numPages;

      currentSlidePage =
        page.slidePage || 1;

      showSlideUI();

      renderPdfPage(
        currentSlidePage
      );

    } else {

      closeSlide(
        false
      );

    }

  } else {

    closeSlide(
      false
    );

  }

}


/* =========================================================
   IMAGE
========================================================= */

imageBtn.addEventListener(
  "click",
  () => {

    imageInput.click();

  }
);


uploadSlideBtn.addEventListener(
  "click",
  () => {

    imageInput.click();

  }
);


imageInput.addEventListener(
  "change",
  event => {

    const file =
      event.target.files[0];

    if (!file) {
      return;
    }

    const reader =
      new FileReader();

    reader.onload =
      event => {

        const data =
          event.target.result;

        const image =
          new Image();

        image.onload =
          () => {

            slideImage =
              image;

            slideType =
              "image";

            currentSlidePage =
              1;

            totalSlides =
              1;

            pages[
              currentPageIndex
            ].slideType =
              "image";

            pages[
              currentPageIndex
            ].slideData =
              data;

            pages[
              currentPageIndex
            ].slideName =
              file.name;

            pages[
              currentPageIndex
            ].slidePage =
              1;

            pages[
              currentPageIndex
            ].slideTotal =
              1;

            slideTotal.textContent =
              "1";

            slideNumberInput.value =
              "1";

            showSlideUI();

            renderImageSlide();

            showToast(
              "Image slide loaded"
            );

          };

        image.src =
          data;

      };

    reader.readAsDataURL(
      file
    );

    imageInput.value =
      "";

  }
);


/* =========================================================
   LOAD SAVED IMAGE
========================================================= */

function loadImageFromSavedState(
  page
) {

  const image =
    new Image();

  image.onload =
    () => {

      slideImage =
        image;

      slideType =
        "image";

      currentSlidePage =
        1;

      totalSlides =
        1;

      slideTotal.textContent =
        "1";

      slideNumberInput.value =
        "1";

      showSlideUI();

      renderImageSlide();

    };

  image.src =
    page.slideData;

}


/* =========================================================
   IMAGE RENDER
========================================================= */

function renderImageSlide() {

  if (!slideImage) {
    return;
  }

  slideCanvas.width =
    slideImage.naturalWidth;

  slideCanvas.height =
    slideImage.naturalHeight;

  slideCtx.clearRect(
    0,
    0,
    slideCanvas.width,
    slideCanvas.height
  );

  slideCtx.drawImage(
    slideImage,
    0,
    0
  );

  applySlideDisplay();

}


/* =========================================================
   PDF BUTTON
========================================================= */

pdfBtn.addEventListener(
  "click",
  () => {

    pdfInput.click();

  }
);


/* =========================================================
   PDF INPUT
========================================================= */

pdfInput.addEventListener(
  "change",
  async event => {

    const file =
      event.target.files[0];

    if (!file) {
      return;
    }

    await loadPdfFile(
      file
    );

    pdfInput.value =
      "";

  }
);


/* =========================================================
   PDF LOAD
========================================================= */

async function loadPdfFile(
  file
) {

  try {

    setStatus(
      "Loading PDF..."
    );

    const buffer =
      await file.arrayBuffer();

    const task =
      getDocument({
        data: buffer
      });

    pdfDocument =
      await task.promise;

    pdfPageCache =
      new Map();

    currentSlidePage =
      1;

    totalSlides =
      pdfDocument.numPages;

    slideType =
      "pdf";

    pages[
      currentPageIndex
    ].slideType =
      "pdf";

    pages[
      currentPageIndex
    ].slideName =
      file.name;

    pages[
      currentPageIndex
    ].slidePage =
      1;

    pages[
      currentPageIndex
    ].slideTotal =
      totalSlides;

    slideTotal.textContent =
      totalSlides;

    slideNumberInput.value =
      "1";

    showSlideUI();

    await renderPdfPage(
      1
    );

    setStatus(
      `${file.name} • ${totalSlides} pages`
    );

    showToast(
      `PDF loaded • ${totalSlides} pages`
    );

  } catch(error) {

    console.error(
      error
    );

    showToast(
      "PDF could not be loaded"
    );

  }

}


/* =========================================================
   PDF RENDER
========================================================= */

async function renderPdfPage(
  pageNumber
) {

  if (
    !pdfDocument ||
    isRenderingSlide
  ) {

    return;

  }

  if (
    pageNumber < 1 ||
    pageNumber >
      pdfDocument.numPages
  ) {

    return;

  }

  isRenderingSlide =
    true;

  try {

    let cached =
      pdfPageCache.get(
        pageNumber
      );

    if (!cached) {

      const page =
        await pdfDocument.getPage(
          pageNumber
        );

      const viewport =
        page.getViewport({
          scale: 1.5
        });

      const canvas =
        document.createElement(
          "canvas"
        );

      const ctx =
        canvas.getContext(
          "2d"
        );

      canvas.width =
        Math.ceil(
          viewport.width
        );

      canvas.height =
        Math.ceil(
          viewport.height
        );

      await page.render({
        canvasContext: ctx,
        viewport
      }).promise;

      cached = {
        data:
          canvas.toDataURL(
            "image/png"
          ),

        width:
          canvas.width,

        height:
          canvas.height
      };

      pdfPageCache.set(
        pageNumber,
        cached
      );

    }

    const image =
      new Image();

    await new Promise(
      resolve => {

        image.onload =
          resolve;

        image.src =
          cached.data;

      }
    );

    slideCanvas.width =
      cached.width;

    slideCanvas.height =
      cached.height;

    slideCtx.clearRect(
      0,
      0,
      slideCanvas.width,
      slideCanvas.height
    );

    slideCtx.drawImage(
      image,
      0,
      0
    );

    currentSlidePage =
      pageNumber;

    pages[
      currentPageIndex
    ].slidePage =
      pageNumber;

    slideNumberInput.value =
      pageNumber;

    slideTotal.textContent =
      totalSlides;

    applySlideDisplay();

  } catch(error) {

    console.error(
      error
    );

  } finally {

    isRenderingSlide =
      false;

  }

}


/* =========================================================
   SLIDE UI
========================================================= */

function showSlideUI() {

  slideEmpty.classList.add(
    "hidden"
  );

  slideControls.classList.add(
    "visible"
  );

}


function applySlideDisplay() {

  slideCanvas.style.transform =
    `scale(${slideZoom})`;

  slideZoomLabel.textContent =
    `${Math.round(
      slideZoom * 100
    )}%`;

  zoomLabel.textContent =
    `${Math.round(
      globalZoom * 100
    )}%`;

}


/* =========================================================
   SLIDE NAVIGATION
========================================================= */

previousSlideBtn.addEventListener(
  "click",
  () => {

    if (
      recordingState !==
      "idle"
    ) {

      return;

    }

    goToSlide(
      currentSlidePage - 1
    );

  }
);


nextSlideBtn.addEventListener(
  "click",
  () => {

    if (
      recordingState !==
      "idle"
    ) {

      return;

    }

    goToSlide(
      currentSlidePage + 1
    );

  }
);


async function goToSlide(
  number
) {

  if (
    number < 1 ||
    number > totalSlides
  ) {

    return;

  }

  if (
    slideType === "pdf"
  ) {

    await renderPdfPage(
      number
    );

  }

}


/* =========================================================
   SLIDE NUMBER
========================================================= */

slideNumberInput.addEventListener(
  "change",
  () => {

    goToSlide(
      Number(
        slideNumberInput.value
      )
    );

  }
);


/* =========================================================
   SLIDE ZOOM
========================================================= */

slideZoomInBtn.addEventListener(
  "click",
  () => {

    slideZoom =
      Math.min(
        slideZoom + .1,
        2.5
      );

    applySlideDisplay();

  }
);


slideZoomOutBtn.addEventListener(
  "click",
  () => {

    slideZoom =
      Math.max(
        slideZoom - .1,
        .5
      );

    applySlideDisplay();

  }
);


/* =========================================================
   BOARD ZOOM
========================================================= */

zoomInBtn.addEventListener(
  "click",
  () => {

    globalZoom =
      Math.min(
        globalZoom + .1,
        2
      );

    board.style.transform =
      `scale(${globalZoom})`;

    applySlideDisplay();

  }
);


zoomOutBtn.addEventListener(
  "click",
  () => {

    globalZoom =
      Math.max(
        globalZoom - .1,
        .7
      );

    board.style.transform =
      `scale(${globalZoom})`;

    applySlideDisplay();

  }
);


/* =========================================================
   FIT
========================================================= */

fitSlideBtn.addEventListener(
  "click",
  () => {

    slideZoom =
      1;

    globalZoom =
      1;

    board.style.transform =
      "scale(1)";

    applySlideDisplay();

  }
);


/* =========================================================
   CLOSE SLIDE
========================================================= */

closeSlideBtn.addEventListener(
  "click",
  () => {

    if (
      recordingState !==
      "idle"
    ) {

      showToast(
        "Stop recording first"
      );

      return;

    }

    closeSlide(
      true
    );

  }
);


function closeSlide(
  notify
) {

  slideType =
    null;

  slideImage =
    null;

  totalSlides =
    0;

  currentSlidePage =
    1;

  slideCanvas.width =
    1;

  slideCanvas.height =
    1;

  slideControls.classList.remove(
    "visible"
  );

  slideEmpty.classList.remove(
    "hidden"
  );

  slideTotal.textContent =
    "0";

  slideNumberInput.value =
    "1";

  if (
    pages[currentPageIndex]
  ) {

    pages[
      currentPageIndex
    ].slideType =
      null;

    pages[
      currentPageIndex
    ].slideData =
      null;

  }

  if (notify) {

    showToast(
      "Slide closed"
    );

  }

}


/* =========================================================
   TEXT TOOL
========================================================= */

textBtn.addEventListener(
  "click",
  () => {

    currentTextMode =
      !currentTextMode;

    textBtn.classList.toggle(
      "active",
      currentTextMode
    );

    drawingCanvas.style.pointerEvents =
      currentTextMode
        ? "none"
        : "auto";

    board.style.cursor =
      currentTextMode
        ? "text"
        : "default";

  }
);


board.addEventListener(
  "click",
  event => {

    if (
      !currentTextMode
    ) {

      return;

    }

    if (
      event.target.closest(
        ".slide-controls"
      )
    ) {

      return;

    }

    const rect =
      board.getBoundingClientRect();

    createTextItem(
      event.clientX -
        rect.left,

      event.clientY -
        rect.top
    );

  }
);


function createTextItem(
  x,
  y,
  value = "Type here..."
) {

  const item =
    document.createElement(
      "div"
    );

  item.className =
    "text-item";

  item.contentEditable =
    "true";

  item.textContent =
    value;

  item.style.left =
    `${x}px`;

  item.style.top =
    `${y}px`;

  textLayer.appendChild(
    item
  );

  item.focus();

  item.addEventListener(
    "input",
    savePageText
  );

  item.addEventListener(
    "blur",
    savePageText
  );

  enableTextDragging(
    item
  );

}


function enableTextDragging(
  item
) {

  let dragging =
    false;

  let offsetX = 0;

  let offsetY = 0;

  item.addEventListener(
    "pointerdown",
    event => {

      dragging =
        true;

      const rect =
        item.getBoundingClientRect();

      offsetX =
        event.clientX -
        rect.left;

      offsetY =
        event.clientY -
        rect.top;

      item.setPointerCapture(
        event.pointerId
      );

    }
  );


  item.addEventListener(
    "pointermove",
    event => {

      if (!dragging) {
        return;
      }

      const boardRect =
        board.getBoundingClientRect();

      item.style.left =
        `${Math.max(
          0,
          event.clientX -
            boardRect.left -
            offsetX
        )}px`;

      item.style.top =
        `${Math.max(
          0,
          event.clientY -
            boardRect.top -
            offsetY
        )}px`;

    }
  );


  item.addEventListener(
    "pointerup",
    () => {

      dragging =
        false;

      savePageText();

    }
  );

}


function savePageText() {

  pages[
    currentPageIndex
  ].textItems =
    readTextItems();

}


function readTextItems() {

  return [
    ...textLayer.querySelectorAll(
      ".text-item"
    )
  ].map(
    item => ({

      text:
        item.textContent,

      left:
        parseFloat(
          item.style.left
        ) || 0,

      top:
        parseFloat(
          item.style.top
        ) || 0

    })
  );

}


function renderTextItems(
  items
) {

  textLayer.innerHTML =
    "";

  items.forEach(
    item => {

      createTextItem(
        item.left,
        item.top,
        item.text
      );

    }
  );

}


/* =========================================================
   SAVE PNG
========================================================= */

saveBtn.addEventListener(
  "click",
  saveComposite
);


async function saveComposite() {

  saveCurrentPageState();

  const width =
    drawingCanvas.width;

  const height =
    drawingCanvas.height;

  const output =
    document.createElement(
      "canvas"
    );

  output.width =
    width;

  output.height =
    height;

  const ctx =
    output.getContext(
      "2d"
    );


  ctx.fillStyle =
    "#ffffff";

  ctx.fillRect(
    0,
    0,
    width,
    height
  );


  if (
    slideCanvas.width > 1 &&
    slideCanvas.height > 1
  ) {

    const ratio =
      Math.min(
        width /
          slideCanvas.width,

        height /
          slideCanvas.height
      );

    const w =
      slideCanvas.width *
      ratio;

    const h =
      slideCanvas.height *
      ratio;

    ctx.drawImage(
      slideCanvas,
      (width - w) / 2,
      (height - h) / 2,
      w,
      h
    );

  }


  ctx.drawImage(
    drawingCanvas,
    0,
    0,
    width,
    height
  );


  const boardRect =
    board.getBoundingClientRect();

  const sx =
    width /
    boardRect.width;

  const sy =
    height /
    boardRect.height;


  ctx.fillStyle =
    "#172033";

  ctx.textBaseline =
    "top";


  readTextItems().forEach(
    item => {

      ctx.font =
        `600 ${
          28 *
          Math.min(
            sx,
            sy
          )
        }px Arial`;

      ctx.fillText(
        item.text,
        item.left * sx,
        item.top * sy
      );

    }
  );


  const link =
    document.createElement(
      "a"
    );

  link.download =
    `SNK-Smart-Board-Page-${
      currentPageIndex + 1
    }.png`;

  link.href =
    output.toDataURL(
      "image/png"
    );

  link.click();

  showToast(
    "Board saved as PNG"
  );

}


/* =========================================================
   MICROPHONE
========================================================= */

async function requestMicrophone() {

  if (
    microphoneStream &&
    microphoneStream.active
  ) {

    return true;

  }

  if (
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia
  ) {

    showToast(
      "Microphone is not supported"
    );

    return false;

  }

  try {

    microphoneStream =
      await navigator.mediaDevices
        .getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });

    microphoneEnabled =
      true;

    micBtn.classList.add(
      "active"
    );

    micBtnText.textContent =
      "Mic On";

    audioDot.classList.add(
      "active"
    );

    audioStatusText.textContent =
      "Microphone ready";

    return true;

  } catch(error) {

    console.error(
      error
    );

    microphoneEnabled =
      false;

    micBtn.classList.remove(
      "active"
    );

    micBtnText.textContent =
      "Mic Off";

    audioStatusText.textContent =
      "Microphone permission denied";

    showToast(
      "Allow microphone permission"
    );

    return false;

  }

}


/* =========================================================
   MICROPHONE BUTTON
========================================================= */

micBtn.addEventListener(
  "click",
  async () => {

    if (
      microphoneEnabled
    ) {

      microphoneEnabled =
        false;

      if (
        microphoneStream
      ) {

        microphoneStream
          .getAudioTracks()
          .forEach(
            track => {
              track.enabled =
                false;
            }
          );

      }

      micBtn.classList.remove(
        "active"
      );

      micBtnText.textContent =
        "Mic Off";

      audioDot.classList.remove(
        "active"
      );

      audioStatusText.textContent =
        "Microphone muted";

      showToast(
        "Microphone muted"
      );

    } else {

      const success =
        await requestMicrophone();

      if (success) {

        if (
          microphoneStream
        ) {

          microphoneStream
            .getAudioTracks()
            .forEach(
              track => {
                track.enabled =
                  true;
              }
            );

        }

        microphoneEnabled =
          true;

      }

    }

  }
);


/* =========================================================
   RECORDING CANVAS
========================================================= */

function createRecordingCanvas() {

  recordingCanvas =
    document.createElement(
      "canvas"
    );

  /*
    1280 × 720 gives a good
    teaching-video format.
  */

  recordingCanvas.width =
    1280;

  recordingCanvas.height =
    720;

  recordingCtx =
    recordingCanvas.getContext(
      "2d"
    );

}


/* =========================================================
   DRAW TEXT TO RECORDING
========================================================= */

function drawTextToRecording() {

  const boardRect =
    board.getBoundingClientRect();

  const scaleX =
    1280 /
    boardRect.width;

  const scaleY =
    720 /
    boardRect.height;

  recordingCtx.fillStyle =
    "#172033";

  recordingCtx.textBaseline =
    "top";


  readTextItems().forEach(
    item => {

      recordingCtx.font =
        `600 ${
          28 *
          Math.min(
            scaleX,
            scaleY
          )
        }px Arial`;

      recordingCtx.fillText(
        item.text,
        item.left * scaleX,
        item.top * scaleY
      );

    }
  );

}


/* =========================================================
   COMPOSITE BOARD
========================================================= */

function drawRecordingFrame() {

  if (
    !recordingCtx ||
    !recordingCanvas
  ) {

    return;

  }


  /*
    White background
  */

  recordingCtx.fillStyle =
    "#ffffff";

  recordingCtx.fillRect(
    0,
    0,
    1280,
    720
  );


  /*
    SLIDE
  */

  if (
    slideCanvas.width > 1 &&
    slideCanvas.height > 1
  ) {

    const scale =
      Math.min(
        1280 /
          slideCanvas.width,

        720 /
          slideCanvas.height
      );

    const width =
      slideCanvas.width *
      scale;

    const height =
      slideCanvas.height *
      scale;

    recordingCtx.drawImage(
      slideCanvas,

      (1280 - width) / 2,

      (720 - height) / 2,

      width,

      height
    );

  }


  /*
    DRAWING
  */

  recordingCtx.drawImage(
    drawingCanvas,
    0,
    0,
    1280,
    720
  );


  /*
    TEXT
  */

  drawTextToRecording();


  /*
    Recording indicator
  */

  if (
    recordingState ===
      "recording" ||
    recordingState ===
      "paused"
  ) {

    recordingCtx.fillStyle =
      "rgba(20,20,25,.85)";

    recordingCtx.beginPath();

    recordingCtx.roundRect(
      1080,
      18,
      125,
      34,
      8
    );

    recordingCtx.fill();


    recordingCtx.fillStyle =
      "#ff3030";

    recordingCtx.beginPath();

    recordingCtx.arc(
      1098,
      35,
      5,
      0,
      Math.PI * 2
    );

    recordingCtx.fill();


    recordingCtx.fillStyle =
      "#ffffff";

    recordingCtx.font =
      "700 12px Arial";

    recordingCtx.fillText(
      "SNK RECORDING",
      1112,
      28
    );

  }

}


/* =========================================================
   ANIMATION LOOP
========================================================= */

function recordingRenderLoop() {

  if (
    recordingState !==
      "recording" &&
    recordingState !==
      "paused"
  ) {

    return;

  }

  drawRecordingFrame();

  recordingAnimationFrame =
    requestAnimationFrame(
      recordingRenderLoop
    );

}


/* =========================================================
   START RECORDING
========================================================= */

async function startRecording() {

  if (
    recordingState !==
    "idle"
  ) {

    return;

  }


  const micReady =
    await requestMicrophone();


  if (
    !micReady &&
    microphoneEnabled
  ) {

    showToast(
      "Microphone permission is required"
    );

    return;

  }


  createRecordingCanvas();


  /*
    Capture board video
  */

  const boardStream =
    recordingCanvas.captureStream(
      30
    );


  /*
    Create combined stream
  */

  recordingStream =
    new MediaStream();


  /*
    Video
  */

  boardStream
    .getVideoTracks()
    .forEach(
      track => {

        recordingStream.addTrack(
          track
        );

      }
    );


  /*
    Audio
  */

  if (
    microphoneStream &&
    microphoneEnabled
  ) {

    microphoneStream
      .getAudioTracks()
      .forEach(
        track => {

          recordingStream.addTrack(
            track
          );

        }
      );

  }


  /*
    Check MediaRecorder
  */

  if (
    !window.MediaRecorder
  ) {

    showToast(
      "Your browser does not support recording"
    );

    return;

  }


  /*
    Choose supported MIME type
  */

  const mimeTypes = [

    "video/webm;codecs=vp9,opus",

    "video/webm;codecs=vp8,opus",

    "video/webm"

  ];


  let selectedMime =
    "";


  for (
    const type of mimeTypes
  ) {

    if (
      MediaRecorder.isTypeSupported(
        type
      )
    ) {

      selectedMime =
        type;

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
                selectedMime,

              videoBitsPerSecond:
                4_000_000
            }
          )

        : new MediaRecorder(
            recordingStream
          );

  } catch(error) {

    console.error(
      error
    );

    showToast(
      "Could not start recorder"
    );

    return;

  }


  recordedChunks =
    [];


  mediaRecorder.ondataavailable =
    event => {

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
    event => {

      console.error(
        "MediaRecorder error:",
        event
      );

      showToast(
        "Recording error"
      );

    };


  recordingState =
    "recording";

  recordingStartTime =
    Date.now();

  recordingPausedTotal =
    0;

  recordingPausedAt =
    0;


  mediaRecorder.start(
    1000
  );


  recordingOverlay.classList.add(
    "active"
  );


  recordBtn.classList.add(
    "recording"
  );


  recordBtnText.textContent =
    "Recording";


  startRecordBtn.disabled =
    true;

  pauseRecordBtn.disabled =
    false;

  stopRecordBtn.disabled =
    false;


  recordingMainStatus.textContent =
    "Recording class...";


  setStatus(
    "Recording..."
  );


  startRecordingTimer();

  recordingRenderLoop();


  showToast(
    "Recording started"
  );

}


/* =========================================================
   PAUSE RECORDING
========================================================= */

function pauseRecording() {

  if (
    !mediaRecorder ||
    recordingState !==
      "recording"
  ) {

    return;

  }


  if (
    mediaRecorder.state ===
    "recording"
  ) {

    mediaRecorder.pause();

  }


  recordingState =
    "paused";

  recordingPausedAt =
    Date.now();


  pauseRecordBtn.innerHTML =
    "▶ Resume";


  recordingMainStatus.textContent =
    "Recording paused";

  setStatus(
    "Recording paused"
  );


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
    recordingState !==
      "paused"
  ) {

    return;

  }


  if (
    mediaRecorder.state ===
    "paused"
  ) {

    mediaRecorder.resume();

  }


  if (
    recordingPausedAt
  ) {

    recordingPausedTotal +=
      Date.now() -
      recordingPausedAt;

  }


  recordingPausedAt =
    0;

  recordingState =
    "recording";


  pauseRecordBtn.innerHTML =
    "⏸ Pause";


  recordingMainStatus.textContent =
    "Recording class...";


  setStatus(
    "Recording..."
  );


  showToast(
    "Recording resumed"
  );

}


/* =========================================================
   PAUSE BUTTON
========================================================= */

pauseRecordBtn.addEventListener(
  "click",
  () => {

    if (
      recordingState ===
      "recording"
    ) {

      pauseRecording();

    } else if (
      recordingState ===
      "paused"
    ) {

      resumeRecording();

    }

  }
);


/* =========================================================
   STOP RECORDING
========================================================= */

function stopRecording() {

  if (
    !mediaRecorder ||
    (
      recordingState !==
        "recording" &&
      recordingState !==
        "paused"
    )
  ) {

    return;

  }


  recordingState =
    "finalizing";


  recordingMainStatus.textContent =
    "Preparing video...";


  setStatus(
    "Preparing recording..."
  );


  stopRecordBtn.disabled =
    true;

  pauseRecordBtn.disabled =
    true;


  if (
    mediaRecorder.state !==
    "inactive"
  ) {

    mediaRecorder.stop();

  }

}


stopRecordBtn.addEventListener(
  "click",
  stopRecording
);


/* =========================================================
   START BUTTON
========================================================= */

startRecordBtn.addEventListener(
  "click",
  startRecording
);


/* =========================================================
   TOP RECORD BUTTON
========================================================= */

recordBtn.addEventListener(
  "click",
  async () => {

    if (
      recordingState ===
      "idle"
    ) {

      await startRecording();

    } else if (
      recordingState ===
      "recording"
    ) {

      pauseRecording();

    } else if (
      recordingState ===
      "paused"
    ) {

      resumeRecording();

    }

  }
);


/* =========================================================
   FINISH RECORDING
========================================================= */

function finishRecording() {

  cancelAnimationFrame(
    recordingAnimationFrame
  );


  const blob =
    new Blob(
      recordedChunks,
      {
        type:
          "video/webm"
      }
    );


  if (
    blob.size === 0
  ) {

    showToast(
      "Recording file is empty"
    );

    resetRecordingUI();

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
    `SNK-Smart-Class-${
      getFileDate()
    }.webm`;

  document.body.appendChild(
    link
  );

  link.click();

  link.remove();


  setTimeout(
    () => {

      URL.revokeObjectURL(
        url
      );

    },
    10000
  );


  showToast(
    "Recording downloaded"
  );


  resetRecordingUI();

}


/* =========================================================
   RESET RECORDING UI
========================================================= */

function resetRecordingUI() {

  recordingState =
    "idle";


  recordingOverlay.classList.remove(
    "active"
  );


  recordBtn.classList.remove(
    "recording"
  );


  recordBtnText.textContent =
    "Record";


  startRecordBtn.disabled =
    false;

  pauseRecordBtn.disabled =
    true;

  stopRecordBtn.disabled =
    true;


  pauseRecordBtn.innerHTML =
    "⏸ Pause";


  recordingMainStatus.textContent =
    "Ready to record";


  setStatus(
    "Ready"
  );


  stopRecordingTimer();


  if (
    recordingStream
  ) {

    recordingStream
      .getTracks()
      .forEach(
        track => {

          track.stop();

        }
      );

  }


  recordingStream =
    null;

  mediaRecorder =
    null;

  recordedChunks =
    [];

  recordingCanvas =
    null;

  recordingCtx =
    null;

}


/* =========================================================
   TIMER
========================================================= */

function formatTime(
  milliseconds
) {

  const seconds =
    Math.floor(
      milliseconds / 1000
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


  return [

    String(hours)
      .padStart(2,"0"),

    String(minutes)
      .padStart(2,"0"),

    String(secs)
      .padStart(2,"0")

  ].join(":");

}


function updateRecordingTimer() {

  if (
    recordingState !==
      "recording" &&
    recordingState !==
      "paused"
  ) {

    return;

  }


  let elapsed =
    Date.now() -
    recordingStartTime -
    recordingPausedTotal;


  if (
    recordingState ===
      "paused" &&
    recordingPausedAt
  ) {

    elapsed -=
      Date.now() -
      recordingPausedAt;

  }


  const time =
    formatTime(
      Math.max(
        elapsed,
        0
      )
    );


  recordingTimer.textContent =
    time;

  recordingBigTimer.textContent =
    time;

}


function startRecordingTimer() {

  stopRecordingTimer();

  updateRecordingTimer();

  recordingTimerInterval =
    setInterval(
      updateRecordingTimer,
      250
    );

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


/* =========================================================
   FILE DATE
========================================================= */

function getFileDate() {

  const now =
    new Date();

  return [

    now.getFullYear(),

    String(
      now.getMonth() + 1
    ).padStart(2,"0"),

    String(
      now.getDate()
    ).padStart(2,"0"),

    "-",

    String(
      now.getHours()
    ).padStart(2,"0"),

    String(
      now.getMinutes()
    ).padStart(2,"0"),

    String(
      now.getSeconds()
    ).padStart(2,"0")

  ].join("");

}


/* =========================================================
   NEW BOARD
========================================================= */

newBoardBtn.addEventListener(
  "click",
  () => {

    if (
      recordingState !==
      "idle"
    ) {

      showToast(
        "Stop recording first"
      );

      return;

    }


    if (
      !confirm(
        "Create a new board?"
      )
    ) {

      return;

    }


    pages = [
      createPage()
    ];

    currentPageIndex =
      0;

    pdfDocument =
      null;

    pdfPageCache =
      new Map();

    closeSlide(
      false
    );


    drawingCtx.clearRect(
      0,
      0,
      drawingCanvas.width,
      drawingCanvas.height
    );


    textLayer.innerHTML =
      "";

    notesInput.value =
      "";


    history = [];
    redoHistory = [];


    renderPages();

    setTimeout(
      saveHistory,
      100
    );


    showToast(
      "New board created"
    );

  }
);


/* =========================================================
   FULLSCREEN
========================================================= */

fullscreenBtn.addEventListener(
  "click",
  async () => {

    if (
      !document.fullscreenElement
    ) {

      try {

        await document
          .documentElement
          .requestFullscreen();

      } catch(error) {

        console.error(
          error
        );

      }

      document.body.classList.add(
        "fullscreen-mode"
      );

    } else {

      await document.exitFullscreen();

      document.body.classList.remove(
        "fullscreen-mode"
      );

    }


    setTimeout(
      () => {

        resizeCanvas();

      },
      300
    );

  }
);


document.addEventListener(
  "fullscreenchange",
  () => {

    if (
      !document.fullscreenElement
    ) {

      document.body.classList.remove(
        "fullscreen-mode"
      );

    }

  }
);


/* =========================================================
   NOTES
========================================================= */

notesInput.addEventListener(
  "input",
  () => {

    pages[
      currentPageIndex
    ].notes =
      notesInput.value;

  }
);


/* =========================================================
   KEYBOARD
========================================================= */

document.addEventListener(
  "keydown",
  event => {

    const tag =
      document.activeElement?.tagName;


    if (
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      document.activeElement?.isContentEditable
    ) {

      return;

    }


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


    const key =
      event.key.toLowerCase();


    if (
      key === "p"
    ) {

      setTool("pen");

    }


    if (
      key === "m"
    ) {

      setTool("marker");

    }


    if (
      key === "e"
    ) {

      setTool("eraser");

    }

  }
);


/* =========================================================
   INITIALIZE
========================================================= */

setTool("pen");


setTimeout(
  () => {

    resizeCanvas();

    renderCurrentPage();

    saveHistory();

  },
  200
);


/* =========================================================
   BEFORE LEAVING PAGE
========================================================= */

window.addEventListener(
  "beforeunload",
  event => {

    if (
      recordingState ===
        "recording" ||
      recordingState ===
        "paused"
    ) {

      event.preventDefault();

      event.returnValue =
        "";

    }

  }
);
