/* =========================================================
   SNK SMART BOARD — MAIN JAVASCRIPT
   File: script.js

   STEP 13.11
   - Smart Board main controls
   - Drawing
   - Pen / Marker / Eraser
   - Undo / Redo / Clear
   - Image upload
   - PDF upload + navigation
   - Camera
   - Microphone
   - Recording
   - Zoom / Fullscreen
   - Firebase Controller Receiver
   ========================================================= */

(() => {
  "use strict";

  /* =======================================================
     STATE
     ======================================================= */

  const state = {
    tool: "pen",
    color: "#111827",
    brushSize: 5,

    drawing: false,
    lastX: 0,
    lastY: 0,

    history: [],
    historyIndex: -1,

    zoom: 100,

    cameraStream: null,
    cameraEnabled: false,
    cameraMirror: true,
    cameraShape: "rounded",
    cameraEffect: "none",

    microphoneStream: null,
    microphoneEnabled: false,

    mediaRecorder: null,
    recordedChunks: [],
    recording: false,
    recordingPaused: false,

    pdfDocument: null,
    pdfPage: 1,
    pdfTotalPages: 0,
    pdfScale: 1.2,

    cameraDrag: false,
    cameraResize: false,
    cameraDragOffsetX: 0,
    cameraDragOffsetY: 0,

    wirelessConnected: false,
    wirelessListenerAttached: false,
    wirelessUnsubscribe: null,

    initialized: false
  };

  /* =======================================================
     DOM
     ======================================================= */

  const $ = (selector, parent = document) =>
    parent.querySelector(selector);

  const $$ = (selector, parent = document) =>
    [...parent.querySelectorAll(selector)];

  const board = $(
    "#board, #smartBoard, #drawingBoard, canvas[data-board]"
  );

  const canvas =
    board && board.tagName === "CANVAS"
      ? board
      : $("#drawingCanvas, #boardCanvas, canvas");

  let ctx = null;

  const imageLayer =
    $("#imageLayer") ||
    $("#boardImageLayer") ||
    $(".image-layer");

  const pdfCanvas =
    $("#pdfCanvas") ||
    $("#pdfViewerCanvas") ||
    $(".pdf-canvas");

  const pdfCtx =
    pdfCanvas && pdfCanvas.getContext
      ? pdfCanvas.getContext("2d")
      : null;

  const cameraVideo =
    $("#cameraVideo") ||
    $("#cameraPreview") ||
    $("video[data-camera]") ||
    $("video");

  const cameraBox =
    $("#cameraBox") ||
    $("#cameraContainer") ||
    $(".camera-box") ||
    $(".camera-container");

  const micIndicator =
    $("#micIndicator") ||
    $("#microphoneIndicator");

  const recordingIndicator =
    $("#recordingIndicator") ||
    $("#recordingStatus");

  /* =======================================================
     SAFE ELEMENT HELPERS
     ======================================================= */

  function setText(selectors, value) {
    const list = Array.isArray(selectors)
      ? selectors
      : [selectors];

    list.forEach((selector) => {
      const element = $(selector);
      if (element) {
        element.textContent = value;
      }
    });
  }

  function showElement(element, show = true) {
    if (!element) return;

    element.hidden = !show;

    if (show) {
      element.style.display = "";
    } else {
      element.style.display = "none";
    }
  }

  function addClass(element, className) {
    if (element) element.classList.add(className);
  }

  function removeClass(element, className) {
    if (element) element.classList.remove(className);
  }

  /* =======================================================
     TOAST
     ======================================================= */

  function showToast(message, type = "info") {
    let toast =
      $("#smartBoardToast") ||
      $("#toast") ||
      $(".toast");

    if (!toast) {
      toast = document.createElement("div");
      toast.id = "smartBoardToast";

      Object.assign(toast.style, {
        position: "fixed",
        left: "50%",
        bottom: "28px",
        transform: "translateX(-50%)",
        zIndex: "99999",
        padding: "12px 18px",
        borderRadius: "12px",
        background: "#111827",
        color: "#ffffff",
        fontSize: "14px",
        fontWeight: "600",
        boxShadow: "0 10px 30px rgba(0,0,0,.18)",
        pointerEvents: "none",
        opacity: "0",
        transition: "opacity .2s ease"
      });

      document.body.appendChild(toast);
    }

    toast.textContent = message;

    if (type === "error") {
      toast.style.background = "#b91c1c";
    } else if (type === "success") {
      toast.style.background = "#047857";
    } else {
      toast.style.background = "#111827";
    }

    toast.style.opacity = "1";

    clearTimeout(showToast.timer);

    showToast.timer = setTimeout(() => {
      toast.style.opacity = "0";
    }, 2200);
  }

  /* =======================================================
     CANVAS SETUP
     ======================================================= */

  function setupCanvas() {
    if (!canvas) {
      console.warn("SNK Smart Board canvas not found.");
      return;
    }

    ctx = canvas.getContext("2d", {
      alpha: true
    });

    resizeCanvas(false);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    saveHistory();
  }

  function resizeCanvas(preserve = true) {
    if (!canvas || !ctx) return;

    const oldCanvas = document.createElement("canvas");
    const oldCtx = oldCanvas.getContext("2d");

    if (preserve && canvas.width && canvas.height) {
      oldCanvas.width = canvas.width;
      oldCanvas.height = canvas.height;

      try {
        oldCtx.drawImage(canvas, 0, 0);
      } catch (error) {
        console.warn(error);
      }
    }

    const rect = canvas.getBoundingClientRect();

    const width =
      Math.max(1, Math.round(rect.width)) ||
      canvas.clientWidth ||
      window.innerWidth;

    const height =
      Math.max(1, Math.round(rect.height)) ||
      canvas.clientHeight ||
      window.innerHeight;

    const ratio = window.devicePixelRatio || 1;

    canvas.width = width * ratio;
    canvas.height = height * ratio;

    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.setTransform(
      ratio,
      0,
      0,
      ratio,
      0,
      0
    );

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (preserve && oldCanvas.width && oldCanvas.height) {
      ctx.drawImage(
        oldCanvas,
        0,
        0,
        oldCanvas.width,
        oldCanvas.height,
        0,
        0,
        width,
        height
      );
    }
  }

  window.addEventListener("resize", () => {
    resizeCanvas(true);
  });

  /* =======================================================
     POINTER POSITION
     ======================================================= */

  function getPointerPosition(event) {
    if (!canvas) {
      return {
        x: 0,
        y: 0
      };
    }

    const rect = canvas.getBoundingClientRect();

    let clientX;
    let clientY;

    if (event.touches && event.touches.length) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else if (
      event.changedTouches &&
      event.changedTouches.length
    ) {
      clientX = event.changedTouches[0].clientX;
      clientY = event.changedTouches[0].clientY;
    } else {
      clientX = event.clientX;
      clientY = event.clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  /* =======================================================
     DRAWING
     ======================================================= */

  function startDrawing(event) {
    if (!canvas || !ctx) return;

    if (
      event.pointerType === "mouse" &&
      event.button !== 0
    ) {
      return;
    }

    event.preventDefault();

    const point = getPointerPosition(event);

    state.drawing = true;
    state.lastX = point.x;
    state.lastY = point.y;

    if (canvas.setPointerCapture) {
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch (error) {}
    }

    ctx.beginPath();
    ctx.moveTo(point.x, point.y);

    if (state.tool === "eraser") {
      ctx.globalCompositeOperation =
        "destination-out";
      ctx.lineWidth = state.brushSize * 2;
      ctx.strokeStyle = "rgba(0,0,0,1)";
    } else if (state.tool === "marker") {
      ctx.globalCompositeOperation =
        "source-over";
      ctx.lineWidth = state.brushSize * 2.4;
      ctx.strokeStyle = state.color;
      ctx.globalAlpha = 0.35;
    } else {
      ctx.globalCompositeOperation =
        "source-over";
      ctx.lineWidth = state.brushSize;
      ctx.strokeStyle = state.color;
      ctx.globalAlpha = 1;
    }

    ctx.lineTo(
      point.x + 0.01,
      point.y + 0.01
    );

    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation =
      "source-over";
  }

  function draw(event) {
    if (!state.drawing || !ctx) return;

    event.preventDefault();

    const point = getPointerPosition(event);

    if (state.tool === "eraser") {
      ctx.globalCompositeOperation =
        "destination-out";
      ctx.lineWidth = state.brushSize * 2;
      ctx.strokeStyle = "rgba(0,0,0,1)";
    } else if (state.tool === "marker") {
      ctx.globalCompositeOperation =
        "source-over";
      ctx.lineWidth = state.brushSize * 2.4;
      ctx.strokeStyle = state.color;
      ctx.globalAlpha = 0.35;
    } else {
      ctx.globalCompositeOperation =
        "source-over";
      ctx.lineWidth = state.brushSize;
      ctx.strokeStyle = state.color;
      ctx.globalAlpha = 1;
    }

    ctx.beginPath();
    ctx.moveTo(
      state.lastX,
      state.lastY
    );
    ctx.lineTo(
      point.x,
      point.y
    );
    ctx.stroke();

    state.lastX = point.x;
    state.lastY = point.y;

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation =
      "source-over";
  }

  function stopDrawing(event) {
    if (!state.drawing) return;

    state.drawing = false;

    if (canvas && event?.pointerId != null) {
      try {
        canvas.releasePointerCapture(
          event.pointerId
        );
      } catch (error) {}
    }

    saveHistory();
  }

  function bindCanvasEvents() {
    if (!canvas) return;

    canvas.style.touchAction = "none";

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
  }

  /* =======================================================
     TOOL
     ======================================================= */

  function setTool(tool) {
    const allowed = [
      "pen",
      "marker",
      "eraser"
    ];

    if (!allowed.includes(tool)) {
      tool = "pen";
    }

    state.tool = tool;

    $$(
      "[data-tool], .tool-btn, .drawing-tool"
    ).forEach((button) => {
      const value =
        button.dataset.tool ||
        button.dataset.action;

      if (value === tool) {
        addClass(button, "active");
        button.setAttribute(
          "aria-pressed",
          "true"
        );
      } else if (
        button.matches("[data-tool]")
      ) {
        removeClass(button, "active");
        button.setAttribute(
          "aria-pressed",
          "false"
        );
      }
    });

    showToast(
      tool === "pen"
        ? "Pen selected"
        : tool === "marker"
        ? "Marker selected"
        : "Eraser selected"
    );
  }

  /* =======================================================
     COLOR
     ======================================================= */

  function setColor(color) {
    if (!color) return;

    state.color = color;

    const colorInput =
      $("#colorPicker") ||
      $("#penColor") ||
      $("input[type='color']");

    if (colorInput) {
      colorInput.value = color;
    }

    $$(".color-btn, [data-color]").forEach(
      (button) => {
        const value =
          button.dataset.color ||
          button.dataset.value;

        if (
          value &&
          value.toLowerCase() ===
            color.toLowerCase()
        ) {
          addClass(button, "active");
        } else {
          removeClass(button, "active");
        }
      }
    );

    setText(
      [
        "#colorPreview",
        "#selectedColor",
        "#colorValue"
      ],
      color
    );
  }

  /* =======================================================
     BRUSH SIZE
     ======================================================= */

  function setBrushSize(size) {
    const number = Number(size);

    if (!Number.isFinite(number)) return;

    state.brushSize = Math.max(
      1,
      Math.min(80, number)
    );

    const slider =
      $("#brushSize") ||
      $("#sizeSlider") ||
      $("#penSize");

    if (slider) {
      slider.value = state.brushSize;
    }

    setText(
      [
        "#brushSizeValue",
        "#sizeValue",
        "#penSizeValue"
      ],
      `${state.brushSize}px`
    );
  }

  /* =======================================================
     HISTORY
     ======================================================= */

  function getCanvasData() {
    if (!canvas) return null;

    try {
      return canvas.toDataURL(
        "image/png"
      );
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  function saveHistory() {
    if (!canvas) return;

    const image = getCanvasData();

    if (!image) return;

    if (
      state.historyIndex <
      state.history.length - 1
    ) {
      state.history =
        state.history.slice(
          0,
          state.historyIndex + 1
        );
    }

    state.history.push(image);

    if (state.history.length > 40) {
      state.history.shift();
    }

    state.historyIndex =
      state.history.length - 1;
  }

  function restoreHistory(index) {
    if (
      !canvas ||
      !ctx ||
      index < 0 ||
      index >= state.history.length
    ) {
      return;
    }

    const image = new Image();

    image.onload = () => {
      ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
      );

      const rect =
        canvas.getBoundingClientRect();

      ctx.drawImage(
        image,
        0,
        0,
        rect.width,
        rect.height
      );
    };

    image.src = state.history[index];
  }

  function undo() {
    if (
      state.historyIndex <= 0
    ) {
      showToast("Nothing to undo");
      return;
    }

    state.historyIndex--;

    restoreHistory(
      state.historyIndex
    );
  }

  function redo() {
    if (
      state.historyIndex >=
      state.history.length - 1
    ) {
      showToast("Nothing to redo");
      return;
    }

    state.historyIndex++;

    restoreHistory(
      state.historyIndex
    );
  }

  function clearBoard() {
    if (!canvas || !ctx) return;

    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    saveHistory();

    showToast(
      "Board cleared",
      "success"
    );
  }

  /* =======================================================
     NEW BOARD
     ======================================================= */

  function newBoard() {
    if (!canvas || !ctx) return;

    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    if (imageLayer) {
      imageLayer.innerHTML = "";
    }

    if (pdfCtx && pdfCanvas) {
      pdfCtx.clearRect(
        0,
        0,
        pdfCanvas.width,
        pdfCanvas.height
      );
    }

    state.pdfDocument = null;
    state.pdfPage = 1;
    state.pdfTotalPages = 0;

    state.zoom = 100;

    applyZoom();

    updatePDFPageInfo();

    saveHistory();

    showToast(
      "New board created",
      "success"
    );
  }

  /* =======================================================
     IMAGE UPLOAD
     ======================================================= */

  function uploadImage(file) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast(
        "Please select an image file.",
        "error"
      );
      return;
    }

    const url =
      URL.createObjectURL(file);

    if (imageLayer) {
      imageLayer.innerHTML = "";

      const image =
        document.createElement("img");

      image.src = url;
      image.alt = "Uploaded board image";

      Object.assign(image.style, {
        maxWidth: "100%",
        maxHeight: "100%",
        width: "auto",
        height: "auto",
        objectFit: "contain",
        display: "block",
        margin: "auto"
      });

      imageLayer.appendChild(image);
    } else {
      const image =
        new Image();

      image.onload = () => {
        const rect =
          canvas.getBoundingClientRect();

        ctx.drawImage(
          image,
          0,
          0,
          rect.width,
          rect.height
        );

        saveHistory();
      };

      image.src = url;
    }

    showToast(
      "Image added",
      "success"
    );
  }

  function bindImageUpload() {
    const input =
      $("#imageUpload") ||
      $("#uploadImage") ||
      $("input[type='file'][accept*='image']");

    if (!input) return;

    input.addEventListener(
      "change",
      () => {
        const file =
          input.files?.[0];

        uploadImage(file);

        input.value = "";
      }
    );
  }

  /* =======================================================
     PDF
     ======================================================= */

  function updatePDFPageInfo() {
    const pageText =
      state.pdfTotalPages
        ? `${state.pdfPage} / ${state.pdfTotalPages}`
        : "No PDF";

    setText(
      [
        "#pdfPageNumber",
        "#pageInfo",
        "#pdfPageInfo",
        "#pageStatus"
      ],
      pageText
    );
  }

  async function renderPDFPage() {
    if (
      !state.pdfDocument ||
      !pdfCanvas ||
      !pdfCtx
    ) {
      return;
    }

    try {
      const page =
        await state.pdfDocument.getPage(
          state.pdfPage
        );

      const viewport =
        page.getViewport({
          scale: state.pdfScale
        });

      pdfCanvas.width =
        viewport.width;

      pdfCanvas.height =
        viewport.height;

      await page.render({
        canvasContext: pdfCtx,
        viewport
      }).promise;

      updatePDFPageInfo();
    } catch (error) {
      console.error(
        "PDF render error:",
        error
      );

      showToast(
        "Could not render PDF page.",
        "error"
      );
    }
  }

  async function uploadPDF(file) {
    if (!file) return;

    if (
      file.type !== "application/pdf" &&
      !file.name
        .toLowerCase()
        .endsWith(".pdf")
    ) {
      showToast(
        "Please select a PDF file.",
        "error"
      );
      return;
    }

    if (
      !window.pdfjsLib
    ) {
      showToast(
        "PDF.js is not loaded.",
        "error"
      );
      return;
    }

    try {
      const arrayBuffer =
        await file.arrayBuffer();

      state.pdfDocument =
        await window.pdfjsLib
          .getDocument({
            data: arrayBuffer
          })
          .promise;

      state.pdfTotalPages =
        state.pdfDocument.numPages;

      state.pdfPage = 1;

      await renderPDFPage();

      showToast(
        "PDF loaded",
        "success"
      );
    } catch (error) {
      console.error(
        "PDF upload error:",
        error
      );

      showToast(
        "Could not open PDF.",
        "error"
      );
    }
  }

  function nextPDFPage() {
    if (
      !state.pdfDocument
    ) {
      showToast("No PDF loaded");
      return;
    }

    if (
      state.pdfPage >=
      state.pdfTotalPages
    ) {
      showToast("Last page");
      return;
    }

    state.pdfPage++;

    renderPDFPage();
  }

  function previousPDFPage() {
    if (
      !state.pdfDocument
    ) {
      showToast("No PDF loaded");
      return;
    }

    if (state.pdfPage <= 1) {
      showToast("First page");
      return;
    }

    state.pdfPage--;

    renderPDFPage();
  }

  function bindPDFUpload() {
    const input =
      $("#pdfUpload") ||
      $("#uploadPDF") ||
      $("input[type='file'][accept*='pdf']");

    if (!input) return;

    input.addEventListener(
      "change",
      () => {
        uploadPDF(
          input.files?.[0]
        );

        input.value = "";
      }
    );
  }

  /* =======================================================
     CAMERA
     ======================================================= */

  async function cameraOn() {
    if (state.cameraEnabled) {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      showToast(
        "Camera is not supported.",
        "error"
      );
      return;
    }

    try {
      state.cameraStream =
        await navigator.mediaDevices
          .getUserMedia({
            video: {
              facingMode: "user"
            },
            audio: false
          });

      if (cameraVideo) {
        cameraVideo.srcObject =
          state.cameraStream;

        cameraVideo.muted = true;
        cameraVideo.playsInline = true;

        await cameraVideo.play()
          .catch(() => {});
      }

      state.cameraEnabled = true;

      showElement(
        cameraBox,
        true
      );

      updateCameraUI();

      showToast(
        "Camera on",
        "success"
      );
    } catch (error) {
      console.error(
        "Camera error:",
        error
      );

      showToast(
        "Camera permission was denied or unavailable.",
        "error"
      );
    }
  }

  function cameraOff() {
    if (state.cameraStream) {
      state.cameraStream
        .getTracks()
        .forEach((track) =>
          track.stop()
        );

      state.cameraStream = null;
    }

    if (cameraVideo) {
      cameraVideo.srcObject = null;
    }

    state.cameraEnabled = false;

    showElement(
      cameraBox,
      false
    );

    updateCameraUI();

    showToast("Camera off");
  }

  function toggleCamera() {
    if (state.cameraEnabled) {
      cameraOff();
    } else {
      cameraOn();
    }
  }

  function updateCameraUI() {
    setText(
      [
        "#cameraStatus",
        "#cameraState"
      ],
      state.cameraEnabled
        ? "On"
        : "Off"
    );

    const buttons = [
      $("#cameraToggleBtn"),
      $("#cameraBtn"),
      $("[data-action='camera']")
    ].filter(Boolean);

    buttons.forEach((button) => {
      button.classList.toggle(
        "active",
        state.cameraEnabled
      );
    });
  }

  function toggleCameraMirror() {
    state.cameraMirror =
      !state.cameraMirror;

    if (cameraVideo) {
      cameraVideo.style.transform =
        state.cameraMirror
          ? "scaleX(-1)"
          : "scaleX(1)";
    }
  }

  function setCameraShape(shape) {
    const allowed = [
      "rounded",
      "circle",
      "square"
    ];

    if (!allowed.includes(shape)) {
      shape = "rounded";
    }

    state.cameraShape = shape;

    if (!cameraBox) return;

    cameraBox.classList.remove(
      "camera-rounded",
      "camera-circle",
      "camera-square"
    );

    cameraBox.classList.add(
      `camera-${shape}`
    );

    if (shape === "circle") {
      cameraBox.style.borderRadius =
        "50%";
      cameraBox.style.overflow =
        "hidden";
    } else if (shape === "square") {
      cameraBox.style.borderRadius =
        "0";
    } else {
      cameraBox.style.borderRadius =
        "18px";
    }
  }

  function setCameraEffect(effect) {
    const allowed = [
      "none",
      "soft-blur",
      "grayscale",
      "sepia"
    ];

    if (!allowed.includes(effect)) {
      effect = "none";
    }

    state.cameraEffect = effect;

    if (!cameraVideo) return;

    if (effect === "soft-blur") {
      cameraVideo.style.filter =
        "blur(2px)";
    } else if (effect === "grayscale") {
      cameraVideo.style.filter =
        "grayscale(1)";
    } else if (effect === "sepia") {
      cameraVideo.style.filter =
        "sepia(0.7)";
    } else {
      cameraVideo.style.filter =
        "none";
    }
  }

  function centerCamera() {
    if (!cameraBox) return;

    cameraBox.style.left =
      "auto";

    cameraBox.style.top =
      "20px";

    cameraBox.style.right =
      "20px";

    cameraBox.style.bottom =
      "auto";
  }

  /* =======================================================
     CAMERA DRAG
     ======================================================= */

  function setupCameraDrag() {
    if (!cameraBox) return;

    cameraBox.style.cursor =
      "move";

    cameraBox.addEventListener(
      "pointerdown",
      (event) => {
        if (
          event.target === cameraVideo
        ) {
          // allow dragging from video too
        }

        state.cameraDrag = true;

        const rect =
          cameraBox.getBoundingClientRect();

        state.cameraDragOffsetX =
          event.clientX -
          rect.left;

        state.cameraDragOffsetY =
          event.clientY -
          rect.top;

        try {
          cameraBox.setPointerCapture(
            event.pointerId
          );
        } catch (error) {}
      }
    );

    cameraBox.addEventListener(
      "pointermove",
      (event) => {
        if (!state.cameraDrag) return;

        const parent =
          cameraBox.offsetParent ||
          document.body;

        const parentRect =
          parent.getBoundingClientRect();

        const left =
          event.clientX -
          parentRect.left -
          state.cameraDragOffsetX;

        const top =
          event.clientY -
          parentRect.top -
          state.cameraDragOffsetY;

        cameraBox.style.left =
          `${Math.max(0, left)}px`;

        cameraBox.style.top =
          `${Math.max(0, top)}px`;

        cameraBox.style.right =
          "auto";

        cameraBox.style.bottom =
          "auto";
      }
    );

    const stopDrag = () => {
      state.cameraDrag = false;
    };

    cameraBox.addEventListener(
      "pointerup",
      stopDrag
    );

    cameraBox.addEventListener(
      "pointercancel",
      stopDrag
    );
  }

  /* =======================================================
     MICROPHONE
     ======================================================= */

  async function microphoneOn() {
    if (state.microphoneEnabled) {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      showToast(
        "Microphone is not supported.",
        "error"
      );
      return;
    }

    try {
      state.microphoneStream =
        await navigator.mediaDevices
          .getUserMedia({
            audio: true
          });

      state.microphoneEnabled =
        true;

      if (micIndicator) {
        showElement(
          micIndicator,
          true
        );
      }

      showToast(
        "Microphone on",
        "success"
      );
    } catch (error) {
      console.error(
        "Microphone error:",
        error
      );

      showToast(
        "Microphone permission was denied.",
        "error"
      );
    }
  }

  function microphoneOff() {
    if (state.microphoneStream) {
      state.microphoneStream
        .getTracks()
        .forEach((track) =>
          track.stop()
        );

      state.microphoneStream = null;
    }

    state.microphoneEnabled =
      false;

    if (micIndicator) {
      showElement(
        micIndicator,
        false
      );
    }

    showToast(
      "Microphone off"
    );
  }

  /* =======================================================
     RECORDING
     ======================================================= */

  async function createRecordingStream() {
    const streams = [];

    if (state.cameraStream) {
      streams.push(
        state.cameraStream
      );
    }

    if (state.microphoneStream) {
      streams.push(
        state.microphoneStream
      );
    }

    if (!streams.length) {
      return null;
    }

    /*
      If camera/mic streams are available,
      use them for recording.

      Board canvas itself can also be captured
      when supported.
    */

    let boardStream = null;

    if (
      canvas &&
      typeof canvas.captureStream ===
        "function"
    ) {
      boardStream =
        canvas.captureStream(30);
    }

    const tracks = [];

    if (boardStream) {
      boardStream
        .getVideoTracks()
        .forEach((track) =>
          tracks.push(track)
        );
    }

    if (state.microphoneStream) {
      state.microphoneStream
        .getAudioTracks()
        .forEach((track) =>
          tracks.push(track)
        );
    }

    if (!tracks.length) {
      return null;
    }

    return new MediaStream(
      tracks
    );
  }

  async function startRecording() {
    if (state.recording) {
      return;
    }

    if (!state.microphoneEnabled) {
      await microphoneOn();
    }

    const stream =
      await createRecordingStream();

    if (!stream) {
      showToast(
        "Recording is not available.",
        "error"
      );
      return;
    }

    let mimeType =
      "video/webm;codecs=vp9,opus";

    if (
      !MediaRecorder.isTypeSupported(
        mimeType
      )
    ) {
      mimeType =
        "video/webm";
    }

    try {
      state.recordedChunks = [];

      state.mediaRecorder =
        new MediaRecorder(
          stream,
          {
            mimeType
          }
        );

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
        saveRecordingFile;

      state.mediaRecorder.onpause =
        () => {
          state.recordingPaused =
            true;
          updateRecordingUI();
        };

      state.mediaRecorder.onresume =
        () => {
          state.recordingPaused =
            false;
          updateRecordingUI();
        };

      state.mediaRecorder.start(
        1000
      );

      state.recording = true;
      state.recordingPaused =
        false;

      updateRecordingUI();

      showToast(
        "Recording started",
        "success"
      );
    } catch (error) {
      console.error(
        "Recording error:",
        error
      );

      showToast(
        "Could not start recording.",
        "error"
      );
    }
  }

  function pauseRecording() {
    if (
      state.mediaRecorder &&
      state.recording &&
      state.mediaRecorder.state ===
        "recording"
    ) {
      state.mediaRecorder.pause();
    }
  }

  function resumeRecording() {
    if (
      state.mediaRecorder &&
      state.recording &&
      state.mediaRecorder.state ===
        "paused"
    ) {
      state.mediaRecorder.resume();
    }
  }

  function stopRecording() {
    if (
      !state.mediaRecorder ||
      !state.recording
    ) {
      return;
    }

    if (
      state.mediaRecorder.state !==
      "inactive"
    ) {
      state.mediaRecorder.stop();
    }

    state.recording = false;
    state.recordingPaused =
      false;

    updateRecordingUI();

    showToast(
      "Recording stopped",
      "success"
    );
  }

  function saveRecordingFile() {
    if (
      !state.recordedChunks.length
    ) {
      return;
    }

    const blob =
      new Blob(
        state.recordedChunks,
        {
          type: "video/webm"
        }
      );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;

    link.download =
      `SNK-Smart-Board-${Date.now()}.webm`;

    document.body.appendChild(link);

    link.click();

    link.remove();

    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 2000);

    state.recordedChunks = [];
  }

  function updateRecordingUI() {
    const active =
      state.recording;

    setText(
      [
        "#recordingStatus",
        "#recordStatus"
      ],
      active
        ? state.recordingPaused
          ? "Paused"
          : "Recording"
        : "Ready"
    );

    setText(
      [
        "#recordButtonText"
      ],
      active
        ? state.recordingPaused
          ? "Resume"
          : "Stop Recording"
        : "Start Recording"
    );

    if (recordingIndicator) {
      showElement(
        recordingIndicator,
        active
      );
    }

    if (active) {
      addClass(
        recordingIndicator,
        "recording"
      );
    } else {
      removeClass(
        recordingIndicator,
        "recording"
      );
    }
  }

  /* =======================================================
     ZOOM
     ======================================================= */

  function applyZoom() {
    const value =
      state.zoom / 100;

    const targets = [
      $(".board-workspace"),
      $("#boardArea"),
      $("#boardStage"),
      $("#smartBoardStage"),
      canvas
    ].filter(Boolean);

    const target =
      targets[0];

    if (target) {
      target.style.transform =
        `scale(${value})`;

      target.style.transformOrigin =
        "center center";
    }

    setText(
      [
        "#zoomValue",
        "#zoomDisplay",
        "#zoomPercent"
      ],
      `${state.zoom}%`
    );
  }

  function setZoom(value) {
    const number =
      Number(value);

    if (!Number.isFinite(number)) {
      return;
    }

    state.zoom =
      Math.max(
        25,
        Math.min(
          300,
          Math.round(number)
        )
      );

    applyZoom();
  }

  function zoomIn() {
    setZoom(
      state.zoom + 10
    );
  }

  function zoomOut() {
    setZoom(
      state.zoom - 10
    );
  }

  function zoomReset() {
    setZoom(100);
  }

  /* =======================================================
     FULLSCREEN
     ======================================================= */

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        const target =
          document.documentElement;

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

  /* =======================================================
     SAVE BOARD PNG
     ======================================================= */

  function saveBoardPNG() {
    if (!canvas) return;

    try {
      const link =
        document.createElement("a");

      link.download =
        `SNK-Smart-Board-${Date.now()}.png`;

      link.href =
        canvas.toDataURL(
          "image/png"
        );

      document.body.appendChild(link);

      link.click();

      link.remove();

      showToast(
        "Board image saved",
        "success"
      );
    } catch (error) {
      console.error(error);

      showToast(
        "Could not save board image.",
        "error"
      );
    }
  }

  /* =======================================================
     FIREBASE CONTROLLER
     ======================================================= */

  function firebaseReady() {
    return Boolean(
      window.SNKFirebase &&
      window.SNKFirebase.database &&
      window.SNKFirebase.ref &&
      window.SNKFirebase.onChildAdded
    );
  }

  function getPairingState() {
    return (
      window.SNKSmartBoardPairing?.state ||
      null
    );
  }

  function connectWirelessFirebase() {
    if (
      state.wirelessListenerAttached
    ) {
      return true;
    }

    if (!firebaseReady()) {
      console.warn(
        "SNK Firebase is not ready."
      );

      return false;
    }

    const pairing =
      getPairingState();

    if (
      !pairing?.sessionPath
    ) {
      console.warn(
        "Smart Board session path is not ready."
      );

      return false;
    }

    try {
      const firebase =
        window.SNKFirebase;

      const commandsRef =
        firebase.ref(
          firebase.database,
          `${pairing.sessionPath}/commands`
        );

      const unsubscribe =
        firebase.onChildAdded(
          commandsRef,
          (snapshot) => {
            const command =
              snapshot.val();

            if (!command) return;

            receiveWirelessCommand(
              command
            );
          }
        );

      state.wirelessListenerAttached =
        true;

      state.wirelessConnected =
        true;

      state.wirelessUnsubscribe =
        typeof unsubscribe ===
        "function"
          ? unsubscribe
          : null;

      console.log(
        "SNK Smart Board Firebase receiver connected:",
        pairing.sessionPath
      );

      showToast(
        "Wireless Controller ready",
        "success"
      );

      return true;
    } catch (error) {
      console.error(
        "Firebase receiver error:",
        error
      );

      showToast(
        "Wireless Controller connection failed.",
        "error"
      );

      return false;
    }
  }

  function disconnectWirelessFirebase() {
    if (
      state.wirelessUnsubscribe
    ) {
      try {
        state.wirelessUnsubscribe();
      } catch (error) {
        console.warn(error);
      }
    }

    state.wirelessUnsubscribe =
      null;

    state.wirelessListenerAttached =
      false;

    state.wirelessConnected =
      false;
  }

  /* =======================================================
     WIRELESS COMMAND RECEIVER
     ======================================================= */

  function receiveWirelessCommand(
    command
  ) {
    if (!command) return;

    /*
      Supports both:

      {
        type: "undo",
        payload: {}
      }

      and direct command strings.
    */

    const type =
      command.type ||
      command.action ||
      command.command;

    const payload =
      command.payload ||
      command.data ||
      {};

    if (!type) return;

    console.log(
      "SNK Smart Board received:",
      type,
      payload
    );

    switch (type) {
      /* -----------------------------------------------
         BOARD
         ----------------------------------------------- */

      case "undo":
        undo();
        break;

      case "redo":
        redo();
        break;

      case "clear":
      case "clearBoard":
        clearBoard();
        break;

      case "newBoard":
      case "new":
        newBoard();
        break;

      /* -----------------------------------------------
         TOOLS
         ----------------------------------------------- */

      case "tool":
      case "setTool":
        setTool(
          payload.tool ||
          payload.value
        );
        break;

      case "pen":
        setTool("pen");
        break;

      case "marker":
        setTool("marker");
        break;

      case "eraser":
        setTool("eraser");
        break;

      /* -----------------------------------------------
         COLOR
         ----------------------------------------------- */

      case "color":
      case "setColor":
        setColor(
          payload.color ||
          payload.value
        );
        break;

      /* -----------------------------------------------
         SIZE
         ----------------------------------------------- */

      case "size":
      case "brushSize":
      case "setSize":
        setBrushSize(
          payload.size ??
          payload.value
        );
        break;

      /* -----------------------------------------------
         ZOOM
         ----------------------------------------------- */

      case "zoom":
      case "setZoom":
        setZoom(
          payload.zoom ??
          payload.value
        );
        break;

      case "zoomIn":
        zoomIn();
        break;

      case "zoomOut":
        zoomOut();
        break;

      case "zoomReset":
        zoomReset();
        break;

      /* -----------------------------------------------
         PDF / SLIDES
         ----------------------------------------------- */

      case "nextPage":
      case "nextPDF":
      case "nextPDFPage":
        nextPDFPage();
        break;

      case "previousPage":
      case "previousPDF":
      case "previousPDFPage":
        previousPDFPage();
        break;

      /* -----------------------------------------------
         CAMERA
         ----------------------------------------------- */

      case "cameraOn":
        cameraOn();
        break;

      case "cameraOff":
        cameraOff();
        break;

      case "cameraToggle":
      case "toggleCamera":
        toggleCamera();
        break;

      case "cameraMirror":
      case "toggleCameraMirror":
        toggleCameraMirror();
        break;

      case "cameraShape":
      case "setCameraShape":
        setCameraShape(
          payload.shape ||
          payload.value
        );
        break;

      case "cameraEffect":
      case "setCameraEffect":
        setCameraEffect(
          payload.effect ||
          payload.value
        );
        break;

      case "cameraCenter":
      case "centerCamera":
        centerCamera();
        break;

      /* -----------------------------------------------
         MICROPHONE
         ----------------------------------------------- */

      case "microphoneOn":
      case "micOn":
        microphoneOn();
        break;

      case "microphoneOff":
      case "micOff":
        microphoneOff();
        break;

      case "microphoneToggle":
      case "micToggle":
        if (
          state.microphoneEnabled
        ) {
          microphoneOff();
        } else {
          microphoneOn();
        }
        break;

      /* -----------------------------------------------
         RECORDING
         ----------------------------------------------- */

      case "startRecording":
        startRecording();
        break;

      case "stopRecording":
        stopRecording();
        break;

      case "pauseRecording":
        pauseRecording();
        break;

      case "resumeRecording":
        resumeRecording();
        break;

      case "recordToggle":
      case "toggleRecording":
        if (state.recording) {
          stopRecording();
        } else {
          startRecording();
        }
        break;

      /* -----------------------------------------------
         FULLSCREEN
         ----------------------------------------------- */

      case "fullscreen":
      case "toggleFullscreen":
        toggleFullscreen();
        break;

      /* -----------------------------------------------
         SAVE
         ----------------------------------------------- */

      case "savePNG":
      case "saveBoard":
        saveBoardPNG();
        break;

      /* -----------------------------------------------
         UNKNOWN
         ----------------------------------------------- */

      default:
        console.warn(
          "Unknown Smart Board command:",
          type,
          payload
        );
    }
  }

  /* =======================================================
     PAIRING EVENTS
     ======================================================= */

  function bindPairingEvents() {
    window.addEventListener(
      "SNKPairingCodeCreated",
      () => {
        /*
          firebase-pairing.js has now created
          the session path.

          Connect the command receiver now.
        */

        connectWirelessFirebase();
      }
    );

    window.addEventListener(
      "SNKFirebaseReady",
      () => {
        /*
          Firebase may become ready before
          pairing or after pairing.
        */

        setTimeout(() => {
          connectWirelessFirebase();
        }, 100);
      }
    );

    /*
      Safety retry.

      This handles cases where Firebase and
      pairing initialization happen in a
      different order.
    */

    let attempts = 0;

    const retryTimer =
      setInterval(() => {
        attempts++;

        if (
          connectWirelessFirebase()
        ) {
          clearInterval(
            retryTimer
          );
        }

        if (attempts >= 30) {
          clearInterval(
            retryTimer
          );
        }
      }, 1000);
  }

  /* =======================================================
     BUTTON BINDINGS
     ======================================================= */

  function bindButtons() {
    $$("[data-tool]").forEach(
      (button) => {
        button.addEventListener(
          "click",
          () => {
            setTool(
              button.dataset.tool
            );
          }
        );
      }
    );

    $$("[data-color]").forEach(
      (button) => {
        button.addEventListener(
          "click",
          () => {
            setColor(
              button.dataset.color
            );
          }
        );
      }
    );

    const colorInput =
      $("#colorPicker") ||
      $("#penColor");

    if (colorInput) {
      colorInput.addEventListener(
        "input",
        () => {
          setColor(
            colorInput.value
          );
        }
      );
    }

    const sizeSlider =
      $("#brushSize") ||
      $("#sizeSlider") ||
      $("#penSize");

    if (sizeSlider) {
      sizeSlider.addEventListener(
        "input",
        () => {
          setBrushSize(
            sizeSlider.value
          );
        }
      );
    }

    const undoButton =
      $("#undoBtn") ||
      $("[data-action='undo']");

    const redoButton =
      $("#redoBtn") ||
      $("[data-action='redo']");

    const clearButton =
      $("#clearBtn") ||
      $("[data-action='clear']");

    const newBoardButton =
      $("#newBoardBtn") ||
      $("[data-action='new-board']");

    undoButton?.addEventListener(
      "click",
      undo
    );

    redoButton?.addEventListener(
      "click",
      redo
    );

    clearButton?.addEventListener(
      "click",
      clearBoard
    );

    newBoardButton?.addEventListener(
      "click",
      newBoard
    );

    const nextButton =
      $("#nextPageBtn") ||
      $("[data-action='next-page']");

    const previousButton =
      $("#previousPageBtn") ||
      $("[data-action='previous-page']");

    nextButton?.addEventListener(
      "click",
      nextPDFPage
    );

    previousButton?.addEventListener(
      "click",
      previousPDFPage
    );

    const cameraButton =
      $("#cameraToggleBtn") ||
      $("[data-action='camera']");

    cameraButton?.addEventListener(
      "click",
      toggleCamera
    );

    const micButton =
      $("#microphoneToggleBtn") ||
      $("#micToggleBtn") ||
      $("[data-action='microphone']");

    micButton?.addEventListener(
      "click",
      () => {
        if (
          state.microphoneEnabled
        ) {
          microphoneOff();
        } else {
          microphoneOn();
        }
      }
    );

    const recordButton =
      $("#recordBtn") ||
      $("#recordToggleBtn") ||
      $("[data-action='record']");

    recordButton?.addEventListener(
      "click",
      () => {
        if (state.recording) {
          stopRecording();
        } else {
          startRecording();
        }
      }
    );

    const saveButton =
      $("#savePNGBtn") ||
      $("#saveBoardBtn") ||
      $("[data-action='save']");

    saveButton?.addEventListener(
      "click",
      saveBoardPNG
    );

    const fullscreenButton =
      $("#fullscreenBtn") ||
      $("[data-action='fullscreen']");

    fullscreenButton?.addEventListener(
      "click",
      toggleFullscreen
    );

    const zoomInButton =
      $("#zoomInBtn") ||
      $("[data-action='zoom-in']");

    const zoomOutButton =
      $("#zoomOutBtn") ||
      $("[data-action='zoom-out']");

    const zoomResetButton =
      $("#zoomResetBtn") ||
      $("[data-action='zoom-reset']");

    zoomInButton?.addEventListener(
      "click",
      zoomIn
    );

    zoomOutButton?.addEventListener(
      "click",
      zoomOut
    );

    zoomResetButton?.addEventListener(
      "click",
      zoomReset
    );
  }

  /* =======================================================
     KEYBOARD SHORTCUTS
     ======================================================= */

  function bindKeyboard() {
    document.addEventListener(
      "keydown",
      (event) => {
        const target =
          event.target;

        if (
          target &&
          (
            target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable
          )
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

          return;
        }

        if (
          (event.ctrlKey ||
            event.metaKey) &&
          event.key.toLowerCase() ===
            "y"
        ) {
          event.preventDefault();
          redo();
          return;
        }

        if (
          event.key === "Delete" ||
          event.key === "Backspace"
        ) {
          /*
            Do not clear the whole board from
            Backspace. This is intentionally
            left unused.
          */
        }

        if (
          event.key.toLowerCase() ===
          "p"
        ) {
          setTool("pen");
        }

        if (
          event.key.toLowerCase() ===
          "m"
        ) {
          setTool("marker");
        }

        if (
          event.key.toLowerCase() ===
          "e"
        ) {
          setTool("eraser");
        }

        if (
          event.key === "+"
        ) {
          zoomIn();
        }

        if (
          event.key === "-"
        ) {
          zoomOut();
        }

        if (
          event.key === "0"
        ) {
          zoomReset();
        }
      }
    );
  }

  /* =======================================================
     FILE INPUT HELPERS
     ======================================================= */

  function exposeUploadHelpers() {
    window.SNKSmartBoardUploadImage =
      uploadImage;

    window.SNKSmartBoardUploadPDF =
      uploadPDF;
  }

  /* =======================================================
     INITIALIZE
     ======================================================= */

  function initialize() {
    if (state.initialized) {
      return;
    }

    state.initialized = true;

    setupCanvas();

    bindCanvasEvents();

    bindButtons();

    bindImageUpload();

    bindPDFUpload();

    bindPairingEvents();

    bindKeyboard();

    setupCameraDrag();

    exposeUploadHelpers();

    setTool("pen");

    setColor(
      state.color
    );

    setBrushSize(
      state.brushSize
    );

    setZoom(100);

    updateCameraUI();

    updateRecordingUI();

    updatePDFPageInfo();

    /*
      Try immediately as well.
      If pairing is not ready yet,
      the event/retry system will
      connect later.
    */

    connectWirelessFirebase();

    console.log(
      "SNK Smart Board initialized."
    );
  }

  /* =======================================================
     PAGE READY
     ======================================================= */

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      initialize,
      {
        once: true
      }
    );
  } else {
    initialize();
  }

  /* =======================================================
     PUBLIC API
     ======================================================= */

  window.SNKSmartBoard = {
    setTool,
    setColor,
    setBrushSize,

    undo,
    redo,
    clearBoard,
    newBoard,

    uploadImage,
    uploadPDF,

    nextPDFPage,
    previousPDFPage,

    cameraOn,
    cameraOff,
    toggleCamera,
    toggleCameraMirror,
    setCameraShape,
    setCameraEffect,
    centerCamera,

    microphoneOn,
    microphoneOff,

    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,

    saveBoardPNG,

    setZoom,
    zoomIn,
    zoomOut,
    zoomReset,

    toggleFullscreen,

    connectWirelessFirebase,
    disconnectWirelessFirebase,

    receiveWirelessCommand,

    getState() {
      return {
        tool: state.tool,
        color: state.color,
        brushSize: state.brushSize,
        zoom: state.zoom,
        cameraEnabled:
          state.cameraEnabled,
        microphoneEnabled:
          state.microphoneEnabled,
        recording:
          state.recording,
        pdfPage:
          state.pdfPage,
        pdfTotalPages:
          state.pdfTotalPages,
        wirelessConnected:
          state.wirelessConnected
      };
    }
  };
})();
