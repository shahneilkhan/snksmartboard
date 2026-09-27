/* =========================================================
   SNK SMART BOARD
   STEP 8
   PDF.JS + DRAWING + RECORDING
========================================================= */


/* =========================================================
   PDF.JS CONFIG
========================================================= */

if (window.pdfjsLib) {

  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

}


/* =========================================================
   DOM
========================================================= */

const boardStage =
  document.getElementById("boardStage");

const drawingCanvas =
  document.getElementById("drawingCanvas");

const drawingCtx =
  drawingCanvas.getContext("2d");

const pdfLayer =
  document.getElementById("pdfLayer");

const pdfCanvas =
  document.getElementById("pdfCanvas");

const pdfCtx =
  pdfCanvas.getContext("2d");

const imageLayer =
  document.getElementById("imageLayer");

const textLayer =
  document.getElementById("textLayer");

const welcomeScreen =
  document.getElementById("welcomeScreen");

const colorPicker =
  document.getElementById("colorPicker");

const sizeSlider =
  document.getElementById("sizeSlider");

const sizeValue =
  document.getElementById("sizeValue");

const currentToolLabel =
  document.getElementById("currentToolLabel");

const boardStatus =
  document.getElementById("boardStatus");

const toast =
  document.getElementById("toast");

const toastMessage =
  document.getElementById("toastMessage");

const imageInput =
  document.getElementById("imageInput");

const pdfInput =
  document.getElementById("pdfInput");

const imageControls =
  document.getElementById("imageControls");

const pdfControls =
  document.getElementById("pdfControls");

const pdfPageInfo =
  document.getElementById("pdfPageInfo");

const pdfZoomValue =
  document.getElementById("pdfZoomValue");

const recordingIndicator =
  document.getElementById("recordingIndicator");

const recordTimer =
  document.getElementById("recordTimer");

const modalRecordTimer =
  document.getElementById("modalRecordTimer");

const recordModal =
  document.getElementById("recordModal");

const recordSetup =
  document.getElementById("recordSetup");

const recordActive =
  document.getElementById("recordActive");

const recordResult =
  document.getElementById("recordResult");

const recordPreview =
  document.getElementById("recordPreview");

const downloadRecordingBtn =
  document.getElementById("downloadRecordingBtn");

const infoBoards =
  document.getElementById("infoBoards");

const infoPdfPages =
  document.getElementById("infoPdfPages");

const infoRecording =
  document.getElementById("infoRecording");

const notesArea =
  document.getElementById("notesArea");


/* =========================================================
   STATE
========================================================= */

let currentTool = "pen";

let currentColor =
  colorPicker.value;

let brushSize =
  Number(sizeSlider.value);

let isDrawing = false;

let lastX = 0;
let lastY = 0;

let startX = 0;
let startY = 0;


/* =========================================================
   BOARD STATE
========================================================= */

let pages = [

  {
    drawing: null,
    image: null,
    pdf: null,
    texts: [],
    notes: ""
  }

];

let currentPageIndex = 0;


/* =========================================================
   PDF STATE
========================================================= */

let currentPdf = null;

let currentPdfPage = 1;

let currentPdfZoom = 1;

let pdfRendering = false;


/* =========================================================
   BOARD ZOOM
========================================================= */

let boardZoom = 1;


/* =========================================================
   HISTORY
========================================================= */

let undoStack = [];

let redoStack = [];

let historyBusy = false;


/* =========================================================
   RECORDING STATE
========================================================= */

let mediaRecorder = null;

let recordedChunks = [];

let recordingStream = null;

let microphoneStream = null;

let recordCanvas = null;

let recordCtx = null;

let recordingAnimation = null;

let recordingTimer = null;

let recordingSeconds = 0;

let isRecording = false;

let isPaused = false;

let currentRecordingUrl = null;


/* =========================================================
   HELPER
========================================================= */

function showToast(message) {

  toastMessage.textContent = message;

  toast.classList.add("show");

  clearTimeout(showToast.timer);

  showToast.timer =
    setTimeout(() => {

      toast.classList.remove("show");

    }, 2200);

}


/* =========================================================
   CANVAS RESIZE
========================================================= */

function resizeCanvas() {

  const rect =
    boardStage.getBoundingClientRect();

  if (!rect.width || !rect.height) {
    return;
  }


  let oldCanvas = document.createElement("canvas");

  oldCanvas.width =
    drawingCanvas.width;

  oldCanvas.height =
    drawingCanvas.height;


  if (
    drawingCanvas.width &&
    drawingCanvas.height
  ) {

    oldCanvas
      .getContext("2d")
      .drawImage(
        drawingCanvas,
        0,
        0
      );

  }


  drawingCanvas.width =
    Math.floor(rect.width);

  drawingCanvas.height =
    Math.floor(rect.height);


  drawingCtx.clearRect(
    0,
    0,
    drawingCanvas.width,
    drawingCanvas.height
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
      drawingCanvas.width,
      drawingCanvas.height
    );

  }

}


/* =========================================================
   INITIALIZE
========================================================= */

window.addEventListener(
  "load",
  () => {

    resizeCanvas();

    setTimeout(
      resizeCanvas,
      200
    );

    updateBoardUI();

    saveHistory();

  }
);


window.addEventListener(
  "resize",
  () => {

    resizeCanvas();

  }
);


/* =========================================================
   POINTER POSITION
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
   DRAWING SETTINGS
========================================================= */

function configureBrush() {

  if (currentTool === "eraser") {

    drawingCtx.globalCompositeOperation =
      "destination-out";

    drawingCtx.globalAlpha = 1;

    drawingCtx.strokeStyle =
      "rgba(0,0,0,1)";

  }

  else if (currentTool === "marker") {

    drawingCtx.globalCompositeOperation =
      "source-over";

    drawingCtx.globalAlpha = 0.25;

    drawingCtx.strokeStyle =
      currentColor;

  }

  else {

    drawingCtx.globalCompositeOperation =
      "source-over";

    drawingCtx.globalAlpha = 1;

    drawingCtx.strokeStyle =
      currentColor;

  }


  drawingCtx.lineWidth =
    brushSize;

  drawingCtx.lineCap =
    "round";

  drawingCtx.lineJoin =
    "round";

}


/* =========================================================
   POINTER DOWN
========================================================= */

drawingCanvas.addEventListener(
  "pointerdown",
  event => {

    event.preventDefault();

    const pos =
      getPointerPosition(event);


    if (currentTool === "text") {

      createTextInput(
        pos.x,
        pos.y
      );

      return;

    }


    if (
      currentTool === "line" ||
      currentTool === "rectangle"
    ) {

      isDrawing = true;

      startX = pos.x;
      startY = pos.y;

      return;

    }


    isDrawing = true;

    lastX = pos.x;
    lastY = pos.y;

    configureBrush();

    drawingCtx.beginPath();

    drawingCtx.moveTo(
      lastX,
      lastY
    );


    drawingCanvas.setPointerCapture(
      event.pointerId
    );

  }
);


/* =========================================================
   POINTER MOVE
========================================================= */

drawingCanvas.addEventListener(
  "pointermove",
  event => {

    if (!isDrawing) {
      return;
    }

    event.preventDefault();

    const pos =
      getPointerPosition(event);


    if (
      currentTool === "line" ||
      currentTool === "rectangle"
    ) {

      redrawCurrentPageDrawing();

      configureBrush();

      drawingCtx.globalCompositeOperation =
        "source-over";

      drawingCtx.globalAlpha = 1;

      drawingCtx.strokeStyle =
        currentColor;

      drawingCtx.lineWidth =
        brushSize;


      drawingCtx.beginPath();


      if (currentTool === "line") {

        drawingCtx.moveTo(
          startX,
          startY
        );

        drawingCtx.lineTo(
          pos.x,
          pos.y
        );

      }

      else {

        drawingCtx.rect(
          startX,
          startY,
          pos.x - startX,
          pos.y - startY
        );

      }


      drawingCtx.stroke();

      return;

    }


    configureBrush();

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
   POINTER UP
========================================================= */

drawingCanvas.addEventListener(
  "pointerup",
  event => {

    if (!isDrawing) {
      return;
    }

    isDrawing = false;

    drawingCtx.closePath();

    drawingCtx.globalAlpha = 1;

    drawingCtx.globalCompositeOperation =
      "source-over";


    saveCurrentPageDrawing();

    saveHistory();

  }
);


drawingCanvas.addEventListener(
  "pointercancel",
  () => {

    isDrawing = false;

  }
);


/* =========================================================
   SAVE DRAWING TO PAGE
========================================================= */

function saveCurrentPageDrawing() {

  if (!drawingCanvas.width) {
    return;
  }

  pages[currentPageIndex].drawing =
    drawingCanvas.toDataURL(
      "image/png"
    );

}


/* =========================================================
   REDRAW PAGE DRAWING
========================================================= */

function redrawCurrentPageDrawing() {

  drawingCtx.clearRect(
    0,
    0,
    drawingCanvas.width,
    drawingCanvas.height
  );


  const drawing =
    pages[currentPageIndex].drawing;


  if (!drawing) {
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


  image.src = drawing;

}


/* =========================================================
   HISTORY
========================================================= */

function saveHistory() {

  if (historyBusy) {
    return;
  }


  const data =
    drawingCanvas.toDataURL(
      "image/png"
    );


  undoStack.push(data);

  if (undoStack.length > 30) {

    undoStack.shift();

  }


  redoStack = [];

}


function restoreHistory(data) {

  if (!data) {
    return;
  }


  const image =
    new Image();


  image.onload =
    () => {

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


      saveCurrentPageDrawing();

    };


  image.src = data;

}


/* =========================================================
   UNDO
========================================================= */

document
  .getElementById("undoBtn")
  .addEventListener(
    "click",
    () => {

      if (undoStack.length <= 1) {

        showToast(
          "Nothing to undo"
        );

        return;

      }


      historyBusy = true;


      const current =
        undoStack.pop();


      redoStack.push(
        current
      );


      const previous =
        undoStack[
          undoStack.length - 1
        ];


      restoreHistory(
        previous
      );


      setTimeout(
        () => {

          historyBusy = false;

        },
        100
      );

    }
  );


/* =========================================================
   REDO
========================================================= */

document
  .getElementById("redoBtn")
  .addEventListener(
    "click",
    () => {

      if (!redoStack.length) {

        showToast(
          "Nothing to redo"
        );

        return;

      }


      const next =
        redoStack.pop();


      undoStack.push(
        next
      );


      restoreHistory(
        next
      );

    }
  );


/* =========================================================
   CLEAR
========================================================= */

document
  .getElementById("clearBtn")
  .addEventListener(
    "click",
    () => {

      if (
        !confirm(
          "Clear all drawings from this board?"
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


      pages[currentPageIndex].drawing =
        null;


      saveHistory();

      showToast(
        "Board drawing cleared"
      );

    }
  );


/* =========================================================
   TOOLS
========================================================= */

document
  .querySelectorAll(".tool-btn[data-tool]")
  .forEach(
    button => {

      button.addEventListener(
        "click",
        () => {

          document
            .querySelectorAll(
              ".tool-btn[data-tool]"
            )
            .forEach(
              btn =>
                btn.classList.remove(
                  "active"
                )
            );


          button.classList.add(
            "active"
          );


          currentTool =
            button.dataset.tool;


          currentToolLabel.textContent =
            button.innerText.trim();


          if (
            currentTool === "text"
          ) {

            drawingCanvas.style.cursor =
              "text";

          }

          else {

            drawingCanvas.style.cursor =
              "crosshair";

          }

        }
      );

    }
  );


/* =========================================================
   COLOR
========================================================= */

colorPicker.addEventListener(
  "input",
  () => {

    currentColor =
      colorPicker.value;

  }
);


document
  .querySelectorAll(".quick-color")
  .forEach(
    button => {

      button.addEventListener(
        "click",
        () => {

          currentColor =
            button.dataset.color;

          colorPicker.value =
            currentColor;

        }
      );

    }
  );


/* =========================================================
   SIZE
========================================================= */

sizeSlider.addEventListener(
  "input",
  () => {

    brushSize =
      Number(
        sizeSlider.value
      );

    sizeValue.textContent =
      brushSize;

  }
);


/* =========================================================
   TEXT
========================================================= */

function createTextInput(
  x,
  y
) {

  const text =
    prompt(
      "Write your text:"
    );


  if (
    !text ||
    !text.trim()
  ) {

    return;

  }


  pages[currentPageIndex]
    .texts
    .push({

      text:
        text.trim(),

      x,
      y,

      color:
        currentColor,

      size:
        Math.max(
          18,
          brushSize * 4
        )

    });


  renderTextLayer();

  showToast(
    "Text added"
  );

}


function renderTextLayer() {

  textLayer.innerHTML = "";


  const texts =
    pages[currentPageIndex].texts || [];


  texts.forEach(
    item => {

      const div =
        document.createElement("div");


      div.className =
        "text-item";


      div.textContent =
        item.text;


      div.style.left =
        item.x + "px";


      div.style.top =
        item.y + "px";


      div.style.color =
        item.color;


      div.style.fontSize =
        item.size + "px";


      textLayer.appendChild(
        div
      );

    }
  );

}


/* =========================================================
   IMAGE UPLOAD
========================================================= */

document
  .getElementById("imageBtn")
  .addEventListener(
    "click",
    () => {

      imageInput.click();

    }
  );


document
  .getElementById("sideImageBtn")
  .addEventListener(
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
      e => {

        pages[currentPageIndex].image =
          e.target.result;


        pages[currentPageIndex].pdf =
          null;


        renderCurrentPage();

        showToast(
          "Image added to board"
        );

      };


    reader.readAsDataURL(
      file
    );


    imageInput.value = "";

  }
);


/* =========================================================
   IMAGE RENDER
========================================================= */

function renderImage() {

  imageLayer.innerHTML = "";


  const imageData =
    pages[currentPageIndex].image;


  if (!imageData) {

    imageLayer.classList.remove(
      "active"
    );

    imageControls.classList.remove(
      "active"
    );

    return;

  }


  const img =
    document.createElement("img");


  img.src =
    imageData;


  imageLayer.appendChild(
    img
  );


  imageLayer.classList.add(
    "active"
  );


  imageControls.classList.add(
    "active"
  );

}


/* =========================================================
   REMOVE IMAGE
========================================================= */

document
  .getElementById("removeImageBtn")
  .addEventListener(
    "click",
    () => {

      pages[currentPageIndex].image =
        null;


      renderImage();

      updateWelcomeState();

      showToast(
        "Image removed"
      );

    }
  );


/* =========================================================
   PDF BUTTONS
========================================================= */

document
  .getElementById("pdfBtn")
  .addEventListener(
    "click",
    () => {

      pdfInput.click();

    }
  );


document
  .getElementById("sidePdfBtn")
  .addEventListener(
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


    if (
      !window.pdfjsLib
    ) {

      showToast(
        "PDF engine could not load"
      );

      return;

    }


    try {

      showToast(
        "Loading PDF..."
      );


      const buffer =
        await file.arrayBuffer();


      const pdf =
        await pdfjsLib
          .getDocument({
            data: buffer
          })
          .promise;


      currentPdf =
        pdf;

      currentPdfPage =
        1;

      currentPdfZoom =
        1;


      pages[currentPageIndex].pdf = {

        pdf,

        page:
          1,

        zoom:
          1,

        name:
          file.name

      };


      pages[currentPageIndex].image =
        null;


      await renderPdfPage();


      pdfControls.classList.add(
        "active"
      );


      infoPdfPages.textContent =
        pdf.numPages;


      showToast(
        "PDF loaded successfully"
      );


    }
    catch (error) {

      console.error(
        error
      );


      showToast(
        "Could not load PDF"
      );

    }


    pdfInput.value = "";

  }
);


/* =========================================================
   RENDER PDF PAGE
========================================================= */

async function renderPdfPage() {

  if (
    !currentPdf ||
    pdfRendering
  ) {

    return;

  }


  pdfRendering = true;


  try {

    const page =
      await currentPdf.getPage(
        currentPdfPage
      );


    const baseViewport =
      page.getViewport({
        scale: 1
      });


    const stageWidth =
      boardStage.clientWidth - 20;


    const stageHeight =
      boardStage.clientHeight - 20;


    const widthScale =
      stageWidth /
      baseViewport.width;


    const heightScale =
      stageHeight /
      baseViewport.height;


    let fitScale =
      Math.min(
        widthScale,
        heightScale
      );


    if (!isFinite(fitScale) || fitScale <= 0) {

      fitScale = 1;

    }


    const finalScale =
      fitScale *
      currentPdfZoom;


    const viewport =
      page.getViewport({
        scale: finalScale
      });


    const pixelRatio =
      window.devicePixelRatio || 1;


    pdfCanvas.width =
      Math.floor(
        viewport.width *
        pixelRatio
      );


    pdfCanvas.height =
      Math.floor(
        viewport.height *
        pixelRatio
      );


    pdfCanvas.style.width =
      Math.floor(
        viewport.width
      ) + "px";


    pdfCanvas.style.height =
      Math.floor(
        viewport.height
      ) + "px";


    const renderContext = {

      canvasContext:
        pdfCtx,

      viewport,

      transform:
        pixelRatio !== 1
          ? [
              pixelRatio,
              0,
              0,
              pixelRatio,
              0,
              0
            ]
          : null

    };


    pdfCtx.clearRect(
      0,
      0,
      pdfCanvas.width,
      pdfCanvas.height
    );


    await page.render(
      renderContext
    ).promise;


    pdfLayer.classList.add(
      "active"
    );


    pdfPageInfo.textContent =
      `${currentPdfPage} / ${currentPdf.numPages}`;


    pdfZoomValue.textContent =
      `${Math.round(
        currentPdfZoom * 100
      )}%`;


    pages[currentPageIndex].pdf.page =
      currentPdfPage;

    pages[currentPageIndex].pdf.zoom =
      currentPdfZoom;


    updateWelcomeState();

  }
  catch (error) {

    console.error(
      error
    );

  }
  finally {

    pdfRendering = false;

  }

}


/* =========================================================
   PDF PREVIOUS
========================================================= */

document
  .getElementById("pdfPrevBtn")
  .addEventListener(
    "click",
    async () => {

      if (
        !currentPdf ||
        currentPdfPage <= 1
      ) {

        return;

      }


      currentPdfPage--;

      await renderPdfPage();

    }
  );


/* =========================================================
   PDF NEXT
========================================================= */

document
  .getElementById("pdfNextBtn")
  .addEventListener(
    "click",
    async () => {

      if (
        !currentPdf ||
        currentPdfPage >=
          currentPdf.numPages
      ) {

        return;

      }


      currentPdfPage++;

      await renderPdfPage();

    }
  );


/* =========================================================
   PDF ZOOM OUT
========================================================= */

document
  .getElementById("pdfZoomOutBtn")
  .addEventListener(
    "click",
    async () => {

      currentPdfZoom =
        Math.max(
          .5,
          currentPdfZoom - .1
        );


      await renderPdfPage();

    }
  );


/* =========================================================
   PDF ZOOM IN
========================================================= */

document
  .getElementById("pdfZoomInBtn")
  .addEventListener(
    "click",
    async () => {

      currentPdfZoom =
        Math.min(
          2.5,
          currentPdfZoom + .1
        );


      await renderPdfPage();

    }
  );


/* =========================================================
   CLOSE PDF
========================================================= */

document
  .getElementById("closePdfBtn")
  .addEventListener(
    "click",
    () => {

      currentPdf = null;

      pages[currentPageIndex].pdf =
        null;


      pdfLayer.classList.remove(
        "active"
      );


      pdfControls.classList.remove(
        "active"
      );


      pdfCtx.clearRect(
        0,
        0,
        pdfCanvas.width,
        pdfCanvas.height
      );


      updateWelcomeState();

      showToast(
        "PDF closed"
      );

    }
  );


/* =========================================================
   BOARD PAGE
========================================================= */

function addBoardPage() {

  saveCurrentPageDrawing();

  saveNotes();


  pages.push({

    drawing: null,

    image: null,

    pdf: null,

    texts: [],

    notes: ""

  });


  currentPageIndex =
    pages.length - 1;


  currentPdf = null;

  currentPdfPage = 1;

  currentPdfZoom = 1;


  undoStack = [];

  redoStack = [];


  resizeCanvas();

  renderCurrentPage();

  saveHistory();

  updateBoardUI();


  showToast(
    `Board ${pages.length} created`
  );

}


/* =========================================================
   ADD BOARD
========================================================= */

document
  .getElementById("addBoardBtn")
  .addEventListener(
    "click",
    addBoardPage
  );


/* =========================================================
   NEXT BOARD
========================================================= */

document
  .getElementById("nextBoardBtn")
  .addEventListener(
    "click",
    () => {

      if (
        currentPageIndex >=
        pages.length - 1
      ) {

        addBoardPage();

        return;

      }


      saveCurrentPageDrawing();

      saveNotes();


      currentPageIndex++;

      loadBoardPage();

    }
  );


/* =========================================================
   PREVIOUS BOARD
========================================================= */

document
  .getElementById("prevBoardBtn")
  .addEventListener(
    "click",
    () => {

      if (
        currentPageIndex <= 0
      ) {

        showToast(
          "This is the first board"
        );

        return;

      }


      saveCurrentPageDrawing();

      saveNotes();


      currentPageIndex--;

      loadBoardPage();

    }
  );


/* =========================================================
   LOAD BOARD PAGE
========================================================= */

function loadBoardPage() {

  undoStack = [];

  redoStack = [];


  resizeCanvas();


  drawingCtx.clearRect(
    0,
    0,
    drawingCanvas.width,
    drawingCanvas.height
  );


  currentPdf = null;


  pdfLayer.classList.remove(
    "active"
  );


  pdfControls.classList.remove(
    "active"
  );


  const page =
    pages[currentPageIndex];


  notesArea.value =
    page.notes || "";


  renderImage();

  renderTextLayer();


  if (
    page.pdf &&
    page.pdf.pdf
  ) {

    currentPdf =
      page.pdf.pdf;

    currentPdfPage =
      page.pdf.page || 1;

    currentPdfZoom =
      page.pdf.zoom || 1;


    renderPdfPage();

    pdfControls.classList.add(
      "active"
    );

  }


  redrawCurrentPageDrawing();


  setTimeout(
    () => {

      saveHistory();

    },
    100
  );


  updateBoardUI();

}


/* =========================================================
   RENDER CURRENT PAGE
========================================================= */

function renderCurrentPage() {

  const page =
    pages[currentPageIndex];


  welcomeScreen.classList.add(
    "hidden"
  );


  pdfLayer.classList.remove(
    "active"
  );


  pdfControls.classList.remove(
    "active"
  );


  currentPdf = null;


  if (
    page.pdf &&
    page.pdf.pdf
  ) {

    currentPdf =
      page.pdf.pdf;

    currentPdfPage =
      page.pdf.page || 1;

    currentPdfZoom =
      page.pdf.zoom || 1;


    renderPdfPage();

    pdfControls.classList.add(
      "active"
    );

  }


  renderImage();

  renderTextLayer();

  redrawCurrentPageDrawing();

  updateWelcomeState();

}


/* =========================================================
   WELCOME STATE
========================================================= */

function updateWelcomeState() {

  const page =
    pages[currentPageIndex];


  const hasContent =
    Boolean(
      page.drawing ||
      page.image ||
      page.pdf ||
      page.texts.length
    );


  if (hasContent) {

    welcomeScreen.classList.add(
      "hidden"
    );

  }
  else {

    welcomeScreen.classList.remove(
      "hidden"
    );

  }

}


/* =========================================================
   BOARD UI
========================================================= */

function updateBoardUI() {

  document
    .getElementById("boardPageInfo")
    .textContent =
      `Board ${
        currentPageIndex + 1
      } / ${
        pages.length
      }`;


  infoBoards.textContent =
    pages.length;


  updateWelcomeState();

}


/* =========================================================
   NOTES
========================================================= */

function saveNotes() {

  pages[currentPageIndex].notes =
    notesArea.value;

}


notesArea.addEventListener(
  "input",
  saveNotes
);


/* =========================================================
   NEW BOARD
========================================================= */

document
  .getElementById("newBoardBtn")
  .addEventListener(
    "click",
    () => {

      if (
        !confirm(
          "Start a new Smart Board session?"
        )
      ) {

        return;

      }


      pages = [

        {
          drawing: null,
          image: null,
          pdf: null,
          texts: [],
          notes: ""
        }

      ];


      currentPageIndex = 0;

      currentPdf = null;


      drawingCtx.clearRect(
        0,
        0,
        drawingCanvas.width,
        drawingCanvas.height
      );


      pdfLayer.classList.remove(
        "active"
      );


      pdfControls.classList.remove(
        "active"
      );


      imageLayer.classList.remove(
        "active"
      );


      imageControls.classList.remove(
        "active"
      );


      textLayer.innerHTML = "";


      notesArea.value = "";


      undoStack = [];

      redoStack = [];


      saveHistory();

      updateBoardUI();


      showToast(
        "New board created"
      );

    }
  );


/* =========================================================
   SAVE BOARD PNG
========================================================= */

document
  .getElementById("saveBtn")
  .addEventListener(
    "click",
    () => {

      const canvas =
        createCompositeCanvas();


      const link =
        document.createElement("a");


      link.download =
        `snk-smart-board-${
          Date.now()
        }.png`;


      link.href =
        canvas.toDataURL(
          "image/png"
        );


      link.click();


      showToast(
        "Board saved as PNG"
      );

    }
  );


/* =========================================================
   CREATE COMPOSITE CANVAS
========================================================= */

function createCompositeCanvas() {

  const width =
    drawingCanvas.width || 1280;

  const height =
    drawingCanvas.height || 720;


  const canvas =
    document.createElement("canvas");


  canvas.width =
    width;

  canvas.height =
    height;


  const ctx =
    canvas.getContext("2d");


  ctx.fillStyle =
    "#ffffff";


  ctx.fillRect(
    0,
    0,
    width,
    height
  );


  /*
     PDF
  */

  if (
    pdfLayer.classList.contains("active") &&
    pdfCanvas.width
  ) {

    const ratio =
      Math.min(
        width / pdfCanvas.width,
        height / pdfCanvas.height
      );


    const drawWidth =
      pdfCanvas.width *
      ratio;

    const drawHeight =
      pdfCanvas.height *
      ratio;


    const x =
      (width - drawWidth) / 2;

    const y =
      (height - drawHeight) / 2;


    ctx.drawImage(
      pdfCanvas,
      x,
      y,
      drawWidth,
      drawHeight
    );

  }


  /*
     IMAGE
  */

  const imageData =
    pages[currentPageIndex].image;


  if (imageData) {

    const img =
      new Image();


    img.src =
      imageData;


    /*
       Synchronous image drawing is
       not guaranteed before return.
       The recording loop uses a
       preloaded image cache separately.
    */

    if (img.complete) {

      const ratio =
        Math.min(
          width / img.naturalWidth,
          height / img.naturalHeight
        );


      const drawWidth =
        img.naturalWidth *
        ratio *
        .9;


      const drawHeight =
        img.naturalHeight *
        ratio *
        .9;


      ctx.drawImage(
        img,
        (width - drawWidth) / 2,
        (height - drawHeight) / 2,
        drawWidth,
        drawHeight
      );

    }

  }


  /*
     DRAWING
  */

  ctx.drawImage(
    drawingCanvas,
    0,
    0,
    width,
    height
  );


  /*
     TEXT
  */

  renderTextsOnCanvas(
    ctx,
    width,
    height
  );


  return canvas;

}


/* =========================================================
   DRAW TEXTS ON CANVAS
========================================================= */

function renderTextsOnCanvas(
  ctx,
  width,
  height
) {

  const texts =
    pages[currentPageIndex].texts || [];


  const scaleX =
    width /
    drawingCanvas.width;


  const scaleY =
    height /
    drawingCanvas.height;


  texts.forEach(
    item => {

      ctx.fillStyle =
        item.color ||
        "#111827";


      ctx.font =
        `600 ${
          (item.size || 24) *
          scaleY
        }px Arial`;


      const lines =
        String(item.text)
          .split("\n");


      lines.forEach(
        (line, index) => {

          ctx.fillText(
            line,
            item.x * scaleX,
            (
              item.y +
              (item.size || 24) *
              (index + 1)
            ) * scaleY
          );

        }
      );

    }
  );

}


/* =========================================================
   FULLSCREEN
========================================================= */

document
  .getElementById("fullscreenBtn")
  .addEventListener(
    "click",
    async () => {

      if (
        document.fullscreenElement
      ) {

        await document.exitFullscreen();

        document.body.classList.remove(
          "board-fullscreen"
        );

      }

      else {

        try {

          await document.documentElement
            .requestFullscreen();

        }
        catch (error) {

          console.error(
            error
          );

        }


        document.body.classList.add(
          "board-fullscreen"
        );

      }

    }
  );


document.addEventListener(
  "fullscreenchange",
  () => {

    if (
      !document.fullscreenElement
    ) {

      document.body.classList.remove(
        "board-fullscreen"
      );

    }

  }
);


/* =========================================================
   BOARD ZOOM
========================================================= */

function updateBoardZoom() {

  document
    .getElementById("boardZoomValue")
    .textContent =
      `${Math.round(
        boardZoom * 100
      )}%`;


  boardStage.style.transform =
    `scale(${boardZoom})`;

}


document
  .getElementById("zoomBoardIn")
  .addEventListener(
    "click",
    () => {

      boardZoom =
        Math.min(
          1.5,
          boardZoom + .1
        );

      updateBoardZoom();

    }
  );


document
  .getElementById("zoomBoardOut")
  .addEventListener(
    "click",
    () => {

      boardZoom =
        Math.max(
          .7,
          boardZoom - .1
        );

      updateBoardZoom();

    }
  );


/* =========================================================
   RECORDING MODAL
========================================================= */

function openRecordModal() {

  recordModal.classList.add(
    "active"
  );


  recordSetup.style.display =
    "block";

  recordActive.classList.remove(
    "active"
  );

  recordResult.classList.remove(
    "active"
  );

}


function closeRecordModal() {

  if (isRecording) {

    showToast(
      "Stop recording first"
    );

    return;

  }


  recordModal.classList.remove(
    "active"
  );

}


document
  .getElementById("recordBtn")
  .addEventListener(
    "click",
    openRecordModal
  );


document
  .getElementById("sideRecordBtn")
  .addEventListener(
    "click",
    openRecordModal
  );


document
  .getElementById("closeRecordModal")
  .addEventListener(
    "click",
    closeRecordModal
  );


/* =========================================================
   RECORDING MIME TYPE
========================================================= */

function getRecordingMimeType() {

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
   PREPARE RECORD CANVAS
========================================================= */

function prepareRecordCanvas() {

  recordCanvas =
    document.createElement("canvas");


  /*
     16:9 Full HD style recording.
  */

  recordCanvas.width =
    1280;

  recordCanvas.height =
    720;


  recordCtx =
    recordCanvas.getContext(
      "2d"
    );

}


/* =========================================================
   DRAW PDF ON RECORD CANVAS
========================================================= */

function drawPdfForRecording(
  ctx,
  width,
  height
) {

  if (
    !pdfLayer.classList.contains(
      "active"
    ) ||
    !pdfCanvas.width
  ) {

    return;

  }


  const ratio =
    Math.min(
      width / pdfCanvas.width,
      height / pdfCanvas.height
    );


  const drawWidth =
    pdfCanvas.width *
    ratio;


  const drawHeight =
    pdfCanvas.height *
    ratio;


  const x =
    (width - drawWidth) / 2;


  const y =
    (height - drawHeight) / 2;


  ctx.drawImage(
    pdfCanvas,
    x,
    y,
    drawWidth,
    drawHeight
  );

}


/* =========================================================
   IMAGE CACHE
========================================================= */

let recordingImageCache =
  null;


function prepareRecordingImage() {

  recordingImageCache = null;


  const imageData =
    pages[currentPageIndex].image;


  if (!imageData) {
    return;
  }


  const img =
    new Image();


  img.onload =
    () => {

      recordingImageCache =
        img;

    };


  img.src =
    imageData;

}


/* =========================================================
   DRAW IMAGE FOR RECORDING
========================================================= */

function drawImageForRecording(
  ctx,
  width,
  height
) {

  if (
    !recordingImageCache ||
    !recordingImageCache.complete
  ) {

    return;

  }


  const img =
    recordingImageCache;


  const ratio =
    Math.min(
      width / img.naturalWidth,
      height / img.naturalHeight
    );


  const drawWidth =
    img.naturalWidth *
    ratio *
    .9;


  const drawHeight =
    img.naturalHeight *
    ratio *
    .9;


  const x =
    (width - drawWidth) / 2;


  const y =
    (height - drawHeight) / 2;


  ctx.drawImage(
    img,
    x,
    y,
    drawWidth,
    drawHeight
  );

}


/* =========================================================
   RECORDING FRAME
========================================================= */

function renderRecordingFrame() {

  if (
    !recordCtx ||
    !recordCanvas
  ) {

    return;

  }


  const width =
    recordCanvas.width;

  const height =
    recordCanvas.height;


  /*
     Background
  */

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

  drawPdfForRecording(
    recordCtx,
    width,
    height
  );


  /*
     Image
  */

  drawImageForRecording(
    recordCtx,
    width,
    height
  );


  /*
     Drawing
  */

  recordCtx.drawImage(
    drawingCanvas,
    0,
    0,
    width,
    height
  );


  /*
     Text
  */

  renderTextsOnCanvas(
    recordCtx,
    width,
    height
  );


  /*
     Small SNK watermark
  */

  recordCtx.save();

  recordCtx.globalAlpha =
    .55;

  recordCtx.fillStyle =
    "#1976d2";

  recordCtx.font =
    "600 15px Arial";

  recordCtx.fillText(
    "SNK Smart Board",
    22,
    height - 22
  );

  recordCtx.restore();


  recordingAnimation =
    requestAnimationFrame(
      renderRecordingFrame
    );

}


/* =========================================================
   START TIMER
========================================================= */

function startRecordingTimer() {

  recordingSeconds = 0;


  updateRecordingTimer();


  recordingTimer =
    setInterval(
      () => {

        if (isPaused) {
          return;
        }

        recordingSeconds++;

        updateRecordingTimer();

      },
      1000
    );

}


function stopRecordingTimer() {

  clearInterval(
    recordingTimer
  );

  recordingTimer = null;

}


function formatTime(
  seconds
) {

  const minutes =
    Math.floor(
      seconds / 60
    );


  const secs =
    seconds % 60;


  return `${
    String(minutes).padStart(
      2,
      "0"
    )
  }:${
    String(secs).padStart(
      2,
      "0"
    )
  }`;

}


function updateRecordingTimer() {

  const time =
    formatTime(
      recordingSeconds
    );


  recordTimer.textContent =
    time;


  modalRecordTimer.textContent =
    time;

}


/* =========================================================
   START RECORDING
========================================================= */

async function startRecording() {

  if (isRecording) {
    return;
  }


  try {

    prepareRecordCanvas();

    prepareRecordingImage();


    /*
       Create video stream
    */

    const videoStream =
      recordCanvas.captureStream(
        30
      );


    recordingStream =
      new MediaStream();


    videoStream
      .getVideoTracks()
      .forEach(
        track => {

          recordingStream.addTrack(
            track
          );

        }
      );


    /*
       Microphone
    */

    const micEnabled =
      document.getElementById(
        "micToggle"
      ).checked;


    if (micEnabled) {

      try {

        microphoneStream =
          await navigator.mediaDevices
            .getUserMedia({

              audio: {

                echoCancellation:
                  true,

                noiseSuppression:
                  true,

                autoGainControl:
                  true

              }

            });


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
      catch (micError) {

        console.warn(
          micError
        );


        const continueWithoutMic =
          confirm(
            "Microphone permission was not available.\n\nContinue recording without microphone?"
          );


        if (!continueWithoutMic) {

          recordingStream
            .getTracks()
            .forEach(
              track =>
                track.stop()
            );

          return;

        }

      }

    }


    /*
       MediaRecorder
    */

    const mimeType =
      getRecordingMimeType();


    if (!mimeType) {

      throw new Error(
        "This browser does not support WebM recording."
      );

    }


    mediaRecorder =
      new MediaRecorder(
        recordingStream,
        {
          mimeType
        }
      );


    recordedChunks = [];


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
      handleRecordingStop;


    mediaRecorder.onerror =
      event => {

        console.error(
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


    startRecordingTimer();


    recordingIndicator.classList.add(
      "active"
    );


    document
      .getElementById("recordBtn")
      .classList.add(
        "recording"
      );


    document
      .getElementById("recordBtn")
      .innerHTML =
        "<span>■</span> Recording";


    infoRecording.textContent =
      "Recording";


    boardStatus.textContent =
      "Recording";


    recordSetup.style.display =
      "none";


    recordActive.classList.add(
      "active"
    );


    recordResult.classList.remove(
      "active"
    );


    renderRecordingFrame();


    showToast(
      "Class recording started"
    );

  }
  catch (error) {

    console.error(
      error
    );


    showToast(
      error.message ||
      "Could not start recording"
    );

  }

}


/* =========================================================
   START RECORD BUTTON
========================================================= */

document
  .getElementById("startRecordingBtn")
  .addEventListener(
    "click",
    startRecording
  );


/* =========================================================
   PAUSE / RESUME
========================================================= */

document
  .getElementById("pauseRecordingBtn")
  .addEventListener(
    "click",
    () => {

      if (
        !mediaRecorder ||
        !isRecording
      ) {

        return;

      }


      if (
        mediaRecorder.state ===
        "recording"
      ) {

        mediaRecorder.pause();

        isPaused = true;


        document
          .getElementById(
            "pauseRecordingBtn"
          )
          .textContent =
            "▶ Resume";


        boardStatus.textContent =
          "Recording Paused";


        showToast(
          "Recording paused"
        );

      }

      else if (
        mediaRecorder.state ===
        "paused"
      ) {

        mediaRecorder.resume();

        isPaused = false;


        document
          .getElementById(
            "pauseRecordingBtn"
          )
          .textContent =
            "⏸ Pause";


        boardStatus.textContent =
          "Recording";


        showToast(
          "Recording resumed"
        );

      }

    }
  );


/* =========================================================
   STOP RECORDING
========================================================= */

document
  .getElementById("stopRecordingBtn")
  .addEventListener(
    "click",
    () => {

      stopRecording();

    }
  );


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


  stopRecordingTimer();


  if (recordingAnimation) {

    cancelAnimationFrame(
      recordingAnimation
    );

    recordingAnimation =
      null;

  }


  isRecording = false;

}


/* =========================================================
   RECORDING STOP HANDLER
========================================================= */

function handleRecordingStop() {

  if (
    recordingStream
  ) {

    recordingStream
      .getTracks()
      .forEach(
        track =>
          track.stop()
      );

  }


  if (
    microphoneStream
  ) {

    microphoneStream
      .getTracks()
      .forEach(
        track =>
          track.stop()
      );

  }


  microphoneStream =
    null;

  recordingStream =
    null;


  recordingIndicator.classList.remove(
    "active"
  );


  document
    .getElementById("recordBtn")
    .classList.remove(
      "recording"
    );


  document
    .getElementById("recordBtn")
    .innerHTML =
      "<span>●</span> Record";


  infoRecording.textContent =
    "Ready";


  boardStatus.textContent =
    "Ready";


  recordActive.classList.remove(
    "active"
  );


  recordSetup.style.display =
    "none";


  recordResult.classList.add(
    "active"
  );


  const blob =
    new Blob(
      recordedChunks,
      {
        type:
          "video/webm"
      }
    );


  if (currentRecordingUrl) {

    URL.revokeObjectURL(
      currentRecordingUrl
    );

  }


  currentRecordingUrl =
    URL.createObjectURL(
      blob
    );


  recordPreview.src =
    currentRecordingUrl;


  recordPreview.load();


  downloadRecordingBtn.href =
    currentRecordingUrl;


  downloadRecordingBtn.download =
    `SNK-Smart-Board-Class-${
      Date.now()
    }.webm`;


  showToast(
    "Recording complete"
  );

}


/* =========================================================
   NEW RECORDING
========================================================= */

document
  .getElementById("newRecordingBtn")
  .addEventListener(
    "click",
    () => {

      recordResult.classList.remove(
        "active"
      );


      recordSetup.style.display =
        "block";


      recordPreview.removeAttribute(
        "src"
      );


      recordedChunks = [];

    }
  );


/* =========================================================
   KEYBOARD SHORTCUTS
========================================================= */

document.addEventListener(
  "keydown",
  event => {

    /*
       Ctrl + Z
    */

    if (
      event.ctrlKey &&
      event.key.toLowerCase() === "z"
    ) {

      event.preventDefault();

      document
        .getElementById(
          "undoBtn"
        )
        .click();

    }


    /*
       Ctrl + Y
    */

    if (
      event.ctrlKey &&
      event.key.toLowerCase() === "y"
    ) {

      event.preventDefault();

      document
        .getElementById(
          "redoBtn"
        )
        .click();

    }


    /*
       Escape
    */

    if (
      event.key === "Escape"
    ) {

      if (
        recordModal.classList.contains(
          "active"
        ) &&
        !isRecording
      ) {

        closeRecordModal();

      }

    }

  }
);


/* =========================================================
   SAVE BEFORE PAGE SWITCH
========================================================= */

window.addEventListener(
  "beforeunload",
  () => {

    saveCurrentPageDrawing();

    saveNotes();

  }
);


/* =========================================================
   INITIAL UI
========================================================= */

updateBoardZoom();

updateBoardUI();

showToast(
  "SNK Smart Board ready"
);
