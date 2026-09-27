/* =========================================================
   SNK SMART BOARD
   STEP 6
   PDF.JS + DRAWING + SLIDES + BOARD PAGES
========================================================= */


/* =========================================================
   PDF.JS
========================================================= */

import {
  getDocument,
  GlobalWorkerOptions
} from "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/build/pdf.mjs";


GlobalWorkerOptions.workerSrc =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/build/pdf.worker.min.mjs";


/* =========================================================
   ELEMENTS
========================================================= */

const board =
  document.getElementById("board");

const boardShell =
  document.getElementById("boardShell");

const drawingCanvas =
  document.getElementById("drawingCanvas");

const drawingCtx =
  drawingCanvas.getContext("2d");

const slideCanvas =
  document.getElementById("slideCanvas");

const slideCtx =
  slideCanvas.getContext("2d");

const slideLayer =
  document.getElementById("slideLayer");

const slideEmpty =
  document.getElementById("slideEmpty");

const textLayer =
  document.getElementById("textLayer");

const slideControls =
  document.getElementById("slideControls");

const pagesList =
  document.getElementById("pagesList");

const notesInput =
  document.getElementById("notesInput");

const toast =
  document.getElementById("toast");

const boardStatus =
  document.getElementById("boardStatus");

const colorPicker =
  document.getElementById("colorPicker");

const colorValue =
  document.getElementById("colorValue");

const sizeSlider =
  document.getElementById("sizeSlider");

const sizeValue =
  document.getElementById("sizeValue");

const zoomLabel =
  document.getElementById("zoomLabel");

const slideZoomLabel =
  document.getElementById("slideZoomLabel");

const slideNumberInput =
  document.getElementById("slideNumberInput");

const slideTotal =
  document.getElementById("slideTotal");

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

const zoomInBtn =
  document.getElementById("zoomInBtn");

const zoomOutBtn =
  document.getElementById("zoomOutBtn");

const fitSlideBtn =
  document.getElementById("fitSlideBtn");

const slideZoomInBtn2 =
  document.getElementById("slideZoomInBtn");

const slideZoomOutBtn2 =
  document.getElementById("slideZoomOutBtn");

const slideNumberInputEl =
  document.getElementById("slideNumberInput");

const saveBtn =
  document.getElementById("saveBtn");

const newBoardBtn =
  document.getElementById("newBoardBtn");

const fullscreenBtn =
  document.getElementById("fullscreenBtn");

const addPageBtn =
  document.getElementById("addPageBtn");


/* =========================================================
   STATE
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

let globalZoom = 1;

let slideZoom = 1;

let currentPageIndex = 0;

let pages = [];

let pdfDocument = null;

let pdfName = "";

let pdfPageCache = new Map();

let slideType = null;

let slideImage = null;

let slideNaturalWidth = 0;

let slideNaturalHeight = 0;

let currentSlidePage = 1;

let totalSlides = 0;

let isRenderingSlide = false;

let currentTextMode = false;


/* =========================================================
   PAGE OBJECT
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

setTimeout(() => {

  resizeCanvas();

  saveHistory();

}, 100);


/* =========================================================
   TOAST
========================================================= */

let toastTimer = null;

function showToast(message) {

  toast.textContent = message;

  toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer =
    setTimeout(() => {

      toast.classList.remove("show");

    }, 1800);
}


/* =========================================================
   BOARD STATUS
========================================================= */

function setStatus(text) {

  boardStatus.textContent = text;
}


/* =========================================================
   TOOL
========================================================= */

function setTool(tool) {

  currentTool = tool;

  document
    .querySelectorAll(".tool-btn")
    .forEach(btn => {

      btn.classList.remove("active");

    });

  if (tool === "pen") {
    penBtn.classList.add("active");
  }

  if (tool === "marker") {
    markerBtn.classList.add("active");
  }

  if (tool === "eraser") {
    eraserBtn.classList.add("active");
  }

  if (tool === "eraser") {

    drawingCanvas.style.cursor =
      "cell";

  } else {

    drawingCanvas.style.cursor =
      "crosshair";

  }

}


/* =========================================================
   TOOL BUTTONS
========================================================= */

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
      Number(sizeSlider.value);

    sizeValue.textContent =
      currentSize;

  }
);


/* =========================================================
   CANVAS COORDINATES
========================================================= */

function getPointerPosition(event) {

  const rect =
    drawingCanvas.getBoundingClientRect();

  const scaleX =
    drawingCanvas.width /
    rect.width;

  const scaleY =
    drawingCanvas.height /
    rect.height;

  return {

    x:
      (event.clientX - rect.left) *
      scaleX,

    y:
      (event.clientY - rect.top) *
      scaleY

  };

}


/* =========================================================
   START DRAW
========================================================= */

drawingCanvas.addEventListener(
  "pointerdown",
  event => {

    if (currentTextMode) {
      return;
    }

    isDrawing = true;

    drawingCanvas.setPointerCapture(
      event.pointerId
    );

    const pos =
      getPointerPosition(event);

    lastX = pos.x;
    lastY = pos.y;

    drawingCtx.beginPath();

    drawingCtx.moveTo(
      lastX,
      lastY
    );

    drawingCtx.lineCap = "round";

    if (currentTool === "eraser") {

      drawingCtx.globalCompositeOperation =
        "destination-out";

      drawingCtx.lineWidth =
        currentSize * 3;

    } else {

      drawingCtx.globalCompositeOperation =
        "source-over";

      drawingCtx.strokeStyle =
        currentColor;

      if (currentTool === "marker") {

        drawingCtx.globalAlpha =
          0.28;

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
      lastX + 0.01,
      lastY + 0.01
    );

    drawingCtx.stroke();

  }
);


/* =========================================================
   DRAW
========================================================= */

drawingCanvas.addEventListener(
  "pointermove",
  event => {

    if (!isDrawing) {
      return;
    }

    const pos =
      getPointerPosition(event);

    drawingCtx.lineTo(
      pos.x,
      pos.y
    );

    drawingCtx.stroke();

    lastX = pos.x;
    lastY = pos.y;

  }
);


/* =========================================================
   END DRAW
========================================================= */

function stopDrawing() {

  if (!isDrawing) {
    return;
  }

  isDrawing = false;

  drawingCtx.closePath();

  drawingCtx.globalAlpha = 1;

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

drawingCanvas.addEventListener(
  "pointerleave",
  event => {

    if (
      isDrawing &&
      event.pointerType === "mouse"
    ) {

      stopDrawing();

    }

  }
);


/* =========================================================
   SAVE PAGE DRAWING
========================================================= */

function savePageDrawing() {

  pages[currentPageIndex].drawingData =
    drawingCanvas.toDataURL(
      "image/png"
    );

}


/* =========================================================
   HISTORY
========================================================= */

function saveHistory() {

  const image =
    drawingCanvas.toDataURL(
      "image/png"
    );

  history.push(image);

  if (history.length > 40) {

    history.shift();

  }

  redoHistory = [];

}


function restoreCanvasFromData(data) {

  if (!data) {

    drawingCtx.clearRect(
      0,
      0,
      drawingCanvas.width,
      drawingCanvas.height
    );

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

  };

  image.src = data;

}


/* =========================================================
   UNDO
========================================================= */

undoBtn.addEventListener(
  "click",
  undo
);


function undo() {

  if (history.length <= 1) {

    showToast("Nothing to undo");

    return;

  }

  const current =
    history.pop();

  redoHistory.push(current);

  const previous =
    history[history.length - 1];

  restoreCanvasFromData(
    previous
  );

  pages[currentPageIndex].drawingData =
    previous;

}


/* =========================================================
   REDO
========================================================= */

redoBtn.addEventListener(
  "click",
  redo
);


function redo() {

  if (!redoHistory.length) {

    showToast("Nothing to redo");

    return;

  }

  const next =
    redoHistory.pop();

  history.push(next);

  restoreCanvasFromData(
    next
  );

  pages[currentPageIndex].drawingData =
    next;

}


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

    pages[currentPageIndex].drawingData =
      null;

    saveHistory();

    showToast("Drawing cleared");

  }
);


/* =========================================================
   RESIZE CANVAS
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
    pages[currentPageIndex]?.drawingData;

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

  drawingCtx.setTransform(
    1,
    0,
    0,
    1,
    0,
    0
  );

  drawingCtx.lineCap =
    "round";

  drawingCtx.lineJoin =
    "round";

  if (oldData) {

    restoreCanvasFromData(
      oldData
    );

  }

}


window.addEventListener(
  "resize",
  () => {

    resizeCanvas();

    renderCurrentPage();

  }
);


/* =========================================================
   PAGE RENDERING
========================================================= */

function renderPages() {

  pagesList.innerHTML = "";

  pages.forEach(
    (page, index) => {

      const button =
        document.createElement("button");

      button.className =
        "page-thumb";

      if (
        index === currentPageIndex
      ) {

        button.classList.add(
          "active"
        );

      }

      button.textContent =
        index + 1;

      button.title =
        page.name;

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
    index < 0 ||
    index >= pages.length
  ) {

    return;

  }

  saveCurrentPageState();

  currentPageIndex =
    index;

  renderPages();

  history = [];
  redoHistory = [];

  renderCurrentPage();

  setTimeout(
    saveHistory,
    100
  );

}


function saveCurrentPageState() {

  if (!pages[currentPageIndex]) {
    return;
  }

  pages[currentPageIndex].drawingData =
    drawingCanvas.toDataURL(
      "image/png"
    );

  pages[currentPageIndex].notes =
    notesInput.value;

  pages[currentPageIndex].textItems =
    readTextItems();

}


/* =========================================================
   ADD PAGE
========================================================= */

addPageBtn.addEventListener(
  "click",
  () => {

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

    showToast(
      `Page ${pages.length} created`
    );

  }
);


/* =========================================================
   RENDER CURRENT PAGE
========================================================= */

function renderCurrentPage() {

  const page =
    pages[currentPageIndex];

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
    page.slideType === "pdf" &&
    page.slideData
  ) {

    loadPdfFromSavedState(
      page
    );

  } else if (
    page.slideType === "image" &&
    page.slideData
  ) {

    loadImageFromSavedState(
      page
    );

  } else {

    closeSlide(false);

  }

}


/* =========================================================
   IMAGE UPLOAD
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
  async event => {

    const file =
      event.target.files[0];

    if (!file) {
      return;
    }

    await loadImageFile(file);

    imageInput.value = "";

  }
);


/* =========================================================
   LOAD IMAGE
========================================================= */

async function loadImageFile(file) {

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

          slideNaturalWidth =
            image.naturalWidth;

          slideNaturalHeight =
            image.naturalHeight;

          slideType =
            "image";

          currentSlidePage =
            1;

          totalSlides =
            1;

          pages[currentPageIndex].slideType =
            "image";

          pages[currentPageIndex].slideData =
            data;

          pages[currentPageIndex].slideName =
            file.name;

          pages[currentPageIndex].slidePage =
            1;

          pages[currentPageIndex].slideTotal =
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

  reader.readAsDataURL(file);

}


/* =========================================================
   LOAD SAVED IMAGE
========================================================= */

function loadImageFromSavedState(page) {

  const image =
    new Image();

  image.onload =
    () => {

      slideImage =
        image;

      slideNaturalWidth =
        image.naturalWidth;

      slideNaturalHeight =
        image.naturalHeight;

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
   RENDER IMAGE SLIDE
========================================================= */

function renderImageSlide() {

  if (!slideImage) {
    return;
  }

  slideCanvas.width =
    slideNaturalWidth;

  slideCanvas.height =
    slideNaturalHeight;

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
   PDF UPLOAD
========================================================= */

pdfInput.addEventListener(
  "change",
  async event => {

    const file =
      event.target.files[0];

    if (!file) {
      return;
    }

    await loadPdfFile(file);

    pdfInput.value = "";

  }
);


/* =========================================================
   LOAD PDF
========================================================= */

async function loadPdfFile(file) {

  try {

    setStatus(
      "Loading PDF..."
    );

    showToast(
      "Loading PDF..."
    );

    const buffer =
      await file.arrayBuffer();

    const loadingTask =
      getDocument({
        data: buffer
      });

    pdfDocument =
      await loadingTask.promise;

    pdfName =
      file.name;

    pdfPageCache =
      new Map();

    currentSlidePage =
      1;

    totalSlides =
      pdfDocument.numPages;

    slideType =
      "pdf";

    pages[currentPageIndex].slideType =
      "pdf";

    pages[currentPageIndex].slideData =
      pdfName;

    pages[currentPageIndex].slideName =
      pdfName;

    pages[currentPageIndex].slidePage =
      1;

    pages[currentPageIndex].slideTotal =
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
      `${pdfName} • ${totalSlides} pages`
    );

    showToast(
      `PDF loaded • ${totalSlides} pages`
    );

  } catch (error) {

    console.error(error);

    setStatus(
      "PDF loading failed"
    );

    showToast(
      "Could not load PDF"
    );

  }

}


/* =========================================================
   LOAD SAVED PDF
========================================================= */

async function loadPdfFromSavedState(page) {

  /*
    Browser security does not allow us to keep the
    original local PDF file after refresh.

    Therefore saved PDF pages can only remain active
    during the current session.

    If a PDF was just uploaded, pdfDocument exists.
  */

  if (
    pdfDocument &&
    page.slideType === "pdf"
  ) {

    slideType =
      "pdf";

    totalSlides =
      pdfDocument.numPages;

    currentSlidePage =
      page.slidePage || 1;

    slideTotal.textContent =
      totalSlides;

    slideNumberInput.value =
      currentSlidePage;

    showSlideUI();

    await renderPdfPage(
      currentSlidePage
    );

    return;

  }

  /*
    If page references a PDF but the actual
    PDF document is no longer available.
  */

  closeSlide(false);

  showToast(
    "PDF must be uploaded again for this page"
  );

}


/* =========================================================
   RENDER PDF PAGE
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
    pageNumber > pdfDocument.numPages
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

      const baseViewport =
        page.getViewport({
          scale: 1
        });

      const boardRect =
        board.getBoundingClientRect();

      const maxWidth =
        Math.max(
          boardRect.width - 20,
          300
        );

      const maxHeight =
        Math.max(
          boardRect.height - 20,
          200
        );

      const widthScale =
        maxWidth /
        baseViewport.width;

      const heightScale =
        maxHeight /
        baseViewport.height;

      const fitScale =
        Math.min(
          widthScale,
          heightScale
        );

      const renderScale =
        Math.max(
          fitScale,
          0.8
        );

      const viewport =
        page.getViewport({
          scale: renderScale
        });

      const tempCanvas =
        document.createElement(
          "canvas"
        );

      const tempCtx =
        tempCanvas.getContext(
          "2d"
        );

      tempCanvas.width =
        Math.ceil(
          viewport.width
        );

      tempCanvas.height =
        Math.ceil(
          viewport.height
        );

      await page.render({
        canvasContext:
          tempCtx,

        viewport:
          viewport
      }).promise;

      cached = {
        data:
          tempCanvas.toDataURL(
            "image/png"
          ),

        width:
          tempCanvas.width,

        height:
          tempCanvas.height
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

    pages[currentPageIndex].slidePage =
      pageNumber;

    pages[currentPageIndex].slideTotal =
      totalSlides;

    slideNumberInput.value =
      pageNumber;

    slideTotal.textContent =
      totalSlides;

    applySlideDisplay();

  } catch (error) {

    console.error(
      "PDF page render error:",
      error
    );

    showToast(
      "Could not render PDF page"
    );

  } finally {

    isRenderingSlide =
      false;

  }

}


/* =========================================================
   SLIDE DISPLAY
========================================================= */

function applySlideDisplay() {

  slideCanvas.style.transform =
    `scale(${slideZoom})`;

  slideZoomLabel.textContent =
    `${Math.round(slideZoom * 100)}%`;

  zoomLabel.textContent =
    `${Math.round(globalZoom * 100)}%`;

}


function showSlideUI() {

  slideEmpty.classList.add(
    "hidden"
  );

  slideControls.classList.add(
    "visible"
  );

}


/* =========================================================
   PREVIOUS SLIDE
========================================================= */

previousSlideBtn.addEventListener(
  "click",
  async () => {

    if (
      currentSlidePage <= 1
    ) {

      showToast(
        "Already on first page"
      );

      return;

    }

    await goToSlide(
      currentSlidePage - 1
    );

  }
);


/* =========================================================
   NEXT SLIDE
========================================================= */

nextSlideBtn.addEventListener(
  "click",
  async () => {

    if (
      currentSlidePage >= totalSlides
    ) {

      showToast(
        "Already on last page"
      );

      return;

    }

    await goToSlide(
      currentSlidePage + 1
    );

  }
);


/* =========================================================
   GO TO SLIDE
========================================================= */

async function goToSlide(pageNumber) {

  if (
    pageNumber < 1 ||
    pageNumber > totalSlides
  ) {

    return;

  }

  if (slideType === "pdf") {

    await renderPdfPage(
      pageNumber
    );

  } else if (
    slideType === "image"
  ) {

    currentSlidePage =
      1;

    slideNumberInput.value =
      "1";

  }

}


/* =========================================================
   SLIDE NUMBER INPUT
========================================================= */

slideNumberInputEl.addEventListener(
  "change",
  async () => {

    const number =
      Number(
        slideNumberInputEl.value
      );

    if (
      !Number.isFinite(number)
    ) {

      slideNumberInputEl.value =
        currentSlidePage;

      return;

    }

    await goToSlide(
      Math.floor(number)
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
        slideZoom + 0.1,
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
        slideZoom - 0.1,
        0.5
      );

    applySlideDisplay();

  }
);


/* =========================================================
   FIT SLIDE
========================================================= */

fitSlideBtn.addEventListener(
  "click",
  async () => {

    slideZoom = 1;

    globalZoom = 1;

    if (
      slideType === "pdf" &&
      pdfDocument
    ) {

      pdfPageCache =
        new Map();

      await renderPdfPage(
        currentSlidePage
      );

    } else if (
      slideType === "image" &&
      slideImage
    ) {

      renderImageSlide();

    }

    applySlideDisplay();

    showToast(
      "Slide fitted"
    );

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
        globalZoom + 0.1,
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
        globalZoom - 0.1,
        0.7
      );

    board.style.transform =
      `scale(${globalZoom})`;

    applySlideDisplay();

  }
);


/* =========================================================
   CLOSE SLIDE
========================================================= */

closeSlideBtn.addEventListener(
  "click",
  () => {

    closeSlide(true);

  }
);


function closeSlide(showMessage = true) {

  slideType =
    null;

  slideImage =
    null;

  totalSlides =
    0;

  currentSlidePage =
    1;

  slideZoom =
    1;

  slideCanvas.width =
    1;

  slideCanvas.height =
    1;

  slideCanvas.style.transform =
    "scale(1)";

  slideEmpty.classList.remove(
    "hidden"
  );

  slideControls.classList.remove(
    "visible"
  );

  slideTotal.textContent =
    "0";

  slideNumberInput.value =
    "1";

  if (
    pages[currentPageIndex]
  ) {

    pages[currentPageIndex].slideType =
      null;

    pages[currentPageIndex].slideData =
      null;

    pages[currentPageIndex].slideName =
      "";

    pages[currentPageIndex].slidePage =
      1;

    pages[currentPageIndex].slideTotal =
      0;

  }

  setStatus(
    "Board ready"
  );

  if (showMessage) {

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

    if (currentTextMode) {

      drawingCanvas.style.pointerEvents =
        "none";

      board.style.cursor =
        "text";

      showToast(
        "Click anywhere to add text"
      );

    } else {

      drawingCanvas.style.pointerEvents =
        "auto";

      board.style.cursor =
        "default";

    }

  }
);


/* =========================================================
   ADD TEXT
========================================================= */

board.addEventListener(
  "click",
  event => {

    if (!currentTextMode) {
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

    const x =
      event.clientX -
      rect.left;

    const y =
      event.clientY -
      rect.top;

    createTextItem(
      x,
      y
    );

  }
);


/* =========================================================
   CREATE TEXT ITEM
========================================================= */

function createTextItem(
  x,
  y,
  value = "Type here..."
) {

  const item =
    document.createElement("div");

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

  document.execCommand(
    "selectAll",
    false,
    null
  );

  item.addEventListener(
    "input",
    () => {

      savePageText();

    }
  );

  item.addEventListener(
    "blur",
    () => {

      savePageText();

    }
  );

  enableTextDragging(
    item
  );

}


/* =========================================================
   TEXT DRAGGING
========================================================= */

function enableTextDragging(item) {

  let dragging = false;

  let offsetX = 0;
  let offsetY = 0;

  item.addEventListener(
    "pointerdown",
    event => {

      if (
        document.activeElement === item &&
        event.detail === 0
      ) {

        return;

      }

      dragging = true;

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

      const x =
        event.clientX -
        boardRect.left -
        offsetX;

      const y =
        event.clientY -
        boardRect.top -
        offsetY;

      item.style.left =
        `${Math.max(0, x)}px`;

      item.style.top =
        `${Math.max(0, y)}px`;

    }
  );


  item.addEventListener(
    "pointerup",
    () => {

      dragging = false;

      savePageText();

    }
  );

}


/* =========================================================
   SAVE TEXT
========================================================= */

function savePageText() {

  pages[currentPageIndex].textItems =
    readTextItems();

}


function readTextItems() {

  return [
    ...textLayer.querySelectorAll(
      ".text-item"
    )
  ].map(
    item => {

      return {

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

      };

    }
  );

}


/* =========================================================
   RENDER TEXT
========================================================= */

function renderTextItems(items) {

  textLayer.innerHTML = "";

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
   SAVE COMPOSITE PNG
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
    output.getContext("2d");

  /*
    White background
  */

  ctx.fillStyle =
    "#ffffff";

  ctx.fillRect(
    0,
    0,
    width,
    height
  );


  /*
    Slide
  */

  if (
    slideCanvas.width > 1 &&
    slideCanvas.height > 1
  ) {

    const boardRatio =
      width / height;

    const slideRatio =
      slideCanvas.width /
      slideCanvas.height;

    let drawWidth;
    let drawHeight;

    if (
      slideRatio > boardRatio
    ) {

      drawWidth =
        width;

      drawHeight =
        width /
        slideRatio;

    } else {

      drawHeight =
        height;

      drawWidth =
        height *
        slideRatio;

    }

    const x =
      (width - drawWidth) / 2;

    const y =
      (height - drawHeight) / 2;

    ctx.drawImage(
      slideCanvas,
      x,
      y,
      drawWidth,
      drawHeight
    );

  }


  /*
    Drawing
  */

  ctx.drawImage(
    drawingCanvas,
    0,
    0,
    width,
    height
  );


  /*
    Text
  */

  const boardRect =
    board.getBoundingClientRect();

  const scaleX =
    width /
    boardRect.width;

  const scaleY =
    height /
    boardRect.height;

  const textItems =
    readTextItems();

  ctx.fillStyle =
    "#172033";

  ctx.textBaseline =
    "top";

  textItems.forEach(
    item => {

      const fontSize =
        28 *
        Math.min(
          scaleX,
          scaleY
        );

      ctx.font =
        `600 ${fontSize}px Inter, Arial, sans-serif`;

      ctx.fillText(
        item.text,
        item.left * scaleX,
        item.top * scaleY
      );

    }
  );


  /*
    Download
  */

  const link =
    document.createElement("a");

  link.download =
    `SNK-Smart-Board-Page-${currentPageIndex + 1}.png`;

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
   NEW BOARD
========================================================= */

newBoardBtn.addEventListener(
  "click",
  () => {

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

    closeSlide(false);

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

    setStatus(
      "New board"
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

        await document.documentElement
          .requestFullscreen();

      } catch (error) {

        console.log(error);

      }

      document.body.classList.add(
        "fullscreen-mode"
      );

      fullscreenBtn.innerHTML =
        "<span>⛶</span> Exit";

    } else {

      await document.exitFullscreen();

      document.body.classList.remove(
        "fullscreen-mode"
      );

      fullscreenBtn.innerHTML =
        "<span>⛶</span> Fullscreen";

    }

    setTimeout(
      () => {

        resizeCanvas();

        renderCurrentPage();

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

      fullscreenBtn.innerHTML =
        "<span>⛶</span> Fullscreen";

    }

  }
);


/* =========================================================
   KEYBOARD SHORTCUTS
========================================================= */

document.addEventListener(
  "keydown",
  async event => {

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


    if (key === "p") {

      setTool("pen");

    }


    if (key === "m") {

      setTool("marker");

    }


    if (key === "e") {

      setTool("eraser");

    }


    if (
      key === "arrowleft"
    ) {

      await goToSlide(
        currentSlidePage - 1
      );

    }


    if (
      key === "arrowright"
    ) {

      await goToSlide(
        currentSlidePage + 1
      );

    }

  }
);


/* =========================================================
   NOTES AUTOSAVE
========================================================= */

notesInput.addEventListener(
  "input",
  () => {

    pages[currentPageIndex].notes =
      notesInput.value;

  }
);


/* =========================================================
   INITIAL STATUS
========================================================= */

setTool("pen");

setStatus(
  "Ready"
);


/* =========================================================
   INITIAL RESIZE
========================================================= */

window.addEventListener(
  "load",
  () => {

    resizeCanvas();

    renderCurrentPage();

  }
);
