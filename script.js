/* =========================================================
   SNK SMART BOARD
   MAIN JAVASCRIPT
   STEP 4
   ========================================================= */


/* =========================================================
   PDF.JS SETUP
   ========================================================= */

if (window.pdfjsLib) {

  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

}


/* =========================================================
   ELEMENTS
   ========================================================= */

const board =
  document.getElementById("board");

const canvas =
  document.getElementById("drawingCanvas");

const ctx =
  canvas.getContext("2d");

const mediaLayer =
  document.getElementById("mediaLayer");

const emptyBoard =
  document.getElementById("emptyBoard");

const imageInput =
  document.getElementById("imageInput");

const pdfInput =
  document.getElementById("pdfInput");

const pdfLayer =
  document.getElementById("pdfLayer");

const pdfCanvas =
  document.getElementById("pdfCanvas");

const pdfCtx =
  pdfCanvas.getContext("2d");

const pdfFileName =
  document.getElementById("pdfFileName");

const pdfPageIndicator =
  document.getElementById("pdfPageIndicator");

const pdfZoomValue =
  document.getElementById("pdfZoomValue");

const pageIndicator =
  document.getElementById("pageIndicator");

const currentToolText =
  document.getElementById("currentTool");

const currentSizeText =
  document.getElementById("currentSize");

const colorPreview =
  document.getElementById("colorPreview");

const saveStatus =
  document.getElementById("saveStatus");

const toast =
  document.getElementById("toast");


/* =========================================================
   DRAWING VARIABLES
   ========================================================= */

let currentTool =
  "pen";

let currentColor =
  "#111111";

let currentSize =
  4;

let isDrawing =
  false;

let lastX =
  0;

let lastY =
  0;


/* =========================================================
   BOARD PAGES
   ========================================================= */

let boardPages = [];

let currentBoardPage =
  0;


/*
  Every board page contains:

  {
    imageData: "",
    media: []
  }
*/


/* =========================================================
   PDF VARIABLES
   ========================================================= */

let currentPdf = null;

let currentPdfPage =
  1;

let pdfTotalPages =
  0;

let pdfScale =
  1;

let pdfRenderTask =
  null;


/* =========================================================
   HISTORY
   ========================================================= */

let undoStack = [];

let redoStack = [];


/* =========================================================
   INITIALIZE
   ========================================================= */

window.addEventListener("load", () => {

  initializeBoard();

  resizeCanvas();

  window.addEventListener(
    "resize",
    resizeCanvas
  );

  updateUI();

});


/* =========================================================
   INITIALIZE BOARD
   ========================================================= */

function initializeBoard() {

  boardPages = [

    {
      imageData: null,
      media: [],
      pdf: null
    }

  ];

  currentBoardPage = 0;

  restoreCurrentBoardPage();

}


/* =========================================================
   CANVAS SIZE
   ========================================================= */

function resizeCanvas() {

  const oldImage =
    canvas.width > 0 && canvas.height > 0
      ? canvas.toDataURL()
      : null;


  const rect =
    board.getBoundingClientRect();


  const width =
    Math.max(
      1,
      Math.floor(rect.width)
    );


  const height =
    Math.max(
      1,
      Math.floor(rect.height)
    );


  canvas.width =
    width;

  canvas.height =
    height;


  ctx.lineCap =
    "round";

  ctx.lineJoin =
    "round";


  if (oldImage) {

    const image =
      new Image();

    image.onload = () => {

      ctx.drawImage(
        image,
        0,
        0,
        canvas.width,
        canvas.height
      );

    };

    image.src =
      oldImage;
  }


  updateEmptyState();

}


/* =========================================================
   GET POINTER POSITION
   ========================================================= */

function getPointerPosition(event) {

  const rect =
    canvas.getBoundingClientRect();


  const scaleX =
    canvas.width /
    rect.width;


  const scaleY =
    canvas.height /
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
   DRAWING START
   ========================================================= */

canvas.addEventListener(
  "pointerdown",
  startDrawing
);


canvas.addEventListener(
  "pointermove",
  draw
);


canvas.addEventListener(
  "pointerup",
  stopDrawing
);


canvas.addEventListener(
  "pointercancel",
  stopDrawing
);


canvas.addEventListener(
  "pointerleave",
  stopDrawing
);


/* =========================================================
   START DRAWING
   ========================================================= */

function startDrawing(event) {

  if (
    event.pointerType === "mouse" &&
    event.button !== 0
  ) {

    return;

  }


  closePanels();


  isDrawing =
    true;


  canvas.setPointerCapture?.(
    event.pointerId
  );


  const point =
    getPointerPosition(event);


  lastX =
    point.x;

  lastY =
    point.y;


  saveState();


  ctx.beginPath();

  ctx.moveTo(
    lastX,
    lastY
  );


  ctx.lineWidth =
    currentSize;


  if (currentTool === "eraser") {

    ctx.globalCompositeOperation =
      "destination-out";

    ctx.strokeStyle =
      "rgba(0,0,0,1)";

  } else {

    ctx.globalCompositeOperation =
      "source-over";

    ctx.strokeStyle =
      currentColor;

  }


  if (currentTool === "marker") {

    ctx.globalAlpha =
      0.35;

    ctx.lineWidth =
      currentSize * 3;

  } else {

    ctx.globalAlpha =
      1;

  }


  ctx.lineTo(
    lastX + 0.01,
    lastY + 0.01
  );

  ctx.stroke();

}


/* =========================================================
   DRAW
   ========================================================= */

function draw(event) {

  if (!isDrawing) {

    return;

  }


  const point =
    getPointerPosition(event);


  ctx.lineWidth =
    currentTool === "marker"
      ? currentSize * 3
      : currentSize;


  ctx.lineTo(
    point.x,
    point.y
  );


  ctx.stroke();


  lastX =
    point.x;

  lastY =
    point.y;


  updateSaveStatus();
}


/* =========================================================
   STOP DRAWING
   ========================================================= */

function stopDrawing() {

  if (!isDrawing) {

    return;

  }


  isDrawing =
    false;


  ctx.closePath();

  ctx.globalAlpha =
    1;

  ctx.globalCompositeOperation =
    "source-over";


  saveCurrentPageData();

  updateEmptyState();

}


/* =========================================================
   SET TOOL
   ========================================================= */

function setTool(tool) {

  currentTool =
    tool;


  document
    .querySelectorAll(".tool-btn")
    .forEach(button => {

      button.classList.remove(
        "active"
      );

    });


  if (tool === "pen") {

    document
      .getElementById("penTool")
      .classList.add("active");

  }


  if (tool === "marker") {

    document
      .getElementById("markerTool")
      .classList.add("active");

  }


  if (tool === "eraser") {

    document
      .getElementById("eraserTool")
      .classList.add("active");

  }


  currentToolText.textContent =
    tool.charAt(0).toUpperCase() +
    tool.slice(1);


  if (tool === "eraser") {

    canvas.style.cursor =
      "cell";

  } else {

    canvas.style.cursor =
      "crosshair";

  }


  showToast(
    tool.charAt(0).toUpperCase() +
    tool.slice(1) +
    " selected"
  );

}


/* =========================================================
   COLOR PANEL
   ========================================================= */

function openColorPanel() {

  closePanels();

  document
    .getElementById("colorPanel")
    .classList.add("show");

}


/* =========================================================
   SIZE PANEL
   ========================================================= */

function openSizePanel() {

  closePanels();

  document
    .getElementById("sizePanel")
    .classList.add("show");

}


/* =========================================================
   CLOSE PANELS
   ========================================================= */

function closePanels() {

  document
    .querySelectorAll(".floating-panel")
    .forEach(panel => {

      panel.classList.remove(
        "show"
      );

    });

}


/* =========================================================
   SET COLOR
   ========================================================= */

function setColor(color) {

  currentColor =
    color;


  colorPreview.style.background =
    color;


  closePanels();


  if (currentTool === "eraser") {

    setTool("pen");

  }


  showToast(
    "Color changed"
  );


  updateSaveStatus();

}


/* =========================================================
   SET SIZE
   ========================================================= */

function setSize(size) {

  currentSize =
    Number(size);


  currentSizeText.textContent =
    currentSize;


  closePanels();


  showToast(
    "Pen size: " +
    currentSize +
    " px"
  );


  updateSaveStatus();

}


/* =========================================================
   SAVE CURRENT PAGE
   ========================================================= */

function saveCurrentPageData() {

  if (!boardPages[currentBoardPage]) {

    return;

  }


  boardPages[currentBoardPage].imageData =
    canvas.toDataURL(
      "image/png"
    );


  boardPages[currentBoardPage].media =
    collectMediaData();


  boardPages[currentBoardPage].pdf =
    currentPdf
      ? {
          name:
            pdfFileName.textContent,

          page:
            currentPdfPage,

          total:
            pdfTotalPages,

          scale:
            pdfScale
        }

      : null;

}


/* =========================================================
   COLLECT MEDIA
   ========================================================= */

function collectMediaData() {

  const items =
    [];


  document
    .querySelectorAll(
      ".uploaded-media"
    )
    .forEach(item => {

      const img =
        item.querySelector("img");


      if (!img) {

        return;

      }


      items.push({

        src:
          img.src,

        left:
          item.style.left,

        top:
          item.style.top,

        width:
          item.style.width,

        height:
          item.style.height,

        name:
          item.dataset.name ||
          "Image"

      });

    });


  return items;

}


/* =========================================================
   SAVE STATE FOR UNDO
   ========================================================= */

function saveState() {

  undoStack.push(
    canvas.toDataURL(
      "image/png"
    )
  );


  if (
    undoStack.length >
    30
  ) {

    undoStack.shift();

  }


  redoStack = [];

}


/* =========================================================
   UNDO
   ========================================================= */

function undoDrawing() {

  if (
    undoStack.length === 0
  ) {

    showToast(
      "Nothing to undo"
    );

    return;

  }


  redoStack.push(
    canvas.toDataURL(
      "image/png"
    )
  );


  const previous =
    undoStack.pop();


  restoreCanvasFromData(
    previous
  );


  saveCurrentPageData();

  updateSaveStatus();

}


/* =========================================================
   REDO
   ========================================================= */

function redoDrawing() {

  if (
    redoStack.length === 0
  ) {

    showToast(
      "Nothing to redo"
    );

    return;

  }


  undoStack.push(
    canvas.toDataURL(
      "image/png"
    )
  );


  const next =
    redoStack.pop();


  restoreCanvasFromData(
    next
  );


  saveCurrentPageData();

  updateSaveStatus();

}


/* =========================================================
   RESTORE CANVAS
   ========================================================= */

function restoreCanvasFromData(
  data
) {

  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );


  if (!data) {

    updateEmptyState();

    return;

  }


  const image =
    new Image();


  image.onload = () => {

    ctx.drawImage(
      image,
      0,
      0,
      canvas.width,
      canvas.height
    );


    updateEmptyState();

  };


  image.src =
    data;

}


/* =========================================================
   CLEAR CURRENT PAGE
   ========================================================= */

function clearCurrentPage() {

  const confirmed =
    confirm(
      "Clear everything from this page?"
    );


  if (!confirmed) {

    return;

  }


  saveState();


  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );


  mediaLayer.innerHTML =
    "";


  removePdf();


  saveCurrentPageData();


  updateEmptyState();

  updateSaveStatus();


  showToast(
    "Current page cleared"
  );

}


/* =========================================================
   NEW BOARD
   ========================================================= */

function newBoard() {

  const confirmed =
    confirm(
      "Create a new blank board?"
    );


  if (!confirmed) {

    return;

  }


  boardPages = [

    {
      imageData: null,
      media: [],
      pdf: null
    }

  ];


  currentBoardPage =
    0;


  currentPdf =
    null;


  currentPdfPage =
    1;


  pdfTotalPages =
    0;


  pdfScale =
    1;


  undoStack = [];

  redoStack = [];


  restoreCurrentBoardPage();


  showToast(
    "New board created"
  );

}


/* =========================================================
   ADD BOARD PAGE
   ========================================================= */

function addBoardPage() {

  saveCurrentPageData();


  boardPages.splice(
    currentBoardPage + 1,
    0,
    {
      imageData: null,
      media: [],
      pdf: null
    }
  );


  currentBoardPage++;


  undoStack = [];

  redoStack = [];


  restoreCurrentBoardPage();


  showToast(
    "New page added"
  );

}


/* =========================================================
   PREVIOUS BOARD PAGE
   ========================================================= */

function previousBoardPage() {

  if (
    currentBoardPage <= 0
  ) {

    showToast(
      "Already on first page"
    );

    return;

  }


  saveCurrentPageData();


  currentBoardPage--;


  undoStack = [];

  redoStack = [];


  restoreCurrentBoardPage();

}


/* =========================================================
   NEXT BOARD PAGE
   ========================================================= */

function nextBoardPage() {

  if (
    currentBoardPage >=
    boardPages.length - 1
  ) {

    addBoardPage();

    return;

  }


  saveCurrentPageData();


  currentBoardPage++;


  undoStack = [];

  redoStack = [];


  restoreCurrentBoardPage();

}


/* =========================================================
   RESTORE CURRENT BOARD PAGE
   ========================================================= */

function restoreCurrentBoardPage() {

  const page =
    boardPages[
      currentBoardPage
    ];


  if (!page) {

    return;

  }


  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );


  mediaLayer.innerHTML =
    "";


  currentPdf =
    null;


  pdfLayer.classList.remove(
    "active"
  );


  undoStack = [];

  redoStack = [];


  if (page.imageData) {

    restoreCanvasFromData(
      page.imageData
    );

  }


  if (
    page.media &&
    page.media.length
  ) {

    page.media.forEach(
      media => {

        createImageElement(
          media.src,
          media.name,
          media.left,
          media.top,
          media.width,
          media.height
        );

      }
    );

  }


  if (page.pdf) {

    /*
      PDF binary is not stored in localStorage.
      Therefore the page remembers PDF info,
      but the user must upload the PDF again
      after a complete browser refresh.
    */

    showToast(
      "PDF page data remembered. Re-upload PDF after refresh."
    );

  }


  updatePageIndicator();

  updateEmptyState();

}


/* =========================================================
   PAGE INDICATOR
   ========================================================= */

function updatePageIndicator() {

  pageIndicator.textContent =
    "Page " +
    (currentBoardPage + 1) +
    " / " +
    boardPages.length;

}


/* =========================================================
   IMAGE UPLOAD
   ========================================================= */

function openImageUpload() {

  imageInput.value =
    "";

  imageInput.click();

}


/* =========================================================
   IMAGE CHANGE
   ========================================================= */

imageInput.addEventListener(
  "change",
  event => {

    const file =
      event.target.files?.[0];


    if (!file) {

      return;

    }


    if (
      !file.type.startsWith(
        "image/"
      )
    ) {

      showToast(
        "Please select an image"
      );

      return;

    }


    const reader =
      new FileReader();


    reader.onload =
      function(e) {

        createImageElement(
          e.target.result,
          file.name
        );


        saveCurrentPageData();

        updateEmptyState();

        showToast(
          "Image added"
        );

      };


    reader.readAsDataURL(
      file
    );

  }
);


/* =========================================================
   CREATE IMAGE ELEMENT
   ========================================================= */

function createImageElement(
  src,
  name,
  left,
  top,
  width,
  height
) {

  const wrapper =
    document.createElement(
      "div"
    );


  wrapper.className =
    "uploaded-media";


  wrapper.dataset.name =
    name ||
    "Image";


  wrapper.style.left =
    left ||
    "50%";


  wrapper.style.top =
    top ||
    "50%";


  wrapper.style.width =
    width ||
    "360px";


  wrapper.style.height =
    height ||
    "260px";


  if (!left) {

    wrapper.style.transform =
      "translate(-50%, -50%)";

  }


  const image =
    document.createElement(
      "img"
    );


  image.src =
    src;


  image.alt =
    name ||
    "Uploaded image";


  wrapper.appendChild(
    image
  );


  addMediaControls(
    wrapper
  );


  mediaLayer.appendChild(
    wrapper
  );


  enableMediaDrag(
    wrapper
  );


  updateEmptyState();


  return wrapper;

}


/* =========================================================
   MEDIA CONTROLS
   ========================================================= */

function addMediaControls(
  wrapper
) {

  const controls =
    document.createElement(
      "div"
    );


  controls.className =
    "media-controls";


  const label =
    document.createElement(
      "span"
    );


  label.className =
    "media-name";


  label.textContent =
    wrapper.dataset.name;


  const smaller =
    createMediaButton(
      "−",
      "Shrink image"
    );


  const bigger =
    createMediaButton(
      "+",
      "Enlarge image"
    );


  const remove =
    createMediaButton(
      "✕",
      "Remove image"
    );


  smaller.onclick =
    event => {

      event.stopPropagation();

      resizeMedia(
        wrapper,
        0.9
      );

    };


  bigger.onclick =
    event => {

      event.stopPropagation();

      resizeMedia(
        wrapper,
        1.1
      );

    };


  remove.onclick =
    event => {

      event.stopPropagation();

      wrapper.remove();

      saveCurrentPageData();

      updateEmptyState();

      showToast(
        "Image removed"
      );

    };


  controls.appendChild(
    label
  );

  controls.appendChild(
    smaller
  );

  controls.appendChild(
    bigger
  );

  controls.appendChild(
    remove
  );


  wrapper.appendChild(
    controls
  );


  wrapper.addEventListener(
    "pointerdown",
    () => {

      document
        .querySelectorAll(
          ".uploaded-media"
        )
        .forEach(item => {

          item.classList.remove(
            "selected"
          );

        });


      wrapper.classList.add(
        "selected"
      );

    }
  );

}


/* =========================================================
   CREATE MEDIA BUTTON
   ========================================================= */

function createMediaButton(
  text,
  title
) {

  const button =
    document.createElement(
      "button"
    );


  button.type =
    "button";


  button.textContent =
    text;


  button.title =
    title;


  return button;

}


/* =========================================================
   RESIZE MEDIA
   ========================================================= */

function resizeMedia(
  wrapper,
  factor
) {

  const currentWidth =
    parseFloat(
      getComputedStyle(
        wrapper
      ).width
    );


  const currentHeight =
    parseFloat(
      getComputedStyle(
        wrapper
      ).height
    );


  const newWidth =
    Math.max(
      100,
      Math.min(
        currentWidth * factor,
        board.clientWidth * 0.85
      )
    );


  const newHeight =
    Math.max(
      70,
      Math.min(
        currentHeight * factor,
        board.clientHeight * 0.85
      )
    );


  wrapper.style.width =
    newWidth + "px";


  wrapper.style.height =
    newHeight + "px";


  saveCurrentPageData();

}


/* =========================================================
   DRAG IMAGE
   ========================================================= */

function enableMediaDrag(
  element
) {

  let dragging =
    false;

  let startX =
    0;

  let startY =
    0;

  let originalLeft =
    0;

  let originalTop =
    0;


  element.addEventListener(
    "pointerdown",
    event => {

      if (
        event.target.closest(
          ".media-controls"
        )
      ) {

        return;

      }


      dragging =
        true;


      element.setPointerCapture?.(
        event.pointerId
      );


      const boardRect =
        board.getBoundingClientRect();


      const elementRect =
        element.getBoundingClientRect();


      startX =
        event.clientX;


      startY =
        event.clientY;


      originalLeft =
        elementRect.left -
        boardRect.left;


      originalTop =
        elementRect.top -
        boardRect.top;


      element.style.left =
        originalLeft + "px";


      element.style.top =
        originalTop + "px";


      element.style.transform =
        "none";


      event.stopPropagation();

    }
  );


  element.addEventListener(
    "pointermove",
    event => {

      if (!dragging) {

        return;

      }


      const dx =
        event.clientX -
        startX;


      const dy =
        event.clientY -
        startY;


      let newLeft =
        originalLeft + dx;


      let newTop =
        originalTop + dy;


      const width =
        element.offsetWidth;


      const height =
        element.offsetHeight;


      const maxLeft =
        Math.max(
          0,
          board.clientWidth -
          width
        );


      const maxTop =
        Math.max(
          0,
          board.clientHeight -
          height
        );


      newLeft =
        Math.max(
          0,
          Math.min(
            newLeft,
            maxLeft
          )
        );


      newTop =
        Math.max(
          0,
          Math.min(
            newTop,
            maxTop
          )
        );


      element.style.left =
        newLeft + "px";


      element.style.top =
        newTop + "px";

    }
  );


  element.addEventListener(
    "pointerup",
    () => {

      if (!dragging) {

        return;

      }


      dragging =
        false;


      saveCurrentPageData();

    }
  );


  element.addEventListener(
    "pointercancel",
    () => {

      dragging =
        false;

    }
  );

}


/* =========================================================
   PDF UPLOAD
   ========================================================= */

function openPdfUpload() {

  pdfInput.value =
    "";

  pdfInput.click();

}


/* =========================================================
   PDF INPUT
   ========================================================= */

pdfInput.addEventListener(
  "change",
  async event => {

    const file =
      event.target.files?.[0];


    if (!file) {

      return;

    }


    if (
      file.type !==
      "application/pdf"
    ) {

      showToast(
        "Please select a PDF file"
      );

      return;

    }


    await loadPdfFile(
      file
    );

  }
);


/* =========================================================
   LOAD PDF
   ========================================================= */

async function loadPdfFile(
  file
) {

  try {

    if (!window.pdfjsLib) {

      showToast(
        "PDF library could not load"
      );

      return;

    }


    const arrayBuffer =
      await file.arrayBuffer();


    const typedArray =
      new Uint8Array(
        arrayBuffer
      );


    currentPdf =
      await pdfjsLib.getDocument(
        {
          data:
            typedArray
        }
      ).promise;


    pdfTotalPages =
      currentPdf.numPages;


    currentPdfPage =
      1;


    pdfScale =
      1;


    pdfFileName.textContent =
      file.name;


    pdfLayer.classList.add(
      "active"
    );


    await renderPdfPage();


    updatePdfControls();


    /*
      Remember that a PDF is loaded
      on this board page.
    */

    boardPages[currentBoardPage].pdf =
      {
        name:
          file.name,

        page:
          currentPdfPage,

        total:
          pdfTotalPages,

        scale:
          pdfScale
      };


    updateEmptyState();

    showToast(
      "PDF loaded"
    );

  } catch (error) {

    console.error(
      error
    );


    showToast(
      "Could not open PDF"
    );

  }

}


/* =========================================================
   RENDER PDF PAGE
   ========================================================= */

async function renderPdfPage() {

  if (!currentPdf) {

    return;

  }


  try {

    if (pdfRenderTask) {

      try {

        pdfRenderTask.cancel();

      } catch (e) {}

    }


    const page =
      await currentPdf.getPage(
        currentPdfPage
      );


    const viewport =
      page.getViewport(
        {
          scale:
            pdfScale
        }
      );


    pdfCanvas.width =
      viewport.width;


    pdfCanvas.height =
      viewport.height;


    pdfCanvas.style.width =
      viewport.width + "px";


    pdfCanvas.style.height =
      viewport.height + "px";


    pdfRenderTask =
      page.render(
        {
          canvasContext:
            pdfCtx,

          viewport:
            viewport
        }
      );


    await pdfRenderTask.promise;


    pdfRenderTask =
      null;


    updatePdfControls();


    boardPages[currentBoardPage].pdf =
      {
        name:
          pdfFileName.textContent,

        page:
          currentPdfPage,

        total:
          pdfTotalPages,

        scale:
          pdfScale
      };


    updateSaveStatus();

  } catch (error) {

    if (
      error?.name !==
      "RenderingCancelledException"
    ) {

      console.error(
        error
      );

    }

  }

}


/* =========================================================
   PREVIOUS PDF PAGE
   ========================================================= */

async function previousPdfPage() {

  if (!currentPdf) {

    return;

  }


  if (
    currentPdfPage <= 1
  ) {

    showToast(
      "Already on first PDF page"
    );

    return;

  }


  currentPdfPage--;


  await renderPdfPage();

}


/* =========================================================
   NEXT PDF PAGE
   ========================================================= */

async function nextPdfPage() {

  if (!currentPdf) {

    return;

  }


  if (
    currentPdfPage >=
    pdfTotalPages
  ) {

    showToast(
      "Already on last PDF page"
    );

    return;

  }


  currentPdfPage++;


  await renderPdfPage();

}


/* =========================================================
   PDF ZOOM IN
   ========================================================= */

async function zoomPdfIn() {

  if (!currentPdf) {

    return;

  }


  pdfScale =
    Math.min(
      3,
      pdfScale + 0.25
    );


  await renderPdfPage();

}


/* =========================================================
   PDF ZOOM OUT
   ========================================================= */

async function zoomPdfOut() {

  if (!currentPdf) {

    return;

  }


  pdfScale =
    Math.max(
      0.5,
      pdfScale - 0.25
    );


  await renderPdfPage();

}


/* =========================================================
   UPDATE PDF CONTROLS
   ========================================================= */

function updatePdfControls() {

  pdfPageIndicator.textContent =
    currentPdf
      ? currentPdfPage +
        " / " +
        pdfTotalPages
      : "0 / 0";


  pdfZoomValue.textContent =
    Math.round(
      pdfScale * 100
    ) +
    "%";

}


/* =========================================================
   REMOVE PDF
   ========================================================= */

function removePdf() {

  currentPdf =
    null;


  pdfTotalPages =
    0;


  currentPdfPage =
    1;


  pdfScale =
    1;


  pdfLayer.classList.remove(
    "active"
  );


  updatePdfControls();


  if (
    boardPages[currentBoardPage]
  ) {

    boardPages[currentBoardPage].pdf =
      null;

  }


  updateEmptyState();

}


/* =========================================================
   EMPTY STATE
   ========================================================= */

function updateEmptyState() {

  const hasDrawing =
    hasCanvasContent();


  const hasMedia =
    mediaLayer.children.length >
    0;


  const hasPdf =
    !!currentPdf;


  if (
    hasDrawing ||
    hasMedia ||
    hasPdf
  ) {

    emptyBoard.classList.add(
      "hidden"
    );

  } else {

    emptyBoard.classList.remove(
      "hidden"
    );

  }

}


/* =========================================================
   CHECK CANVAS CONTENT
   ========================================================= */

function hasCanvasContent() {

  if (
    canvas.width === 0 ||
    canvas.height === 0
  ) {

    return false;

  }


  const pixels =
    ctx.getImageData(
      0,
      0,
      canvas.width,
      canvas.height
    ).data;


  for (
    let i = 3;
    i < pixels.length;
    i += 4
  ) {

    if (
      pixels[i] !== 0
    ) {

      return true;

    }

  }


  return false;

}


/* =========================================================
   DOWNLOAD BOARD
   ========================================================= */

async function downloadBoard() {

  /*
    Current version exports the drawing canvas.

    PDF/image export as a combined image
    will be added in a later step.
  */


  const link =
    document.createElement(
      "a"
    );


  link.download =
    "snk-smart-board-page-" +
    (currentBoardPage + 1) +
    ".png";


  link.href =
    canvas.toDataURL(
      "image/png"
    );


  link.click();


  saveStatus.textContent =
    "Page downloaded";


  showToast(
    "Board page saved as PNG"
  );

}


/* =========================================================
   FULLSCREEN
   ========================================================= */

function toggleFullscreen() {

  const element =
    document.documentElement;


  if (
    !document.fullscreenElement
  ) {

    element
      .requestFullscreen?.();

  } else {

    document
      .exitFullscreen?.();

  }

}


/* =========================================================
   TOAST
   ========================================================= */

let toastTimer;


function showToast(
  message
) {

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
   SAVE STATUS
   ========================================================= */

function updateSaveStatus() {

  saveStatus.textContent =
    "Changes saved locally";


  clearTimeout(
    window.saveStatusTimer
  );


  window.saveStatusTimer =
    setTimeout(
      () => {

        saveStatus.textContent =
          "All changes saved locally";

      },
      1200
    );

}


/* =========================================================
   UPDATE UI
   ========================================================= */

function updateUI() {

  currentToolText.textContent =
    "Pen";


  currentSizeText.textContent =
    currentSize;


  colorPreview.style.background =
    currentColor;


  updatePageIndicator();

  updatePdfControls();

  updateEmptyState();

}


/* =========================================================
   BOARD CLICK
   ========================================================= */

board.addEventListener(
  "pointerdown",
  event => {

    /*
      Do not close panels when clicking
      inside media controls.
    */

    if (
      event.target.closest(
        ".media-controls"
      )
    ) {

      return;

    }


    closePanels();

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

      undoDrawing();

    }


    /*
      Ctrl + Y
    */

    if (
      event.ctrlKey &&
      event.key.toLowerCase() === "y"
    ) {

      event.preventDefault();

      redoDrawing();

    }


    /*
      Escape
    */

    if (
      event.key === "Escape"
    ) {

      closePanels();

    }

  }
);


/* =========================================================
   BOARD TITLE
   ========================================================= */

document
  .getElementById("boardTitle")
  .addEventListener(
    "input",
    () => {

      updateSaveStatus();

    }
  );


/* =========================================================
   BEFORE UNLOAD
   ========================================================= */

window.addEventListener(
  "beforeunload",
  () => {

    saveCurrentPageData();

  }
);
