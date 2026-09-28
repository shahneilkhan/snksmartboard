/* =========================================================
   SNK SMART BOARD
   LAPTOP MAIN ENGINE
   STEP 11.2.5
   WIRELESS CONTROLLER RECEIVER
   ========================================================= */

"use strict";

/* =========================================================
   GLOBAL STATE
   ========================================================= */

const SNKBoard = {

  tool: "pen",

  color: "#1e88ff",

  size: 4,

  drawing: false,

  wirelessDrawing: false,

  lastX: 0,

  lastY: 0,

  currentPage: 0,

  pages: [],

  zoom: 1,

  pdf: null,

  pdfPage: 1,

  pdfTotalPages: 0,

  cameraOn: false,

  cameraMirror: false,

  recording: false,

  processedCommands: new Set()

};


/* =========================================================
   DOM
   ========================================================= */

const boardCanvas =
  document.querySelector("#drawingCanvas");

const boardCtx =
  boardCanvas
    ? boardCanvas.getContext("2d")
    : null;

const boardStage =
  document.querySelector("#boardStage") ||
  document.querySelector("#presentationLayer") ||
  document.querySelector(".board-stage") ||
  document.querySelector(".board");

const toastElement =
  document.querySelector("#toast");


/* =========================================================
   TOAST
   ========================================================= */

function showToast(message) {

  if (!toastElement) {

    console.log(message);

    return;
  }

  toastElement.textContent =
    message;

  toastElement.classList.add("show");

  clearTimeout(
    showToast.timer
  );

  showToast.timer =
    setTimeout(() => {

      toastElement.classList.remove(
        "show"
      );

    }, 1800);
}


/* =========================================================
   CANVAS RESIZE
   ========================================================= */

function resizeBoardCanvas() {

  if (!boardCanvas) return;

  const rect =
    boardCanvas.getBoundingClientRect();

  const width =
    Math.max(
      1,
      rect.width
    );

  const height =
    Math.max(
      1,
      rect.height
    );

  const dpr =
    window.devicePixelRatio || 1;

  const oldCanvas =
    document.createElement("canvas");

  oldCanvas.width =
    boardCanvas.width;

  oldCanvas.height =
    boardCanvas.height;

  if (
    boardCanvas.width > 0 &&
    boardCanvas.height > 0
  ) {

    const oldCtx =
      oldCanvas.getContext("2d");

    oldCtx.drawImage(
      boardCanvas,
      0,
      0
    );
  }

  boardCanvas.width =
    Math.round(
      width * dpr
    );

  boardCanvas.height =
    Math.round(
      height * dpr
    );

  boardCtx.setTransform(
    dpr,
    0,
    0,
    dpr,
    0,
    0
  );

  if (
    oldCanvas.width > 0 &&
    oldCanvas.height > 0
  ) {

    boardCtx.drawImage(
      oldCanvas,
      0,
      0,
      oldCanvas.width / dpr,
      oldCanvas.height / dpr,
      0,
      0,
      width,
      height
    );
  }

}


/* =========================================================
   BOARD COORDINATES
   ========================================================= */

function boardCoordinates(
  clientX,
  clientY
) {

  if (!boardCanvas) {

    return {
      x: 0,
      y: 0
    };
  }

  const rect =
    boardCanvas.getBoundingClientRect();

  let x =
    clientX - rect.left;

  let y =
    clientY - rect.top;

  x =
    Math.max(
      0,
      Math.min(
        rect.width,
        x
      )
    );

  y =
    Math.max(
      0,
      Math.min(
        rect.height,
        y
      )
    );

  return {
    x,
    y
  };
}


/* =========================================================
   NORMALIZED WIRELESS COORDINATES
   ========================================================= */

function wirelessCoordinates(
  x,
  y
) {

  if (!boardCanvas) {

    return {
      x: 0,
      y: 0
    };
  }

  const rect =
    boardCanvas.getBoundingClientRect();

  return {

    x:
      Math.max(
        0,
        Math.min(
          rect.width,
          x * rect.width
        )
      ),

    y:
      Math.max(
        0,
        Math.min(
          rect.height,
          y * rect.height
        )
      )

  };
}


/* =========================================================
   DRAW STYLE
   ========================================================= */

function applyDrawingStyle(
  pressure = 0.5
) {

  if (!boardCtx) return;

  boardCtx.lineCap =
    "round";

  boardCtx.lineJoin =
    "round";

  let width =
    Number(SNKBoard.size) || 4;

  if (
    pressure > 0 &&
    pressure <= 1
  ) {

    if (
      SNKBoard.tool === "pen"
    ) {

      width *=
        0.75 +
        pressure * 0.5;
    }
  }

  if (
    SNKBoard.tool === "marker" ||
    SNKBoard.tool === "highlighter"
  ) {

    width *= 2.5;

    boardCtx.globalAlpha =
      0.35;

    boardCtx.globalCompositeOperation =
      "source-over";

    boardCtx.strokeStyle =
      SNKBoard.color;

  } else if (
    SNKBoard.tool === "eraser"
  ) {

    boardCtx.globalAlpha =
      1;

    boardCtx.globalCompositeOperation =
      "destination-out";

    boardCtx.strokeStyle =
      "rgba(0,0,0,1)";

  } else {

    boardCtx.globalAlpha =
      1;

    boardCtx.globalCompositeOperation =
      "source-over";

    boardCtx.strokeStyle =
      SNKBoard.color;
  }

  boardCtx.lineWidth =
    Math.max(
      1,
      width
    );
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

  if (!boardCtx) return;

  applyDrawingStyle(
    pressure
  );

  boardCtx.beginPath();

  boardCtx.moveTo(
    x1,
    y1
  );

  boardCtx.lineTo(
    x2,
    y2
  );

  boardCtx.stroke();

  boardCtx.closePath();

}


/* =========================================================
   LOCAL POINTER DOWN
   ========================================================= */

function localPointerDown(
  event
) {

  if (!boardCanvas) return;

  event.preventDefault();

  try {

    boardCanvas.setPointerCapture(
      event.pointerId
    );

  } catch (_) {}

  const point =
    boardCoordinates(
      event.clientX,
      event.clientY
    );

  SNKBoard.drawing =
    true;

  SNKBoard.lastX =
    point.x;

  SNKBoard.lastY =
    point.y;

  saveUndoState();
}


/* =========================================================
   LOCAL POINTER MOVE
   ========================================================= */

function localPointerMove(
  event
) {

  if (
    !SNKBoard.drawing
  ) {

    return;
  }

  event.preventDefault();

  const point =
    boardCoordinates(
      event.clientX,
      event.clientY
    );

  drawSegment(
    SNKBoard.lastX,
    SNKBoard.lastY,
    point.x,
    point.y,
    event.pressure
  );

  SNKBoard.lastX =
    point.x;

  SNKBoard.lastY =
    point.y;
}


/* =========================================================
   LOCAL POINTER UP
   ========================================================= */

function localPointerUp(
  event
) {

  SNKBoard.drawing =
    false;

  try {

    boardCanvas.releasePointerCapture(
      event.pointerId
    );

  } catch (_) {}

  resetDrawingState();
}


/* =========================================================
   RESET DRAWING STATE
   ========================================================= */

function resetDrawingState() {

  if (!boardCtx) return;

  boardCtx.globalAlpha =
    1;

  boardCtx.globalCompositeOperation =
    "source-over";

}


/* =========================================================
   UNDO SYSTEM
   ========================================================= */

const undoStack = [];

const redoStack = [];


function saveUndoState() {

  if (!boardCanvas) return;

  try {

    undoStack.push(
      boardCanvas.toDataURL(
        "image/png"
      )
    );

    if (
      undoStack.length > 30
    ) {

      undoStack.shift();
    }

    redoStack.length =
      0;

  } catch (error) {

    console.warn(
      "Undo snapshot failed:",
      error
    );
  }
}


function restoreCanvasData(
  dataUrl
) {

  if (!boardCtx) return;

  const image =
    new Image();

  image.onload =
    () => {

      boardCtx.clearRect(
        0,
        0,
        boardCanvas.width,
        boardCanvas.height
      );

      const rect =
        boardCanvas.getBoundingClientRect();

      boardCtx.drawImage(
        image,
        0,
        0,
        rect.width,
        rect.height
      );

    };

  image.src =
    dataUrl;
}


function undoBoard() {

  if (
    undoStack.length === 0
  ) {

    showToast(
      "Nothing to undo"
    );

    return;
  }

  if (boardCanvas) {

    redoStack.push(
      boardCanvas.toDataURL(
        "image/png"
      )
    );
  }

  const previous =
    undoStack.pop();

  restoreCanvasData(
    previous
  );

  showToast(
    "Undo"
  );
}


function redoBoard() {

  if (
    redoStack.length === 0
  ) {

    showToast(
      "Nothing to redo"
    );

    return;
  }

  if (boardCanvas) {

    undoStack.push(
      boardCanvas.toDataURL(
        "image/png"
      )
    );
  }

  const next =
    redoStack.pop();

  restoreCanvasData(
    next
  );

  showToast(
    "Redo"
  );
}


/* =========================================================
   CLEAR BOARD
   ========================================================= */

function clearBoard() {

  if (!boardCanvas) return;

  saveUndoState();

  const rect =
    boardCanvas.getBoundingClientRect();

  boardCtx.clearRect(
    0,
    0,
    rect.width,
    rect.height
  );

  resetDrawingState();

  showToast(
    "Board cleared"
  );
}


/* =========================================================
   NEW PAGE
   ========================================================= */

function newBoardPage() {

  if (
    typeof window.newBoard ===
    "function"
  ) {

    try {

      window.newBoard();

      return;

    } catch (_) {}
  }

  if (
    typeof window.addBoardPage ===
    "function"
  ) {

    try {

      window.addBoardPage();

      return;

    } catch (_) {}
  }

  clearBoard();

  showToast(
    "New page"
  );
}


/* =========================================================
   PAGE CONTROL
   ========================================================= */

function nextBoardPage() {

  if (
    typeof window.nextPage ===
    "function"
  ) {

    try {

      window.nextPage();

      return;

    } catch (_) {}
  }

  if (
    typeof window.goToNextPage ===
    "function"
  ) {

    try {

      window.goToNextPage();

      return;

    } catch (_) {}
  }

  if (
    SNKBoard.pages.length > 0
  ) {

    SNKBoard.currentPage =
      Math.min(
        SNKBoard.currentPage + 1,
        SNKBoard.pages.length - 1
      );

    renderBoardPage(
      SNKBoard.currentPage
    );

  } else {

    showToast(
      "Next page"
    );
  }
}


function previousBoardPage() {

  if (
    typeof window.previousPage ===
    "function"
  ) {

    try {

      window.previousPage();

      return;

    } catch (_) {}
  }

  if (
    typeof window.goToPreviousPage ===
    "function"
  ) {

    try {

      window.goToPreviousPage();

      return;

    } catch (_) {}
  }

  if (
    SNKBoard.pages.length > 0
  ) {

    SNKBoard.currentPage =
      Math.max(
        SNKBoard.currentPage - 1,
        0
      );

    renderBoardPage(
      SNKBoard.currentPage
    );

  } else {

    showToast(
      "Previous page"
    );
  }
}


/* =========================================================
   SIMPLE PAGE RENDER
   ========================================================= */

function renderBoardPage(
  index
) {

  if (
    !SNKBoard.pages[index]
  ) {

    return;
  }

  const page =
    SNKBoard.pages[index];

  if (
    page.drawingData
  ) {

    restoreCanvasData(
      page.drawingData
    );

  } else {

    clearCanvasWithoutHistory();
  }

}


/* =========================================================
   CLEAR WITHOUT HISTORY
   ========================================================= */

function clearCanvasWithoutHistory() {

  if (!boardCanvas) return;

  const rect =
    boardCanvas.getBoundingClientRect();

  boardCtx.clearRect(
    0,
    0,
    rect.width,
    rect.height
  );

  resetDrawingState();
}


/* =========================================================
   PDF / SLIDE CONTROL
   ========================================================= */

function nextSlide() {

  if (
    typeof window.nextSlide ===
    "function"
  ) {

    try {

      window.nextSlide();

      return;

    } catch (_) {}
  }

  if (
    typeof window.goToNextSlide ===
    "function"
  ) {

    try {

      window.goToNextSlide();

      return;

    } catch (_) {}
  }

  if (
    SNKBoard.pdf
  ) {

    renderPDFPage(
      Math.min(
        SNKBoard.pdfPage + 1,
        SNKBoard.pdfTotalPages
      )
    );

    return;
  }

  showToast(
    "Next slide"
  );
}


function previousSlide() {

  if (
    typeof window.previousSlide ===
    "function"
  ) {

    try {

      window.previousSlide();

      return;

    } catch (_) {}
  }

  if (
    typeof window.goToPreviousSlide ===
    "function"
  ) {

    try {

      window.goToPreviousSlide();

      return;

    } catch (_) {}
  }

  if (
    SNKBoard.pdf
  ) {

    renderPDFPage(
      Math.max(
        SNKBoard.pdfPage - 1,
        1
      )
    );

    return;
  }

  showToast(
    "Previous slide"
  );
}


/* =========================================================
   PDF.JS PAGE RENDER
   ========================================================= */

async function renderPDFPage(
  pageNumber
) {

  if (!SNKBoard.pdf) {

    showToast(
      "PDF open নেই"
    );

    return;
  }

  try {

    const page =
      await SNKBoard.pdf.getPage(
        pageNumber
      );

    SNKBoard.pdfPage =
      pageNumber;

    const pdfCanvas =
      document.querySelector(
        "#pdfCanvas"
      );

    if (!pdfCanvas) {

      showToast(
        `PDF page ${pageNumber}`
      );

      return;
    }

    const context =
      pdfCanvas.getContext(
        "2d"
      );

    const baseViewport =
      page.getViewport({
        scale: 1
      });

    const stageWidth =
      boardStage
        ? boardStage.clientWidth
        : 1280;

    const stageHeight =
      boardStage
        ? boardStage.clientHeight
        : 720;

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
      viewport.width;

    pdfCanvas.height =
      viewport.height;

    await page.render({

      canvasContext:
        context,

      viewport

    }).promise;

    pdfCanvas.style.display =
      "block";

    showToast(
      `PDF ${pageNumber}/${SNKBoard.pdfTotalPages}`
    );

  } catch (error) {

    console.error(
      "PDF render error:",
      error
    );

    showToast(
      "PDF render failed"
    );
  }
}


/* =========================================================
   OPEN PDF
   ========================================================= */

async function openPDFFile(
  file
) {

  if (!file) return;

  if (
    !window.pdfjsLib
  ) {

    showToast(
      "PDF.js পাওয়া যায়নি"
    );

    return;
  }

  try {

    const arrayBuffer =
      await file.arrayBuffer();

    SNKBoard.pdf =
      await window.pdfjsLib.getDocument({
        data: arrayBuffer
      }).promise;

    SNKBoard.pdfTotalPages =
      SNKBoard.pdf.numPages;

    SNKBoard.pdfPage =
      1;

    await renderPDFPage(
      1
    );

  } catch (error) {

    console.error(
      "PDF open error:",
      error
    );

    showToast(
      "PDF open failed"
    );
  }
}


/* =========================================================
   PDF INPUT
   ========================================================= */

function setupPDFInput() {

  const input =
    document.querySelector(
      "#pdfInput"
    );

  if (!input) return;

  input.addEventListener(
    "change",
    event => {

      const file =
        event.target.files &&
        event.target.files[0];

      if (file) {

        openPDFFile(
          file
        );
      }

    }
  );
}


/* =========================================================
   ZOOM
   ========================================================= */

function zoomIn() {

  SNKBoard.zoom =
    Math.min(
      3,
      SNKBoard.zoom + 0.1
    );

  applyBoardZoom();

  showToast(
    `Zoom ${Math.round(
      SNKBoard.zoom * 100
    )}%`
  );
}


function zoomOut() {

  SNKBoard.zoom =
    Math.max(
      0.3,
      SNKBoard.zoom - 0.1
    );

  applyBoardZoom();

  showToast(
    `Zoom ${Math.round(
      SNKBoard.zoom * 100
    )}%`
  );
}


function resetZoom() {

  SNKBoard.zoom =
    1;

  applyBoardZoom();

  showToast(
    "Zoom 100%"
  );
}


function applyBoardZoom() {

  const target =
    document.querySelector(
      "#boardWorkspace"
    ) ||
    document.querySelector(
      ".board-workspace"
    ) ||
    boardStage;

  if (!target) return;

  target.style.transform =
    `scale(${SNKBoard.zoom})`;

  target.style.transformOrigin =
    "center center";
}


/* =========================================================
   CAMERA CONTROL
   ========================================================= */

async function cameraOn() {

  if (
    typeof window.startCamera ===
    "function"
  ) {

    try {

      await window.startCamera();

      SNKBoard.cameraOn =
        true;

      showToast(
        "Camera ON"
      );

      return;

    } catch (error) {

      console.error(
        error
      );
    }
  }

  const video =
    document.querySelector(
      "#mentorVideo"
    );

  if (!video) {

    showToast(
      "Camera element পাওয়া যায়নি"
    );

    return;
  }

  try {

    const stream =
      await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      });

    video.srcObject =
      stream;

    await video.play();

    SNKBoard.cameraOn =
      true;

    showToast(
      "Camera ON"
    );

  } catch (error) {

    console.error(
      "Camera error:",
      error
    );

    showToast(
      "Camera permission প্রয়োজন"
    );
  }
}


function cameraOff() {

  if (
    typeof window.stopCamera ===
    "function"
  ) {

    try {

      window.stopCamera();

      SNKBoard.cameraOn =
        false;

      showToast(
        "Camera OFF"
      );

      return;

    } catch (_) {}
  }

  const video =
    document.querySelector(
      "#mentorVideo"
    );

  if (!video) return;

  const stream =
    video.srcObject;

  if (stream) {

    stream
      .getTracks()
      .forEach(
        track =>
          track.stop()
      );
  }

  video.srcObject =
    null;

  SNKBoard.cameraOn =
    false;

  showToast(
    "Camera OFF"
  );
}


function toggleCamera() {

  if (
    SNKBoard.cameraOn
  ) {

    cameraOff();

  } else {

    cameraOn();
  }
}


/* =========================================================
   CAMERA MIRROR
   ========================================================= */

function cameraMirror(
  enabled
) {

  SNKBoard.cameraMirror =
    Boolean(enabled);

  const video =
    document.querySelector(
      "#mentorVideo"
    );

  if (video) {

    video.style.transform =
      SNKBoard.cameraMirror
        ? "scaleX(-1)"
        : "scaleX(1)";
  }

  const cameraCanvas =
    document.querySelector(
      "#cameraProcessedCanvas"
    );

  if (cameraCanvas) {

    cameraCanvas.style.transform =
      SNKBoard.cameraMirror
        ? "scaleX(-1)"
        : "scaleX(1)";
  }

  showToast(
    SNKBoard.cameraMirror
      ? "Camera Mirror ON"
      : "Camera Mirror OFF"
  );
}


/* =========================================================
   CAMERA MOVE
   ========================================================= */

function cameraMove(
  direction
) {

  if (
    typeof window.moveCamera ===
    "function"
  ) {

    try {

      window.moveCamera(
        direction
      );

      return;

    } catch (_) {}
  }

  const camera =
    document.querySelector(
      "#mentorCamera" 
    ) ||
    document.querySelector(
      "#mentorVideo"
    );

  if (!camera) {

    showToast(
      `Camera ${direction}`
    );

    return;
  }

  const step =
    20;

  const currentLeft =
    parseFloat(
      camera.style.left
    ) || 0;

  const currentTop =
    parseFloat(
      camera.style.top
    ) || 0;

  if (
    direction === "left"
  ) {

    camera.style.left =
      `${currentLeft - step}px`;

  } else if (
    direction === "right"
  ) {

    camera.style.left =
      `${currentLeft + step}px`;

  } else if (
    direction === "up"
  ) {

    camera.style.top =
      `${currentTop - step}px`;

  } else if (
    direction === "down"
  ) {

    camera.style.top =
      `${currentTop + step}px`;
  }
}


/* =========================================================
   CAMERA RESIZE
   ========================================================= */

function cameraResize(
  action
) {

  if (
    typeof window.resizeCamera ===
    "function"
  ) {

    try {

      window.resizeCamera(
        action
      );

      return;

    } catch (_) {}
  }

  const camera =
    document.querySelector(
      "#mentorCamera"
    ) ||
    document.querySelector(
      "#mentorVideo"
    );

  if (!camera) return;

  const currentWidth =
    parseFloat(
      camera.style.width
    ) ||
    camera.offsetWidth;

  const currentHeight =
    parseFloat(
      camera.style.height
    ) ||
    camera.offsetHeight;

  const amount =
    20;

  let width =
    currentWidth;

  let height =
    currentHeight;

  if (
    action === "increase"
  ) {

    width += amount;
    height += amount * 0.7;

  } else if (
    action === "decrease"
  ) {

    width -= amount;
    height -= amount * 0.7;
  }

  width =
    Math.max(
      120,
      Math.min(
        700,
        width
      )
    );

  height =
    Math.max(
      80,
      Math.min(
        500,
        height
      )
    );

  camera.style.width =
    `${width}px`;

  camera.style.height =
    `${height}px`;
}


/* =========================================================
   RECORDING BRIDGE
   ========================================================= */

async function startRecording() {

  if (
    typeof window.startRecording ===
    "function"
  ) {

    try {

      await window.startRecording();

      SNKBoard.recording =
        true;

      showToast(
        "Recording started"
      );

      return;

    } catch (error) {

      console.error(
        error
      );
    }
  }

  if (
    typeof window.startClassRecording ===
    "function"
  ) {

    try {

      await window.startClassRecording();

      SNKBoard.recording =
        true;

      showToast(
        "Recording started"
      );

      return;

    } catch (error) {

      console.error(
        error
      );
    }
  }

  showToast(
    "Recording engine পাওয়া যায়নি"
  );
}


function pauseRecording() {

  if (
    typeof window.pauseRecording ===
    "function"
  ) {

    try {

      window.pauseRecording();

      showToast(
        "Recording paused"
      );

      return;

    } catch (_) {}
  }

  if (
    typeof window.mediaRecorder !==
    "undefined" &&
    window.mediaRecorder
  ) {

    if (
      window.mediaRecorder.state ===
      "recording"
    ) {

      window.mediaRecorder.pause();

      showToast(
        "Recording paused"
      );

      return;
    }
  }

  showToast(
    "Pause unavailable"
  );
}


function resumeRecording() {

  if (
    typeof window.resumeRecording ===
    "function"
  ) {

    try {

      window.resumeRecording();

      showToast(
        "Recording resumed"
      );

      return;

    } catch (_) {}
  }

  if (
    typeof window.mediaRecorder !==
    "undefined" &&
    window.mediaRecorder
  ) {

    if (
      window.mediaRecorder.state ===
      "paused"
    ) {

      window.mediaRecorder.resume();

      showToast(
        "Recording resumed"
      );

      return;
    }
  }

  showToast(
    "Resume unavailable"
  );
}


function stopRecording() {

  if (
    typeof window.stopRecording ===
    "function"
  ) {

    try {

      window.stopRecording();

      SNKBoard.recording =
        false;

      showToast(
        "Recording stopped"
      );

      return;

    } catch (_) {}
  }

  if (
    typeof window.mediaRecorder !==
    "undefined" &&
    window.mediaRecorder
  ) {

    if (
      window.mediaRecorder.state !==
      "inactive"
    ) {

      window.mediaRecorder.stop();

      SNKBoard.recording =
        false;

      showToast(
        "Recording stopped"
      );

      return;
    }
  }

  showToast(
    "Recording unavailable"
  );
}


/* =========================================================
   GENERIC EXISTING FUNCTION CALLER
   ========================================================= */

function callExistingFunction(
  names,
  ...args
) {

  for (
    const name of names
  ) {

    if (
      typeof window[name] ===
      "function" &&
      window[name] !==
      callExistingFunction
    ) {

      try {

        return window[name](
          ...args
        );

      } catch (error) {

        console.warn(
          `Function ${name} failed:`,
          error
        );
      }
    }
  }

  return undefined;
}


/* =========================================================
   WIRELESS POINTER DOWN
   ========================================================= */

function wirelessPointerDown(
  payload
) {

  if (!payload) return;

  const point =
    wirelessCoordinates(
      Number(payload.x) || 0,
      Number(payload.y) || 0
    );

  SNKBoard.wirelessDrawing =
    true;

  SNKBoard.lastX =
    point.x;

  SNKBoard.lastY =
    point.y;

  if (payload.tool) {

    SNKBoard.tool =
      payload.tool;
  }

  if (payload.color) {

    SNKBoard.color =
      payload.color;
  }

  if (payload.size) {

    SNKBoard.size =
      Number(payload.size);
  }

  saveUndoState();
}


/* =========================================================
   WIRELESS POINT BATCH
   ========================================================= */

function wirelessPointerBatch(
  payload
) {

  if (
    !SNKBoard.wirelessDrawing
  ) {

    return;
  }

  if (
    !payload ||
    !Array.isArray(
      payload.points
    )
  ) {

    return;
  }

  for (
    const pointData of
    payload.points
  ) {

    const point =
      wirelessCoordinates(
        Number(pointData.x) || 0,
        Number(pointData.y) || 0
      );

    drawSegment(
      SNKBoard.lastX,
      SNKBoard.lastY,
      point.x,
      point.y,
      Number(
        pointData.pressure
      ) || 0.5
    );

    SNKBoard.lastX =
      point.x;

    SNKBoard.lastY =
      point.y;
  }
}


/* =========================================================
   WIRELESS POINTER UP
   ========================================================= */

function wirelessPointerUp() {

  SNKBoard.wirelessDrawing =
    false;

  resetDrawingState();
}


/* =========================================================
   WIRELESS COMMAND RECEIVER
   ========================================================= */

window.SNKSmartBoardReceiveCommand =
  function(command) {

    if (!command) return;

    const commandId =
      command.id;

    if (
      commandId &&
      SNKBoard.processedCommands.has(
        commandId
      )
    ) {

      return;
    }

    if (commandId) {

      SNKBoard.processedCommands.add(
        commandId
      );

      if (
        SNKBoard.processedCommands.size >
        1000
      ) {

        const first =
          SNKBoard.processedCommands
            .values()
            .next()
            .value;

        SNKBoard.processedCommands.delete(
          first
        );
      }
    }

    const type =
      command.type;

    const payload =
      command.payload || {};

    switch (type) {

      /* -------------------------------------
         DRAWING
         ------------------------------------- */

      case "pointerdown":

        wirelessPointerDown(
          payload
        );

        break;


      case "pointerbatch":

        wirelessPointerBatch(
          payload
        );

        break;


      case "pointermove":

        wirelessPointerBatch({
          points: [
            payload
          ]
        });

        break;


      case "pointerup":

        wirelessPointerUp();

        break;


      /* -------------------------------------
         TOOLS
         ------------------------------------- */

      case "tool":

        SNKBoard.tool =
          payload.tool ||
          "pen";

        break;


      case "color":

        SNKBoard.color =
          payload.color ||
          "#1e88ff";

        break;


      case "size":

        SNKBoard.size =
          Number(
            payload.size
          ) || 4;

        break;


      /* -------------------------------------
         BOARD
         ------------------------------------- */

      case "undo":

        undoBoard();

        break;


      case "redo":

        redoBoard();

        break;


      case "clear":

        clearBoard();

        break;


      case "new":

        newBoardPage();

        break;


      /* -------------------------------------
         PAGE
         ------------------------------------- */

      case "nextPage":

        nextBoardPage();

        break;


      case "previousPage":

        previousBoardPage();

        break;


      case "deletePage":

        callExistingFunction(
          [
            "deletePage",
            "removeCurrentPage"
          ]
        );

        break;


      /* -------------------------------------
         PDF / SLIDE
         ------------------------------------- */

      case "nextSlide":

        nextSlide();

        break;


      case "previousSlide":

        previousSlide();

        break;


      case "openPDF":

        callExistingFunction(
          [
            "openPDF",
            "showPDFPicker"
          ]
        );

        break;


      /* -------------------------------------
         ZOOM
         ------------------------------------- */

      case "zoomIn":

        zoomIn();

        break;


      case "zoomOut":

        zoomOut();

        break;


      case "zoomReset":

        resetZoom();

        break;


      /* -------------------------------------
         CAMERA
         ------------------------------------- */

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

        cameraMirror(
          payload.enabled
        );

        break;


      case "cameraMove":

        cameraMove(
          payload.direction
        );

        break;


      case "cameraResize":

        cameraResize(
          payload.action
        );

        break;


      /* -------------------------------------
         RECORDING
         ------------------------------------- */

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

        console.warn(
          "Unknown wireless command:",
          type,
          payload
        );

    }

  };


/* =========================================================
   FIREBASE WIRELESS LISTENER
   ========================================================= */

function startWirelessFirebaseListener() {

  const firebase =
    window.SNKFirebase;

  const pairing =
    window.SNKSmartBoardPairing;

  if (!firebase) {

    console.warn(
      "SNKFirebase not found."
    );

    return;
  }

  if (
    !pairing ||
    !pairing.state ||
    !pairing.state.sessionPath
  ) {

    console.warn(
      "SNKSmartBoardPairing session path not found."
    );

    return;
  }

  const sessionPath =
    pairing.state.sessionPath;

  let commandsRef = null;

  try {

    if (firebase.ref) {

      commandsRef =
        firebase.ref(
          `${sessionPath}/commands`
        );

    } else if (
      firebase.database &&
      firebase.database.ref
    ) {

      commandsRef =
        firebase.database.ref(
          `${sessionPath}/commands`
        );
    }

  } catch (error) {

    console.error(
      "Firebase listener error:",
      error
    );

    return;
  }

  if (!commandsRef) {

    console.warn(
      "Commands reference unavailable."
    );

    return;
  }

  commandsRef.on(
    "child_added",
    snapshot => {

      const command =
        snapshot.val();

      if (!command) return;

      window.SNKSmartBoardReceiveCommand(
        command
      );

    }
  );

  console.log(
    "SNK Smart Board wireless listener started."
  );
}


/* =========================================================
   FIREBASE AUTO RETRY
   ========================================================= */

let wirelessRetryTimer =
  null;


function initializeWirelessReceiver() {

  if (
    window.SNKFirebase &&
    window.SNKSmartBoardPairing &&
    window.SNKSmartBoardPairing.state &&
    window.SNKSmartBoardPairing.state.sessionPath
  ) {

    startWirelessFirebaseListener();

    return;
  }

  clearTimeout(
    wirelessRetryTimer
  );

  wirelessRetryTimer =
    setTimeout(
      initializeWirelessReceiver,
      1000
    );
}


/* =========================================================
   RESIZE
   ========================================================= */

window.addEventListener(
  "resize",
  () => {

    resizeBoardCanvas();

  }
);


/* =========================================================
   SETUP LOCAL DRAWING
   ========================================================= */

function setupLocalDrawing() {

  if (!boardCanvas) {

    console.warn(
      "drawingCanvas not found."
    );

    return;
  }

  boardCanvas.style.touchAction =
    "none";

  boardCanvas.addEventListener(
    "pointerdown",
    localPointerDown
  );

  boardCanvas.addEventListener(
    "pointermove",
    localPointerMove
  );

  boardCanvas.addEventListener(
    "pointerup",
    localPointerUp
  );

  boardCanvas.addEventListener(
    "pointercancel",
    localPointerUp
  );
}


/* =========================================================
   TOOL BUTTONS
   ========================================================= */

function setupToolButtons() {

  document
    .querySelectorAll(
      "[data-tool]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          SNKBoard.tool =
            button.dataset.tool;

        }
      );

    });
}


/* =========================================================
   COLOR BUTTONS
   ========================================================= */

function setupColorButtons() {

  document
    .querySelectorAll(
      "[data-color]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          SNKBoard.color =
            button.dataset.color;

        }
      );

    });
}


/* =========================================================
   SIZE CONTROL
   ========================================================= */

function setupSizeControl() {

  const sizeInput =
    document.querySelector(
      "#brushSize"
    );

  if (!sizeInput) return;

  sizeInput.addEventListener(
    "input",
    () => {

      SNKBoard.size =
        Number(
          sizeInput.value
        ) || 4;

    }
  );

}


/* =========================================================
   KEYBOARD SHORTCUTS
   ========================================================= */

document.addEventListener(
  "keydown",
  event => {

    if (
      event.ctrlKey &&
      event.key.toLowerCase() === "z"
    ) {

      event.preventDefault();

      undoBoard();

      return;
    }

    if (
      event.ctrlKey &&
      event.key.toLowerCase() === "y"
    ) {

      event.preventDefault();

      redoBoard();

      return;
    }

    if (
      event.key === "Escape"
    ) {

      SNKBoard.drawing =
        false;

      SNKBoard.wirelessDrawing =
        false;

      resetDrawingState();
    }

  }
);


/* =========================================================
   INITIALIZATION
   ========================================================= */

function initializeSmartBoard() {

  resizeBoardCanvas();

  setupLocalDrawing();

  setupToolButtons();

  setupColorButtons();

  setupSizeControl();

  setupPDFInput();

  setTimeout(
    initializeWirelessReceiver,
    500
  );

  console.log(
    "SNK Smart Board Step 11.2.5 loaded."
  );
}


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


/* =========================================================
   GLOBAL API
   ========================================================= */

window.SNKSmartBoard = {

  state:
    SNKBoard,

  undo:
    undoBoard,

  redo:
    redoBoard,

  clear:
    clearBoard,

  newPage:
    newBoardPage,

  nextPage:
    nextBoardPage,

  previousPage:
    previousBoardPage,

  nextSlide,

  previousSlide,

  zoomIn,

  zoomOut,

  resetZoom,

  cameraOn,

  cameraOff,

  cameraMirror,

  cameraMove,

  cameraResize,

  startRecording,

  pauseRecording,

  resumeRecording,

  stopRecording

};
