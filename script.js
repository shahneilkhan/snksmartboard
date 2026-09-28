/* =========================================================
   SNK SMART BOARD — MAIN JAVASCRIPT
   File: script.js

   Features:
   - Mouse / Touch / Pen drawing
   - Pen / Marker / Eraser
   - Undo / Redo / Clear
   - Text and basic shapes
   - Image upload
   - PDF.js upload and page navigation
   - Camera ON/OFF, mirror, drag, resize
   - Camera effects and frame shape
   - Microphone
   - Composite board + media + camera + microphone recording
   - PNG export
   - Fullscreen and zoom
   - Wireless controller command receiver
   - Optional Firebase realtime command listener

   Recommended:
   - Serve through HTTPS (GitHub Pages supports HTTPS)
   - Load PDF.js before this file if PDF support is needed
   ========================================================= */

(() => {
  "use strict";

  /* -----------------------------
     DOM HELPERS
  ----------------------------- */

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const byId = (id) => document.getElementById(id);

  function findElement(...selectors) {
    for (const selector of selectors) {
      const element = selector.startsWith("#")
        ? $(selector)
        : byId(selector);

      if (element) return element;
    }
    return null;
  }

  function bindClick(selectors, callback) {
    const list = Array.isArray(selectors) ? selectors : [selectors];

    list.forEach((selector) => {
      const element = findElement(selector);
      if (element && !element.dataset.snkBound) {
        element.dataset.snkBound = "true";
        element.addEventListener("click", callback);
      }
    });
  }

  function showToast(message) {
    const toast = findElement("#toast", "#snkToast", "[data-toast]");
    if (!toast) {
      console.log("[SNK Smart Board]", message);
      return;
    }

    toast.textContent = message;
    toast.classList.add("show", "active");

    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => {
      toast.classList.remove("show", "active");
    }, 2600);
  }

  /* -----------------------------
     ELEMENTS
  ----------------------------- */

  const board = findElement(
    "#board",
    "#boardWrapper",
    "#smartBoard",
    ".board"
  );

  const canvas = findElement(
    "#drawingCanvas",
    "#boardCanvas",
    "#canvas"
  );

  const ctx = canvas?.getContext("2d", { willReadFrequently: true });

  const imageInput = findElement("#imageInput", "#uploadImageInput");
  const pdfInput = findElement("#pdfInput", "#uploadPdfInput");

  const imageLayer = findElement("#imageLayer", "#mediaLayer");
  const pdfCanvas = findElement("#pdfCanvas");

  const cameraBox = findElement(
    "#cameraBox",
    "#mentorVideoBox",
    "#cameraOverlay"
  );

  const mentorVideo = findElement(
    "#mentorVideo",
    "#cameraVideo",
    "#webcamVideo"
  );

  const cameraResizeHandle = findElement(
    "#cameraResize",
    "#cameraResizeHandle"
  );

  const recordingPreview = findElement(
    "#recordingPreview",
    "#recordedVideo"
  );

  const recordingModal = findElement(
    "#recordingModal",
    "#recordingPreviewModal"
  );

  const downloadRecordingButton = findElement(
    "#downloadRecording",
    "#downloadVideo"
  );

  const colorInput = findElement(
    "#colorInput",
    "#colorPicker",
    "#penColor"
  );

  const sizeInput = findElement(
    "#sizeInput",
    "#brushSize",
    "#penSize"
  );

  /* -----------------------------
     STATE
  ----------------------------- */

  const state = {
    tool: "pen",
    color: "#2563eb",
    size: 4,

    drawing: false,
    lastPoint: null,

    undoStack: [],
    redoStack: [],

    zoom: 1,

    image: null,
    imageUrl: null,

    pdfDocument: null,
    pdfPage: 1,
    pdfPageCount: 0,
    pdfRendering: false,

    cameraStream: null,
    cameraEnabled: false,
    cameraMirror: true,
    cameraShape: "rounded",
    cameraEffect: "normal",
    cameraFrame: true,
    cameraShadow: true,

    cameraPosition: {
      x: 24,
      y: 24,
      width: 240,
      height: 160
    },

    microphoneStream: null,

    recording: false,
    recordingPaused: false,
    mediaRecorder: null,
    recordingChunks: [],
    recordingStream: null,
    recordingCanvas: null,
    recordingContext: null,
    recordingTimer: null,
    recordingStartedAt: 0,
    recordingElapsed: 0,

    animationFrame: null,

    wirelessDrawing: false,
    wirelessLastPoint: null
  };

  /* -----------------------------
     CANVAS SETUP
  ----------------------------- */

  function getBoardSize() {
    const rect = board?.getBoundingClientRect();

    return {
      width: Math.max(1, Math.round(rect?.width || canvas?.clientWidth || 1000)),
      height: Math.max(1, Math.round(rect?.height || canvas?.clientHeight || 650))
    };
  }

  function resizeCanvas() {
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const dpr = Math.max(1, window.devicePixelRatio || 1);

    const oldWidth = canvas.width;
    const oldHeight = canvas.height;

    let oldImage = null;

    if (oldWidth > 0 && oldHeight > 0) {
      try {
        oldImage = document.createElement("canvas");
        oldImage.width = oldWidth;
        oldImage.height = oldHeight;
        oldImage.getContext("2d").drawImage(canvas, 0, 0);
      } catch (error) {
        console.warn("Could not preserve canvas during resize.", error);
      }
    }

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (oldImage) {
      ctx.drawImage(oldImage, 0, 0, width, height);
    }
  }

  function getCanvasPoint(event) {
    const rect = canvas.getBoundingClientRect();

    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      pressure: event.pressure || 0.5
    };
  }

  function saveUndoState() {
    if (!canvas) return;

    try {
      state.undoStack.push(canvas.toDataURL("image/png"));

      if (state.undoStack.length > 40) {
        state.undoStack.shift();
      }

      state.redoStack = [];
    } catch (error) {
      console.warn("Unable to save undo state.", error);
    }
  }

  function restoreCanvas(dataUrl) {
    if (!ctx || !canvas || !dataUrl) return;

    const image = new Image();

    image.onload = () => {
      const { width, height } = getBoardSize();

      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(image, 0, 0, width, height);
    };

    image.src = dataUrl;
  }

  function undo() {
    if (!state.undoStack.length || !canvas) return;

    state.redoStack.push(canvas.toDataURL("image/png"));
    restoreCanvas(state.undoStack.pop());
    showToast("Undo");
  }

  function redo() {
    if (!state.redoStack.length || !canvas) return;

    state.undoStack.push(canvas.toDataURL("image/png"));
    restoreCanvas(state.redoStack.pop());
    showToast("Redo");
  }

  function clearBoard() {
    if (!ctx || !canvas) return;

    saveUndoState();

    const { width, height } = getBoardSize();
    ctx.clearRect(0, 0, width, height);

    showToast("Board cleared");
  }

  /* -----------------------------
     DRAWING TOOLS
  ----------------------------- */

  function setTool(tool) {
    state.tool = tool;

    if (canvas) {
      canvas.style.cursor =
        tool === "text" ? "text" :
        tool === "eraser" ? "cell" :
        "crosshair";
    }

    $$("[data-tool]").forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset.tool === tool
      );
    });

    showToast(`${tool.charAt(0).toUpperCase()}${tool.slice(1)} selected`);
  }

  function setColor(color) {
    if (!color) return;

    state.color = color;

    if (colorInput) colorInput.value = color;

    $$("[data-color]").forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset.color.toLowerCase() === color.toLowerCase()
      );
    });
  }

  function setBrushSize(size) {
    const parsed = Number(size);
    if (!Number.isFinite(parsed)) return;

    state.size = Math.max(1, Math.min(60, parsed));

    if (sizeInput) sizeInput.value = String(state.size);
  }

  function drawSegment(from, to, pressure = 0.5) {
    if (!ctx) return;

    const pressureFactor =
      pressure > 0 && pressure < 1 ? 0.5 + pressure : 1;

    ctx.save();

    if (state.tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = state.size * 3;
      ctx.strokeStyle = "rgba(0,0,0,1)";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = state.color;

      if (state.tool === "marker") {
        ctx.globalAlpha = 0.28;
        ctx.lineWidth = state.size * 3;
      } else {
        ctx.globalAlpha = 1;
        ctx.lineWidth = state.size * pressureFactor;
      }
    }

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();

    ctx.restore();
  }

  function handlePointerDown(event) {
    if (!canvas || !ctx) return;

    if (state.tool === "text") {
      const point = getCanvasPoint(event);
      addTextAt(point.x, point.y);
      return;
    }

    if (state.tool === "shape") {
      const point = getCanvasPoint(event);
      drawBasicShape(point.x, point.y);
      return;
    }

    event.preventDefault();

    saveUndoState();
    state.drawing = true;
    state.lastPoint = getCanvasPoint(event);

    try {
      canvas.setPointerCapture(event.pointerId);
    } catch (_) {}

    drawSegment(state.lastPoint, state.lastPoint, state.lastPoint.pressure);
  }

  function handlePointerMove(event) {
    if (!state.drawing || !state.lastPoint) return;

    event.preventDefault();

    const point = getCanvasPoint(event);

    drawSegment(state.lastPoint, point, point.pressure);
    state.lastPoint = point;
  }

  function handlePointerUp() {
    state.drawing = false;
    state.lastPoint = null;
  }

  if (canvas) {
    canvas.style.touchAction = "none";

    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("pointercancel", handlePointerUp);
    canvas.addEventListener("lostpointercapture", handlePointerUp);
  }

  /* -----------------------------
     TEXT AND BASIC SHAPES
  ----------------------------- */

  function addTextAt(x, y) {
    const text = prompt("Enter board text:");
    if (!text || !ctx) return;

    saveUndoState();

    ctx.save();
    ctx.fillStyle = state.color;
    ctx.font = `600 ${Math.max(16, state.size * 5)}px Arial, sans-serif`;
    ctx.textBaseline = "top";

    text.split("\n").forEach((line, index) => {
      ctx.fillText(line, x, y + index * Math.max(20, state.size * 6));
    });

    ctx.restore();
  }

  function drawBasicShape(x, y) {
    if (!ctx) return;

    saveUndoState();

    const shape = prompt(
      "Type a shape: line, rectangle, circle",
      "rectangle"
    );

    if (!shape) return;

    const width = 150;
    const height = 90;

    ctx.save();
    ctx.strokeStyle = state.color;
    ctx.lineWidth = state.size;
    ctx.beginPath();

    if (shape.toLowerCase() === "line") {
      ctx.moveTo(x, y);
      ctx.lineTo(x + width, y + height);
    } else if (shape.toLowerCase() === "circle") {
      ctx.arc(x + width / 2, y + height / 2, Math.min(width, height) / 2, 0, Math.PI * 2);
    } else {
      ctx.rect(x, y, width, height);
    }

    ctx.stroke();
    ctx.restore();
  }

  /* -----------------------------
     IMAGE UPLOAD
  ----------------------------- */

  function uploadImage(file) {
    if (!file || !file.type.startsWith("image/")) {
      showToast("Please select an image file");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const image = new Image();

      image.onload = () => {
        state.image = image;

        if (imageLayer) {
          imageLayer.innerHTML = "";

          const displayedImage = document.createElement("img");
          displayedImage.src = reader.result;
          displayedImage.alt = file.name;
          displayedImage.className = "uploaded-media";

          Object.assign(displayedImage.style, {
            maxWidth: "90%",
            maxHeight: "90%",
            objectFit: "contain",
            display: "block",
            margin: "auto",
            pointerEvents: "none"
          });

          imageLayer.appendChild(displayedImage);
        }

        showToast("Image added to board");
      };

      image.src = reader.result;
    };

    reader.readAsDataURL(file);
  }

  if (imageInput) {
    imageInput.addEventListener("change", (event) => {
      uploadImage(event.target.files?.[0]);
      event.target.value = "";
    });
  }

  /* -----------------------------
     PDF SUPPORT
  ----------------------------- */

  async function uploadPDF(file) {
    if (!file || file.type !== "application/pdf") {
      showToast("Please select a PDF file");
      return;
    }

    if (!window.pdfjsLib) {
      showToast("PDF.js is not loaded. Add the PDF.js script to index.html.");
      return;
    }

    try {
      const buffer = await file.arrayBuffer();

      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

      state.pdfDocument = await window.pdfjsLib.getDocument({
        data: buffer
      }).promise;

      state.pdfPageCount = state.pdfDocument.numPages;
      state.pdfPage = 1;

      await renderPDFPage();

      showToast(`PDF loaded: ${state.pdfPageCount} pages`);
    } catch (error) {
      console.error(error);
      showToast("Could not open this PDF");
    }
  }

  async function renderPDFPage() {
    if (!state.pdfDocument || !pdfCanvas || state.pdfRendering) return;

    state.pdfRendering = true;

    try {
      const page = await state.pdfDocument.getPage(state.pdfPage);
      const viewport = page.getViewport({ scale: 1.5 });

      pdfCanvas.width = Math.ceil(viewport.width);
      pdfCanvas.height = Math.ceil(viewport.height);

      const pdfContext = pdfCanvas.getContext("2d");

      await page.render({
        canvasContext: pdfContext,
        viewport
      }).promise;

      pdfCanvas.style.display = "block";
    } catch (error) {
      console.error("PDF render error:", error);
    } finally {
      state.pdfRendering = false;
    }
  }

  async function nextPDFPage() {
    if (!state.pdfDocument) return;

    if (state.pdfPage < state.pdfPageCount) {
      state.pdfPage++;
      await renderPDFPage();
    }
  }

  async function previousPDFPage() {
    if (!state.pdfDocument) return;

    if (state.pdfPage > 1) {
      state.pdfPage--;
      await renderPDFPage();
    }
  }

  if (pdfInput) {
    pdfInput.addEventListener("change", (event) => {
      uploadPDF(event.target.files?.[0]);
      event.target.value = "";
    });
  }

  /* -----------------------------
     CAMERA
  ----------------------------- */

  async function cameraOn() {
    if (!navigator.mediaDevices?.getUserMedia) {
      showToast("Camera requires a supported browser and HTTPS");
      return;
    }

    try {
      state.cameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user"
        },
        audio: false
      });

      if (mentorVideo) {
        mentorVideo.srcObject = state.cameraStream;
        mentorVideo.muted = true;
        mentorVideo.playsInline = true;
        await mentorVideo.play().catch(() => {});
      }

      state.cameraEnabled = true;

      if (cameraBox) {
        cameraBox.hidden = false;
        cameraBox.style.display = "block";
      }

      applyCameraAppearance();
      showToast("Camera is on");
    } catch (error) {
      console.error(error);
      showToast("Camera permission was denied or unavailable");
    }
  }

  function cameraOff() {
    state.cameraStream?.getTracks().forEach((track) => track.stop());
    state.cameraStream = null;
    state.cameraEnabled = false;

    if (mentorVideo) mentorVideo.srcObject = null;

    if (cameraBox) {
      cameraBox.hidden = true;
      cameraBox.style.display = "none";
    }

    showToast("Camera is off");
  }

  function toggleCamera() {
    state.cameraEnabled ? cameraOff() : cameraOn();
  }

  function toggleCameraMirror() {
    state.cameraMirror = !state.cameraMirror;
    applyCameraAppearance();
  }

  function setCameraShape(shape) {
    if (!["circle", "rounded", "rectangle"].includes(shape)) return;

    state.cameraShape = shape;
    applyCameraAppearance();
  }

  function setCameraEffect(effect) {
    state.cameraEffect = effect || "normal";
    applyCameraAppearance();
  }

  function applyCameraAppearance() {
    if (!cameraBox || !mentorVideo) return;

    cameraBox.classList.remove(
      "effect-normal",
      "effect-soft-blur",
      "effect-gradient",
      "effect-office",
      "effect-classroom",
      "camera-circle",
      "camera-rounded",
      "camera-rectangle",
      "no-camera-shadow"
    );

    cameraBox.classList.add(`effect-${state.cameraEffect}`);
    cameraBox.classList.add(`camera-${state.cameraShape}`);

    if (!state.cameraShadow) {
      cameraBox.classList.add("no-camera-shadow");
    }

    mentorVideo.style.transform = state.cameraMirror
      ? "scaleX(-1)"
      : "scaleX(1)";

    cameraBox.style.borderRadius =
      state.cameraShape === "circle" ? "50%" :
      state.cameraShape === "rectangle" ? "0" :
      "16px";

    cameraBox.style.boxShadow = state.cameraShadow
      ? "0 8px 28px rgba(0,0,0,.22)"
      : "none";

    cameraBox.style.border =
      state.cameraFrame ? "3px solid white" : "none";
  }

  function centerCamera() {
    if (!board || !cameraBox) return;

    const rect = board.getBoundingClientRect();

    state.cameraPosition.x = Math.max(10, rect.width - state.cameraPosition.width - 20);
    state.cameraPosition.y = 20;

    applyCameraPosition();
  }

  function applyCameraPosition() {
    if (!cameraBox) return;

    cameraBox.style.position = "absolute";
    cameraBox.style.left = `${state.cameraPosition.x}px`;
    cameraBox.style.top = `${state.cameraPosition.y}px`;
    cameraBox.style.width = `${state.cameraPosition.width}px`;
    cameraBox.style.height = `${state.cameraPosition.height}px`;
    cameraBox.style.right = "auto";
    cameraBox.style.bottom = "auto";
  }

  function makeCameraDraggable() {
    if (!cameraBox || !board) return;

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let originX = 0;
    let originY = 0;

    cameraBox.addEventListener("pointerdown", (event) => {
      if (event.target === cameraResizeHandle) return;

      dragging = true;
      startX = event.clientX;
      startY = event.clientY;
      originX = state.cameraPosition.x;
      originY = state.cameraPosition.y;

      cameraBox.setPointerCapture?.(event.pointerId);
    });

    cameraBox.addEventListener("pointermove", (event) => {
      if (!dragging) return;

      const bounds = board.getBoundingClientRect();

      state.cameraPosition.x = Math.max(
        0,
        Math.min(
          bounds.width - state.cameraPosition.width,
          originX + event.clientX - startX
        )
      );

      state.cameraPosition.y = Math.max(
        0,
        Math.min(
          bounds.height - state.cameraPosition.height,
          originY + event.clientY - startY
        )
      );

      applyCameraPosition();
    });

    const stopDragging = () => {
      dragging = false;
    };

    cameraBox.addEventListener("pointerup", stopDragging);
    cameraBox.addEventListener("pointercancel", stopDragging);
  }

  function makeCameraResizable() {
    if (!cameraBox || !cameraResizeHandle || !board) return;

    let resizing = false;
    let startX = 0;
    let startY = 0;
    let startWidth = 0;
    let startHeight = 0;

    cameraResizeHandle.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();

      resizing = true;
      startX = event.clientX;
      startY = event.clientY;
      startWidth = state.cameraPosition.width;
      startHeight = state.cameraPosition.height;

      cameraResizeHandle.setPointerCapture?.(event.pointerId);
    });

    cameraResizeHandle.addEventListener("pointermove", (event) => {
      if (!resizing) return;

      state.cameraPosition.width = Math.max(
        120,
        Math.min(520, startWidth + event.clientX - startX)
      );

      state.cameraPosition.height = Math.max(
        80,
        Math.min(360, startHeight + event.clientY - startY)
      );

      applyCameraPosition();
    });

    const stopResize = () => {
      resizing = false;
    };

    cameraResizeHandle.addEventListener("pointerup", stopResize);
    cameraResizeHandle.addEventListener("pointercancel", stopResize);
  }

  makeCameraDraggable();
  makeCameraResizable();

  /* -----------------------------
     MICROPHONE
  ----------------------------- */

  async function microphoneOn() {
    if (!navigator.mediaDevices?.getUserMedia) {
      showToast("Microphone requires a supported browser and HTTPS");
      return null;
    }

    try {
      state.microphoneStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      });

      showToast("Microphone is ready");
      return state.microphoneStream;
    } catch (error) {
      console.error(error);
      showToast("Microphone permission was denied");
      return null;
    }
  }

  function microphoneOff() {
    state.microphoneStream?.getTracks().forEach((track) => track.stop());
    state.microphoneStream = null;
    showToast("Microphone is off");
  }

  /* -----------------------------
     COMPOSITE RECORDING
  ----------------------------- */

  function createRecordingCanvas() {
    const recordCanvas = document.createElement("canvas");
    recordCanvas.width = 1280;
    recordCanvas.height = 720;

    state.recordingCanvas = recordCanvas;
    state.recordingContext = recordCanvas.getContext("2d");

    return recordCanvas;
  }

  function drawContain(context, source, x, y, width, height) {
    if (!source) return;

    const sourceWidth = source.videoWidth || source.naturalWidth || source.width;
    const sourceHeight = source.videoHeight || source.naturalHeight || source.height;

    if (!sourceWidth || !sourceHeight) return;

    const scale = Math.min(width / sourceWidth, height / sourceHeight);
    const drawWidth = sourceWidth * scale;
    const drawHeight = sourceHeight * scale;

    context.drawImage(
      source,
      x + (width - drawWidth) / 2,
      y + (height - drawHeight) / 2,
      drawWidth,
      drawHeight
    );
  }

  function drawCover(context, source, x, y, width, height, mirror = false) {
    if (!source) return;

    const sourceWidth = source.videoWidth || source.naturalWidth || source.width;
    const sourceHeight = source.videoHeight || source.naturalHeight || source.height;

    if (!sourceWidth || !sourceHeight) return;

    const scale = Math.max(width / sourceWidth, height / sourceHeight);
    const drawWidth = sourceWidth * scale;
    const drawHeight = sourceHeight * scale;

    context.save();

    if (mirror) {
      context.translate(x + width, y);
      context.scale(-1, 1);
      context.drawImage(
        source,
        (width - drawWidth) / 2,
        (height - drawHeight) / 2,
        drawWidth,
        drawHeight
      );
    } else {
      context.drawImage(
        source,
        x + (width - drawWidth) / 2,
        y + (height - drawHeight) / 2,
        drawWidth,
        drawHeight
      );
    }

    context.restore();
  }

  function drawRecordingFrame() {
    const context = state.recordingContext;
    const recordCanvas = state.recordingCanvas;

    if (!context || !recordCanvas) return;

    const width = recordCanvas.width;
    const height = recordCanvas.height;

    context.save();
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);

    // Draw PDF slide, if loaded.
    if (pdfCanvas && pdfCanvas.width && pdfCanvas.height) {
      drawContain(context, pdfCanvas, 0, 0, width, height);
    }

    // Draw uploaded image.
    if (state.image) {
      drawContain(context, state.image, 0, 0, width, height);
    }

    // Draw board ink.
    if (canvas) {
      context.drawImage(canvas, 0, 0, width, height);
    }

    // Draw camera into the recording.
    if (
      state.cameraEnabled &&
      mentorVideo &&
      mentorVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
    ) {
      const scaleX = width / Math.max(1, board?.clientWidth || width);
      const scaleY = height / Math.max(1, board?.clientHeight || height);

      const x = state.cameraPosition.x * scaleX;
      const y = state.cameraPosition.y * scaleY;
      const w = state.cameraPosition.width * scaleX;
      const h = state.cameraPosition.height * scaleY;

      context.save();

      context.beginPath();

      if (state.cameraShape === "circle") {
        context.ellipse(
          x + w / 2,
          y + h / 2,
          w / 2,
          h / 2,
          0,
          0,
          Math.PI * 2
        );
      } else if (state.cameraShape === "rounded") {
        const radius = Math.min(20, w / 8, h / 8);
        context.roundRect(x, y, w, h, radius);
      } else {
        context.rect(x, y, w, h);
      }

      context.clip();

      // Note: This is a whole-frame soft blur, not background-only blur.
      if (state.cameraEffect === "soft-blur") {
        context.filter = "blur(2px)";
      } else {
        context.filter = "none";
      }

      drawCover(context, mentorVideo, x, y, w, h, state.cameraMirror);

      context.filter = "none";
      context.restore();

      if (state.cameraFrame) {
        context.save();
        context.strokeStyle = "#ffffff";
        context.lineWidth = 5;
        context.beginPath();

        if (state.cameraShape === "circle") {
          context.ellipse(
            x + w / 2,
            y + h / 2,
            w / 2,
            h / 2,
            0,
            0,
            Math.PI * 2
          );
        } else if (state.cameraShape === "rounded") {
          context.roundRect(x, y, w, h, 20);
        } else {
          context.rect(x, y, w, h);
        }

        context.stroke();
        context.restore();
      }
    }

    context.restore();
  }

  function recordingLoop() {
    if (!state.recording || state.recordingPaused) return;

    drawRecordingFrame();
    state.animationFrame = requestAnimationFrame(recordingLoop);
  }

  function updateRecordingTimer() {
    const timerElement = findElement(
      "#recordingTimer",
      "#recordTimer",
      "[data-recording-timer]"
    );

    if (!timerElement) return;

    const seconds = Math.floor(state.recordingElapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;

    timerElement.textContent =
      `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  }

  function startRecordingClock() {
    state.recordingStartedAt = Date.now() - state.recordingElapsed;

    clearInterval(state.recordingTimer);

    state.recordingTimer = setInterval(() => {
      if (state.recordingPaused) return;

      state.recordingElapsed = Date.now() - state.recordingStartedAt;
      updateRecordingTimer();
    }, 500);
  }

  async function startRecording() {
    if (state.recording) return;

    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
      showToast("Recording is not supported in this browser");
      return;
    }

    if (!state.microphoneStream) {
      await microphoneOn();
    }

    createRecordingCanvas();
    drawRecordingFrame();

    const videoStream = state.recordingCanvas.captureStream(30);
    const tracks = [...videoStream.getVideoTracks()];

    if (state.microphoneStream) {
      tracks.push(...state.microphoneStream.getAudioTracks());
    }

    state.recordingStream = new MediaStream(tracks);

    const mimeTypes = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm"
    ];

    const supportedMime = mimeTypes.find((type) =>
      MediaRecorder.isTypeSupported(type)
    );

    try {
      state.mediaRecorder = supportedMime
        ? new MediaRecorder(state.recordingStream, { mimeType: supportedMime })
        : new MediaRecorder(state.recordingStream);

      state.recordingChunks = [];

      state.mediaRecorder.addEventListener("dataavailable", (event) => {
        if (event.data && event.data.size > 0) {
          state.recordingChunks.push(event.data);
        }
      });

      state.mediaRecorder.addEventListener("stop", showRecordingPreview);

      state.mediaRecorder.start(1000);

      state.recording = true;
      state.recordingPaused = false;
      state.recordingElapsed = 0;

      startRecordingClock();
      recordingLoop();

      showToast("Recording started");
    } catch (error) {
      console.error(error);
      showToast("Could not start recording");
      stopRecordingResources();
    }
  }

  function pauseRecording() {
    if (!state.mediaRecorder || state.mediaRecorder.state !== "recording") return;

    state.mediaRecorder.pause();
    state.recordingPaused = true;

    if (state.animationFrame) {
      cancelAnimationFrame(state.animationFrame);
      state.animationFrame = null;
    }

    showToast("Recording paused");
  }

  function resumeRecording() {
    if (!state.mediaRecorder || state.mediaRecorder.state !== "paused") return;

    state.mediaRecorder.resume();
    state.recordingPaused = false;

    startRecordingClock();
    recordingLoop();

    showToast("Recording resumed");
  }

  function stopRecording() {
    if (!state.mediaRecorder || state.mediaRecorder.state === "inactive") return;

    state.recording = false;
    state.recordingPaused = false;

    clearInterval(state.recordingTimer);

    if (state.animationFrame) {
      cancelAnimationFrame(state.animationFrame);
      state.animationFrame = null;
    }

    state.mediaRecorder.stop();

    showToast("Recording stopped");
  }

  function stopRecordingResources() {
    state.recordingStream?.getTracks().forEach((track) => track.stop());
    state.recordingStream = null;
  }

  function showRecordingPreview() {
    const blob = new Blob(state.recordingChunks, {
      type: state.mediaRecorder?.mimeType || "video/webm"
    });

    const url = URL.createObjectURL(blob);

    if (recordingPreview) {
      recordingPreview.src = url;
      recordingPreview.controls = true;
      recordingPreview.load();
    }

    if (downloadRecordingButton) {
      downloadRecordingButton.href = url;
      downloadRecordingButton.download =
        `snk-smart-board-${new Date().toISOString().replace(/[:.]/g, "-")}.webm`;
    }

    if (recordingModal) {
      recordingModal.hidden = false;
      recordingModal.classList.add("show", "active");
    }

    stopRecordingResources();
    showToast("Your recording is ready");
  }

  /* -----------------------------
     SAVE PNG
  ----------------------------- */

  function saveBoardPNG() {
    if (!canvas) return;

    const output = document.createElement("canvas");
    output.width = canvas.width;
    output.height = canvas.height;

    const outputContext = output.getContext("2d");
    outputContext.fillStyle = "#ffffff";
    outputContext.fillRect(0, 0, output.width, output.height);

    if (pdfCanvas && pdfCanvas.width && pdfCanvas.height) {
      drawContain(outputContext, pdfCanvas, 0, 0, output.width, output.height);
    }

    if (state.image) {
      drawContain(outputContext, state.image, 0, 0, output.width, output.height);
    }

    outputContext.drawImage(canvas, 0, 0);

    const link = document.createElement("a");
    link.download = `snk-smart-board-${Date.now()}.png`;
    link.href = output.toDataURL("image/png");
    link.click();

    showToast("Board image saved");
  }

  /* -----------------------------
     ZOOM AND FULLSCREEN
  ----------------------------- */

  function setZoom(value) {
    state.zoom = Math.max(0.5, Math.min(2, Number(value) || 1));

    const target = findElement("#boardContent", "#boardStage", "#boardWrapper");
    if (target) {
      target.style.transformOrigin = "center center";
      target.style.transform = `scale(${state.zoom})`;
    }

    const zoomLabel = findElement("#zoomValue", "#zoomLabel");
    if (zoomLabel) {
      zoomLabel.textContent = `${Math.round(state.zoom * 100)}%`;
    }
  }

  function zoomIn() {
    setZoom(state.zoom + 0.1);
  }

  function zoomOut() {
    setZoom(state.zoom - 0.1);
  }

  function toggleFullscreen() {
    const target = board || document.documentElement;

    if (!document.fullscreenElement) {
      target.requestFullscreen?.().catch((error) => {
        console.warn("Fullscreen unavailable:", error);
      });
    } else {
      document.exitFullscreen?.();
    }
  }

  /* -----------------------------
     BUTTON CONNECTIONS
  ----------------------------- */

  $$("[data-tool]").forEach((button) => {
    button.addEventListener("click", () => setTool(button.dataset.tool));
  });

  $$("[data-color]").forEach((button) => {
    button.addEventListener("click", () => setColor(button.dataset.color));
  });

  if (colorInput) {
    colorInput.addEventListener("input", () => setColor(colorInput.value));
  }

  if (sizeInput) {
    sizeInput.addEventListener("input", () => setBrushSize(sizeInput.value));
  }

  bindClick(["#undoBtn", "#undoButton", "[data-action='undo']"], undo);
  bindClick(["#redoBtn", "#redoButton", "[data-action='redo']"], redo);
  bindClick(["#clearBtn", "#clearButton", "[data-action='clear']"], clearBoard);

  bindClick(["#imageBtn", "#uploadImageBtn", "[data-action='image']"], () => {
    imageInput?.click();
  });

  bindClick(["#pdfBtn", "#uploadPdfBtn", "[data-action='pdf']"], () => {
    pdfInput?.click();
  });

  bindClick(["#nextPDF", "#pdfNext", "[data-action='next-pdf']"], nextPDFPage);
  bindClick(["#previousPDF", "#pdfPrevious", "[data-action='previous-pdf']"], previousPDFPage);

  bindClick(["#cameraBtn", "#cameraToggle", "[data-action='camera-toggle']"], toggleCamera);
  bindClick(["#cameraOn", "[data-action='camera-on']"], cameraOn);
  bindClick(["#cameraOff", "[data-action='camera-off']"], cameraOff);
  bindClick(["#cameraMirror", "[data-action='camera-mirror']"], toggleCameraMirror);
  bindClick(["#cameraCenter", "[data-action='camera-center']"], centerCamera);

  bindClick(["#micBtn", "#microphoneBtn", "[data-action='microphone']"], () => {
    state.microphoneStream ? microphoneOff() : microphoneOn();
  });

  bindClick(["#recordBtn", "#startRecording", "[data-action='record-start']"], startRecording);
  bindClick(["#pauseRecording", "[data-action='record-pause']"], pauseRecording);
  bindClick(["#resumeRecording", "[data-action='record-resume']"], resumeRecording);
  bindClick(["#stopRecording", "[data-action='record-stop']"], stopRecording);

  bindClick(["#saveBtn", "#savePNG", "[data-action='save']"], saveBoardPNG);
  bindClick(["#fullscreenBtn", "#fullscreen", "[data-action='fullscreen']"], toggleFullscreen);

  bindClick(["#zoomIn", "[data-action='zoom-in']"], zoomIn);
  bindClick(["#zoomOut", "[data-action='zoom-out']"], zoomOut);

  bindClick(["#closeRecordingModal", "#closePreview"], () => {
    if (recordingModal) {
      recordingModal.classList.remove("show", "active");
      recordingModal.hidden = true;
    }
  });

  /* -----------------------------
     CAMERA EFFECT CONTROLS
  ----------------------------- */

  const cameraEffectSelect = findElement("#cameraEffect", "#backgroundEffect");
  if (cameraEffectSelect) {
    cameraEffectSelect.addEventListener("change", () => {
      setCameraEffect(cameraEffectSelect.value);
    });
  }

  const cameraShapeSelect = findElement("#cameraShape", "#cameraFrameShape");
  if (cameraShapeSelect) {
    cameraShapeSelect.addEventListener("change", () => {
      setCameraShape(cameraShapeSelect.value);
    });
  }

  const cameraFrameCheckbox = findElement("#cameraFrameToggle");
  if (cameraFrameCheckbox) {
    cameraFrameCheckbox.addEventListener("change", () => {
      state.cameraFrame = cameraFrameCheckbox.checked;
      applyCameraAppearance();
    });
  }

  const cameraShadowCheckbox = findElement("#cameraShadowToggle");
  if (cameraShadowCheckbox) {
    cameraShadowCheckbox.addEventListener("change", () => {
      state.cameraShadow = cameraShadowCheckbox.checked;
      applyCameraAppearance();
    });
  }

  /* -----------------------------
     WIRELESS CONTROLLER RECEIVER
  ----------------------------- */

  function normalizedToCanvas(payload) {
    const { width, height } = getBoardSize();

    return {
      x: Math.max(0, Math.min(1, Number(payload.x) || 0)) * width,
      y: Math.max(0, Math.min(1, Number(payload.y) || 0)) * height,
      pressure: Number(payload.pressure) || 0.5
    };
  }

  function wirelessPointerDown(payload = {}) {
    if (!ctx) return;

    saveUndoState();

    state.wirelessDrawing = true;
    state.wirelessLastPoint = normalizedToCanvas(payload);

    drawSegment(
      state.wirelessLastPoint,
      state.wirelessLastPoint,
      state.wirelessLastPoint.pressure
    );
  }

  function wirelessPointerBatch(payload = {}) {
    if (!state.wirelessDrawing || !state.wirelessLastPoint) return;

    const points = Array.isArray(payload.points) ? payload.points : [];

    points.forEach((item) => {
      const point = normalizedToCanvas(item);

      drawSegment(
        state.wirelessLastPoint,
        point,
        point.pressure
      );

      state.wirelessLastPoint = point;
    });
  }

  function wirelessPointerUp() {
    state.wirelessDrawing = false;
    state.wirelessLastPoint = null;
  }

  function receiveWirelessCommand(command) {
    if (!command || typeof command !== "object") return;

    const action = command.action || command.type;
    const payload = command.payload || command;

    switch (action) {
      case "pointerdown":
        wirelessPointerDown(payload);
        break;

      case "pointerbatch":
      case "pointermove":
        wirelessPointerBatch(payload);
        break;

      case "pointerup":
        wirelessPointerUp();
        break;

      case "tool":
        setTool(payload.tool);
        break;

      case "color":
        setColor(payload.color);
        break;

      case "size":
        setBrushSize(payload.size);
        break;

      case "undo":
        undo();
        break;

      case "redo":
        redo();
        break;

      case "clear":
        clearBoard();
        break;

      case "cameraOn":
      case "camera-on":
        cameraOn();
        break;

      case "cameraOff":
      case "camera-off":
        cameraOff();
        break;

      case "cameraMirror":
      case "camera-mirror":
        toggleCameraMirror();
        break;

      case "cameraCenter":
      case "camera-center":
        centerCamera();
        break;

      case "zoomIn":
      case "zoom-in":
        zoomIn();
        break;

      case "zoomOut":
      case "zoom-out":
        zoomOut();
        break;

      case "nextPDF":
      case "next-pdf":
        nextPDFPage();
        break;

      case "previousPDF":
      case "previous-pdf":
        previousPDFPage();
        break;

      case "startRecording":
      case "record-start":
        startRecording();
        break;

      case "pauseRecording":
      case "record-pause":
        pauseRecording();
        break;

      case "resumeRecording":
      case "record-resume":
        resumeRecording();
        break;

      case "stopRecording":
      case "record-stop":
        stopRecording();
        break;

      default:
        console.warn("Unknown wireless command:", action);
    }
  }

  window.SNKSmartBoardReceiveCommand = receiveWirelessCommand;

  /* -----------------------------
     OPTIONAL FIREBASE LISTENER
     Requires window.SNKFirebase and pairing state.
  ----------------------------- */

  function connectWirelessFirebase() {
    const firebase = window.SNKFirebase;
    const pairing = window.SNKSmartBoardPairing;

    if (!firebase || !pairing?.state?.sessionPath) return;

    try {
      const database = firebase.database || firebase;
      const commandsRef = database.ref(
        `${pairing.state.sessionPath}/commands`
      );

      window.SNKProcessedWirelessCommands =
        window.SNKProcessedWirelessCommands || new Set();

      commandsRef.limitToLast(100).on("child_added", (snapshot) => {
        const command = snapshot.val();
        if (!command) return;

        const commandId = snapshot.key;

        if (window.SNKProcessedWirelessCommands.has(commandId)) return;
        window.SNKProcessedWirelessCommands.add(commandId);

        receiveWirelessCommand(command);

        // Prevent this browser session's dedupe set growing forever.
        if (window.SNKProcessedWirelessCommands.size > 500) {
          const first = window.SNKProcessedWirelessCommands.values().next().value;
          window.SNKProcessedWirelessCommands.delete(first);
        }
      });

      console.log("SNK wireless command listener connected.");
    } catch (error) {
      console.warn("Wireless Firebase connection failed:", error);
    }
  }

  /* -----------------------------
     KEYBOARD SHORTCUTS
  ----------------------------- */

  document.addEventListener("keydown", (event) => {
    const target = event.target;
    const typing =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target?.isContentEditable;

    if (typing) return;

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      undo();
    } else if (
      (event.ctrlKey || event.metaKey) &&
      event.key.toLowerCase() === "y"
    ) {
      event.preventDefault();
      redo();
    } else if (event.key.toLowerCase() === "p") {
      setTool("pen");
    } else if (event.key.toLowerCase() === "e") {
      setTool("eraser");
    } else if (event.key.toLowerCase() === "m") {
      setTool("marker");
    } else if (event.key === "Escape") {
      if (document.fullscreenElement) {
        document.exitFullscreen?.();
      }
    }
  });

  /* -----------------------------
     INITIALIZE
  ----------------------------- */

  function initialize() {
    if (canvas && ctx) {
      resizeCanvas();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    if (cameraBox) {
      applyCameraPosition();
      applyCameraAppearance();
    }

    if (colorInput) setColor(colorInput.value || state.color);
    if (sizeInput) setBrushSize(sizeInput.value || state.size);

    connectWirelessFirebase();

    window.addEventListener("resize", () => {
      resizeCanvas();
    });

    window.addEventListener("beforeunload", () => {
      state.cameraStream?.getTracks().forEach((track) => track.stop());
      state.microphoneStream?.getTracks().forEach((track) => track.stop());
      state.recordingStream?.getTracks().forEach((track) => track.stop());
    });

    console.log("SNK Smart Board main script initialized.");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }

  /* -----------------------------
     PUBLIC API
  ----------------------------- */

  window.SNKSmartBoard = {
    setTool,
    setColor,
    setBrushSize,
    undo,
    redo,
    clearBoard,
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
    toggleFullscreen,
    receiveWirelessCommand
  };
})();
