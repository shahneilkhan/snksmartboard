/* =========================================================
   SNK SMART BOARD
   TEACHER SMART BOARD ENGINE
   STEP 12.5.2
   ========================================================= */

(() => {
  "use strict";

  /* =======================================================
     SESSION PROTECTION
     ======================================================= */

  const sessionKey = "snkSmartBoardSession";

  try {
    const session = JSON.parse(
      sessionStorage.getItem(sessionKey) || "null"
    );

    if (!session || session.role !== "teacher") {
      window.location.href = "../login.html";
      return;
    }
  } catch (error) {
    window.location.href = "../login.html";
    return;
  }

  /* =======================================================
     DOM HELPERS
     ======================================================= */

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  const board = $("#board");
  const drawingCanvas = $("#drawingCanvas");
  const pdfCanvas = $("#pdfCanvas");
  const imageLayer = $("#imageLayer");

  const mentorVideo = $("#mentorVideo");
  const cameraBox = $("#cameraBox");
  const cameraResize = $("#cameraResize");

  const imageInput = $("#imageInput");
  const pdfInput = $("#pdfInput");

  const recordingModal = $("#recordingModal");
  const recordingPreview = $("#recordingPreview");
  const downloadRecording = $("#downloadRecording");

  const toastEl = $("#toast");

  if (!board || !drawingCanvas) {
    console.error("SNK Smart Board: required board elements missing.");
    return;
  }

  const ctx = drawingCanvas.getContext("2d", {
    alpha: true,
    desynchronized: true
  });

  const pdfCtx = pdfCanvas
    ? pdfCanvas.getContext("2d", {
        alpha: false
      })
    : null;

  /* =======================================================
     STATE
     ======================================================= */

  const state = {
    tool: "pen",
    color: "#1677ff",
    size: 4,

    drawing: false,
    lastX: 0,
    lastY: 0,
    lastPressure: 0.5,

    undoStack: [],
    redoStack: [],

    pages: [],
    currentPage: 0,

    zoom: 1,

    currentImage: null,
    currentPdf: null,
    pdfPage: 1,
    pdfTotalPages: 0,

    cameraStream: null,
    microphoneStream: null,

    cameraOn: false,
    mirror: true,

    camera: {
      x: 0,
      y: 0,
      width: 210,
      height: 145,
      dragging: false,
      resizing: false,
      dragOffsetX: 0,
      dragOffsetY: 0,
      startX: 0,
      startY: 0,
      startWidth: 210,
      startHeight: 145
    },

    recording: {
      active: false,
      paused: false,
      recorder: null,
      chunks: [],
      stream: null,
      startedAt: 0,
      elapsedBeforePause: 0,
      timer: null,
      mimeType: "",
      url: "",
      audioTracks: []
    },

    recordCanvas: null,
    recordCtx: null,

    savedImageName: "",
    savedPdfName: ""
  };

  /* =======================================================
     TOAST
     ======================================================= */

  let toastTimer = null;

  function showToast(message, duration = 2200) {
    if (!toastEl) return;

    toastEl.textContent = message;
    toastEl.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
      toastEl.classList.remove("show");
    }, duration);
  }

  /* =======================================================
     BUTTON FINDER
     ======================================================= */

  function findButton(...names) {
    for (const name of names) {
      const byId = document.getElementById(name);
      if (byId) return byId;

      const byData = document.querySelector(
        `[data-action="${name}"]`
      );

      if (byData) return byData;

      const byCommand = document.querySelector(
        `[data-command="${name}"]`
      );

      if (byCommand) return byCommand;
    }

    return null;
  }

  function findButtonsByText(words) {
    const elements = $$("button");

    return elements.find((button) => {
      const text = (button.textContent || "").trim().toLowerCase();

      return words.some((word) =>
        text.includes(word.toLowerCase())
      );
    });
  }

  /* =======================================================
     CANVAS SIZE
     ======================================================= */

  function resizeDrawingCanvas() {
    const rect = board.getBoundingClientRect();

    if (!rect.width || !rect.height) return;

    const dpr = Math.max(
      1,
      Math.min(window.devicePixelRatio || 1, 2)
    );

    const oldData =
      drawingCanvas.width > 0 && drawingCanvas.height > 0
        ? drawingCanvas.toDataURL()
        : null;

    drawingCanvas.width = Math.round(rect.width * dpr);
    drawingCanvas.height = Math.round(rect.height * dpr);

    drawingCanvas.style.width = `${rect.width}px`;
    drawingCanvas.style.height = `${rect.height}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (oldData) {
      const image = new Image();

      image.onload = () => {
        ctx.clearRect(0, 0, rect.width, rect.height);
        ctx.drawImage(
          image,
          0,
          0,
          rect.width,
          rect.height
        );
      };

      image.src = oldData;
    } else {
      clearCanvasVisual();
    }
  }

  function clearCanvasVisual() {
    const rect = board.getBoundingClientRect();

    ctx.clearRect(
      0,
      0,
      rect.width,
      rect.height
    );
  }

  function getBoardPoint(event) {
    const rect = drawingCanvas.getBoundingClientRect();

    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  /* =======================================================
     DRAWING
     ======================================================= */

  function setupBrush() {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }

  function getPressure(event) {
    if (
      typeof event.pressure === "number" &&
      event.pressure > 0
    ) {
      return event.pressure;
    }

    return 0.5;
  }

  function getBrushSize(pressure = 0.5) {
    if (state.tool === "marker") {
      return Math.max(
        state.size * 2.2,
        state.size + pressure * 5
      );
    }

    if (state.tool === "eraser") {
      return Math.max(
        state.size * 3,
        state.size + pressure * 8
      );
    }

    return Math.max(
      1,
      state.size * (0.65 + pressure * 0.7)
    );
  }

  function applyBrushStyle(pressure = 0.5) {
    setupBrush();

    const width = getBrushSize(pressure);

    ctx.lineWidth = width;

    if (state.tool === "eraser") {
      ctx.globalCompositeOperation =
        "destination-out";

      ctx.globalAlpha = 1;
    } else if (state.tool === "marker") {
      ctx.globalCompositeOperation =
        "source-over";

      ctx.globalAlpha = 0.28;
      ctx.strokeStyle = state.color;
    } else {
      ctx.globalCompositeOperation =
        "source-over";

      ctx.globalAlpha = 1;
      ctx.strokeStyle = state.color;
    }
  }

  function drawLine(
    x1,
    y1,
    x2,
    y2,
    pressure = 0.5
  ) {
    applyBrushStyle(pressure);

    ctx.beginPath();

    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);

    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation =
      "source-over";
  }

  function beginDrawing(event) {
    if (
      event.pointerType === "mouse" &&
      event.button !== 0
    ) {
      return;
    }

    if (
      state.tool === "text" ||
      state.tool === "shape"
    ) {
      return;
    }

    event.preventDefault();

    drawingCanvas.setPointerCapture?.(
      event.pointerId
    );

    const point = getBoardPoint(event);

    state.drawing = true;
    state.lastX = point.x;
    state.lastY = point.y;
    state.lastPressure = getPressure(event);

    saveUndoState();

    drawLine(
      point.x,
      point.y,
      point.x + 0.01,
      point.y + 0.01,
      state.lastPressure
    );
  }

  function continueDrawing(event) {
    if (!state.drawing) return;

    event.preventDefault();

    const point = getBoardPoint(event);
    const pressure = getPressure(event);

    drawLine(
      state.lastX,
      state.lastY,
      point.x,
      point.y,
      pressure
    );

    state.lastX = point.x;
    state.lastY = point.y;
    state.lastPressure = pressure;
  }

  function endDrawing(event) {
    if (!state.drawing) return;

    event.preventDefault();

    state.drawing = false;

    try {
      drawingCanvas.releasePointerCapture?.(
        event.pointerId
      );
    } catch (_) {}

    saveCurrentPage();
  }

  drawingCanvas.addEventListener(
    "pointerdown",
    beginDrawing
  );

  drawingCanvas.addEventListener(
    "pointermove",
    continueDrawing
  );

  drawingCanvas.addEventListener(
    "pointerup",
    endDrawing
  );

  drawingCanvas.addEventListener(
    "pointercancel",
    endDrawing
  );

  drawingCanvas.addEventListener(
    "pointerleave",
    (event) => {
      if (state.drawing) {
        continueDrawing(event);
      }
    }
  );

  /* =======================================================
     TOOL SYSTEM
     ======================================================= */

  function setTool(tool) {
    state.tool = tool;

    $$(".tool").forEach((button) => {
      button.classList.remove("active");

      const buttonTool =
        button.dataset.tool ||
        button.dataset.action;

      if (
        buttonTool === tool ||
        button.id === `tool-${tool}`
      ) {
        button.classList.add("active");
      }
    });

    if (tool === "pen") {
      drawingCanvas.style.cursor = "crosshair";
    } else if (tool === "marker") {
      drawingCanvas.style.cursor = "crosshair";
    } else if (tool === "eraser") {
      drawingCanvas.style.cursor = "cell";
    } else if (tool === "text") {
      drawingCanvas.style.cursor = "text";
    } else if (tool === "shape") {
      drawingCanvas.style.cursor = "crosshair";
    }

    showToast(
      tool.charAt(0).toUpperCase() +
        tool.slice(1) +
        " selected"
    );
  }

  function setupToolButtons() {
    $$(".tool").forEach((button) => {
      const tool =
        button.dataset.tool ||
        button.dataset.action;

      if (
        [
          "pen",
          "marker",
          "eraser",
          "text",
          "shape"
        ].includes(tool)
      ) {
        button.addEventListener("click", () => {
          setTool(tool);
        });
      }
    });

    const pen = findButton(
      "pen",
      "toolPen"
    );

    const marker = findButton(
      "marker",
      "toolMarker"
    );

    const eraser = findButton(
      "eraser",
      "toolEraser"
    );

    const text = findButton(
      "text",
      "toolText"
    );

    const shape = findButton(
      "shape",
      "toolShape"
    );

    pen?.addEventListener("click", () =>
      setTool("pen")
    );

    marker?.addEventListener("click", () =>
      setTool("marker")
    );

    eraser?.addEventListener("click", () =>
      setTool("eraser")
    );

    text?.addEventListener("click", () =>
      setTool("text")
    );

    shape?.addEventListener("click", () =>
      setTool("shape")
    );
  }

  /* =======================================================
     COLOR + SIZE
     ======================================================= */

  function setupColorAndSize() {
    const colorInput =
      document.querySelector(
        "#colorPicker, #colorInput, input[type='color']"
      );

    if (colorInput) {
      state.color = colorInput.value || state.color;

      colorInput.addEventListener(
        "input",
        () => {
          state.color = colorInput.value;
        }
      );
    }

    const sizeInput =
      document.querySelector(
        "#sizeSlider, #brushSize, input[type='range']"
      );

    if (sizeInput) {
      state.size =
        Number(sizeInput.value) || state.size;

      sizeInput.addEventListener(
        "input",
        () => {
          state.size =
            Number(sizeInput.value) || 4;
        }
      );
    }
  }

  /* =======================================================
     UNDO / REDO
     ======================================================= */

  function getCanvasSnapshot() {
    return drawingCanvas.toDataURL(
      "image/png"
    );
  }

  function restoreSnapshot(data) {
    if (!data) {
      clearCanvasVisual();
      return;
    }

    const image = new Image();

    image.onload = () => {
      const rect =
        board.getBoundingClientRect();

      clearCanvasVisual();

      ctx.drawImage(
        image,
        0,
        0,
        rect.width,
        rect.height
      );
    };

    image.src = data;
  }

  function saveUndoState() {
    try {
      state.undoStack.push(
        getCanvasSnapshot()
      );

      if (state.undoStack.length > 40) {
        state.undoStack.shift();
      }

      state.redoStack = [];
    } catch (error) {
      console.warn(
        "Could not save undo state",
        error
      );
    }
  }

  function undo() {
    if (!state.undoStack.length) {
      showToast("Nothing to undo");
      return;
    }

    const current =
      getCanvasSnapshot();

    state.redoStack.push(current);

    const previous =
      state.undoStack.pop();

    restoreSnapshot(previous);

    saveCurrentPage();

    showToast("Undo");
  }

  function redo() {
    if (!state.redoStack.length) {
      showToast("Nothing to redo");
      return;
    }

    const current =
      getCanvasSnapshot();

    state.undoStack.push(current);

    const next =
      state.redoStack.pop();

    restoreSnapshot(next);

    saveCurrentPage();

    showToast("Redo");
  }

  function clearBoard() {
    saveUndoState();

    clearCanvasVisual();

    saveCurrentPage();

    showToast("Board cleared");
  }

  /* =======================================================
     IMAGE UPLOAD
     ======================================================= */

  function openImagePicker() {
    imageInput?.click();
  }

  function removeCurrentImage() {
    if (!state.currentImage) return;

    state.currentImage = null;

    if (imageLayer) {
      imageLayer.innerHTML = "";
    }

    saveCurrentPage();

    showToast("Image removed");
  }

  function createImageElement(
    image,
    name = "Image"
  ) {
    if (!imageLayer) return;

    imageLayer.innerHTML = "";

    const wrapper =
      document.createElement("div");

    wrapper.className =
      "uploaded-board-image";

    wrapper.style.position = "absolute";
    wrapper.style.left = "5%";
    wrapper.style.top = "5%";
    wrapper.style.width = "90%";
    wrapper.style.height = "90%";

    wrapper.style.display = "flex";
    wrapper.style.alignItems = "center";
    wrapper.style.justifyContent = "center";

    wrapper.style.pointerEvents = "none";

    const img =
      document.createElement("img");

    img.src = image.src || image;
    img.alt = name;

    img.style.maxWidth = "100%";
    img.style.maxHeight = "100%";
    img.style.objectFit = "contain";

    img.style.pointerEvents = "none";

    wrapper.appendChild(img);
    imageLayer.appendChild(wrapper);
  }

  function handleImageUpload(file) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast("Please select an image");
      return;
    }

    const reader =
      new FileReader();

    reader.onload = (event) => {
      const image =
        new Image();

      image.onload = () => {
        state.currentImage = image;
        state.savedImageName = file.name;

        createImageElement(
          image,
          file.name
        );

        showToast(
          "Image added to Smart Board"
        );

        saveCurrentPage();
      };

      image.src =
        event.target.result;
    };

    reader.readAsDataURL(file);
  }

  imageInput?.addEventListener(
    "change",
    (event) => {
      const file =
        event.target.files?.[0];

      handleImageUpload(file);

      event.target.value = "";
    }
  );

  /* =======================================================
     PDF SYSTEM
     ======================================================= */

  let pdfDocument = null;

  function openPdfPicker() {
    pdfInput?.click();
  }

  async function renderPdfPage(
    pageNumber = 1
  ) {
    if (!pdfDocument || !pdfCanvas || !pdfCtx) {
      return;
    }

    try {
      const page =
        await pdfDocument.getPage(
          pageNumber
        );

      const containerWidth =
        board.clientWidth || 1000;

      const viewport =
        page.getViewport({
          scale: 1
        });

      const scale =
        containerWidth /
        viewport.width;

      const finalScale =
        Math.min(
          Math.max(scale, 0.7),
          2.2
        );

      const scaledViewport =
        page.getViewport({
          scale: finalScale
        });

      const dpr = Math.min(
        window.devicePixelRatio || 1,
        2
      );

      pdfCanvas.width =
        Math.round(
          scaledViewport.width * dpr
        );

      pdfCanvas.height =
        Math.round(
          scaledViewport.height * dpr
        );

      pdfCanvas.style.width =
        `${scaledViewport.width}px`;

      pdfCanvas.style.height =
        `${scaledViewport.height}px`;

      pdfCtx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
      );

      pdfCtx.clearRect(
        0,
        0,
        scaledViewport.width,
        scaledViewport.height
      );

      await page.render({
        canvasContext: pdfCtx,
        viewport: scaledViewport
      }).promise;

      state.pdfPage = pageNumber;

      showPdfCanvas();

      updatePdfStatus();

      saveCurrentPage();
    } catch (error) {
      console.error(
        "PDF render error:",
        error
      );

      showToast(
        "Could not render PDF page"
      );
    }
  }

  function showPdfCanvas() {
    if (!pdfCanvas) return;

    pdfCanvas.style.display =
      "block";
  }

  function hidePdfCanvas() {
    if (!pdfCanvas) return;

    pdfCanvas.style.display =
      "none";
  }

  async function handlePdfUpload(file) {
    if (!file) return;

    if (
      file.type !==
        "application/pdf" &&
      !file.name
        .toLowerCase()
        .endsWith(".pdf")
    ) {
      showToast("Please select a PDF");
      return;
    }

    if (
      typeof window.pdfjsLib ===
      "undefined"
    ) {
      showToast(
        "PDF engine is not loaded"
      );

      return;
    }

    try {
      showToast(
        "Opening PDF..."
      );

      const arrayBuffer =
        await file.arrayBuffer();

      pdfDocument =
        await window.pdfjsLib.getDocument({
          data: arrayBuffer
        }).promise;

      state.currentPdf =
        file.name;

      state.savedPdfName =
        file.name;

      state.pdfTotalPages =
        pdfDocument.numPages;

      state.pdfPage = 1;

      await renderPdfPage(1);

      showToast(
        `PDF loaded: ${pdfDocument.numPages} pages`
      );
    } catch (error) {
      console.error(error);

      showToast(
        "Unable to open PDF"
      );
    }
  }

  pdfInput?.addEventListener(
    "change",
    (event) => {
      const file =
        event.target.files?.[0];

      handlePdfUpload(file);

      event.target.value = "";
    }
  );

  function pdfNext() {
    if (
      !pdfDocument ||
      state.pdfPage >=
        state.pdfTotalPages
    ) {
      return;
    }

    renderPdfPage(
      state.pdfPage + 1
    );
  }

  function pdfPrevious() {
    if (
      !pdfDocument ||
      state.pdfPage <= 1
    ) {
      return;
    }

    renderPdfPage(
      state.pdfPage - 1
    );
  }

  function updatePdfStatus() {
    const elements =
      $$("[data-pdf-status]");

    elements.forEach((element) => {
      element.textContent =
        pdfDocument
          ? `PDF ${state.pdfPage} / ${state.pdfTotalPages}`
          : "No PDF";
    });
  }

  /* =======================================================
     PAGE SYSTEM
     ======================================================= */

  function createPage() {
    return {
      drawing: null,
      imageData: null,
      pdfPage: 1
    };
  }

  function ensurePages() {
    if (!state.pages.length) {
      state.pages.push(
        createPage()
      );
    }
  }

  function saveCurrentPage() {
    ensurePages();

    state.pages[
      state.currentPage
    ] = {
      drawing:
        getCanvasSnapshot(),

      imageData:
        state.currentImage
          ? state.currentImage.src
          : null,

      pdfPage:
        state.pdfPage
    };

    updatePageIndicator();
  }

  function loadCurrentPage() {
    ensurePages();

    const page =
      state.pages[
        state.currentPage
      ];

    clearCanvasVisual();

    if (page?.drawing) {
      restoreSnapshot(
        page.drawing
      );
    }

    if (
      page?.imageData
    ) {
      const image =
        new Image();

      image.onload = () => {
        state.currentImage =
          image;

        createImageElement(
          image,
          "Saved image"
        );
      };

      image.src =
        page.imageData;
    } else if (imageLayer) {
      imageLayer.innerHTML = "";
      state.currentImage = null;
    }

    if (
      pdfDocument &&
      page?.pdfPage
    ) {
      renderPdfPage(
        Math.min(
          page.pdfPage,
          state.pdfTotalPages
        )
      );
    }

    updatePageIndicator();
  }

  function addPage() {
    saveCurrentPage();

    state.pages.push(
      createPage()
    );

    state.currentPage =
      state.pages.length - 1;

    clearCanvasVisual();

    if (imageLayer) {
      imageLayer.innerHTML = "";
    }

    state.currentImage = null;

    showToast(
      `Page ${state.currentPage + 1} created`
    );

    updatePageIndicator();
  }

  function nextBoardPage() {
    saveCurrentPage();

    if (
      state.currentPage <
      state.pages.length - 1
    ) {
      state.currentPage++;

      loadCurrentPage();

      showToast(
        `Page ${state.currentPage + 1}`
      );
    }
  }

  function previousBoardPage() {
    saveCurrentPage();

    if (state.currentPage > 0) {
      state.currentPage--;

      loadCurrentPage();

      showToast(
        `Page ${state.currentPage + 1}`
      );
    }
  }

  function updatePageIndicator() {
    const elements =
      $$(
        "[data-page-indicator]"
      );

    elements.forEach((element) => {
      element.textContent =
        `${state.currentPage + 1} / ${Math.max(
          state.pages.length,
          1
        )}`;
    });
  }

  /* =======================================================
     ZOOM
     ======================================================= */

  function applyZoom() {
    state.zoom =
      Math.max(
        0.5,
        Math.min(
          state.zoom,
          2
        )
      );

    board.style.transform =
      `scale(${state.zoom})`;

    const elements =
      $$("[data-zoom-value]");

    elements.forEach((element) => {
      element.textContent =
        `${Math.round(
          state.zoom * 100
        )}%`;
    });
  }

  function zoomIn() {
    state.zoom += 0.1;
    applyZoom();
  }

  function zoomOut() {
    state.zoom -= 0.1;
    applyZoom();
  }

  function resetZoom() {
    state.zoom = 1;
    applyZoom();
  }

  /* =======================================================
     CAMERA
     ======================================================= */

  function cameraPositionDefaults() {
    state.camera.width = 210;
    state.camera.height = 145;

    state.camera.x =
      Math.max(
        10,
        board.clientWidth -
          state.camera.width -
          20
      );

    state.camera.y = 20;

    applyCameraPosition();
  }

  function applyCameraPosition() {
    if (!cameraBox) return;

    cameraBox.style.left =
      `${state.camera.x}px`;

    cameraBox.style.top =
      `${state.camera.y}px`;

    cameraBox.style.right =
      "auto";

    cameraBox.style.width =
      `${state.camera.width}px`;

    cameraBox.style.height =
      `${state.camera.height}px`;
  }

  async function startCamera() {
    if (state.cameraOn) {
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
      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            width: {
              ideal: 1280
            },

            height: {
              ideal: 720
            },

            facingMode:
              "user"
          },

          audio: false
        });

      state.cameraStream =
        stream;

      mentorVideo.srcObject =
        stream;

      mentorVideo.muted = true;
      mentorVideo.playsInline = true;

      await mentorVideo.play();

      state.cameraOn = true;

      if (state.mirror) {
        mentorVideo.style.transform =
          "scaleX(-1)";
      } else {
        mentorVideo.style.transform =
          "scaleX(1)";
      }

      cameraBox?.classList.add(
        "camera-active"
      );

      cameraPositionDefaults();

      updateCameraButtons();

      showToast(
        "Camera turned on"
      );
    } catch (error) {
      console.error(error);

      showToast(
        "Camera permission was denied"
      );
    }
  }

  function stopCamera() {
    if (state.cameraStream) {
      state.cameraStream
        .getTracks()
        .forEach((track) => {
          track.stop();
        });
    }

    state.cameraStream = null;
    state.cameraOn = false;

    if (mentorVideo) {
      mentorVideo.srcObject = null;
    }

    updateCameraButtons();

    showToast(
      "Camera turned off"
    );
  }

  function toggleCamera() {
    if (state.cameraOn) {
      stopCamera();
    } else {
      startCamera();
    }
  }

  function toggleMirror() {
    state.mirror =
      !state.mirror;

    if (mentorVideo) {
      mentorVideo.style.transform =
        state.mirror
          ? "scaleX(-1)"
          : "scaleX(1)";
    }

    showToast(
      state.mirror
        ? "Camera mirrored"
        : "Mirror disabled"
    );
  }

  function updateCameraButtons() {
    const buttons =
      $$("[data-camera-toggle]");

    buttons.forEach((button) => {
      button.textContent =
        state.cameraOn
          ? "Camera Off"
          : "Camera On";

      button.classList.toggle(
        "active",
        state.cameraOn
      );
    });
  }

  /* =======================================================
     CAMERA DRAG
     ======================================================= */

  function getBoardCoordinates(
    event
  ) {
    const rect =
      board.getBoundingClientRect();

    return {
      x:
        (event.clientX -
          rect.left) /
        state.zoom,

      y:
        (event.clientY -
          rect.top) /
        state.zoom
    };
  }

  function beginCameraDrag(event) {
    if (
      !cameraBox ||
      event.target === cameraResize
    ) {
      return;
    }

    if (
      !state.cameraOn ||
      event.pointerType === "mouse" &&
      event.button !== 0
    ) {
      return;
    }

    event.preventDefault();

    state.camera.dragging = true;

    const point =
      getBoardCoordinates(event);

    state.camera.dragOffsetX =
      point.x -
      state.camera.x;

    state.camera.dragOffsetY =
      point.y -
      state.camera.y;

    cameraBox.setPointerCapture?.(
      event.pointerId
    );
  }

  function moveCameraDrag(event) {
    if (!state.camera.dragging) {
      return;
    }

    event.preventDefault();

    const point =
      getBoardCoordinates(event);

    state.camera.x =
      point.x -
      state.camera.dragOffsetX;

    state.camera.y =
      point.y -
      state.camera.dragOffsetY;

    constrainCamera();

    applyCameraPosition();
  }

  function endCameraDrag() {
    state.camera.dragging = false;
  }

  cameraBox?.addEventListener(
    "pointerdown",
    beginCameraDrag
  );

  cameraBox?.addEventListener(
    "pointermove",
    moveCameraDrag
  );

  cameraBox?.addEventListener(
    "pointerup",
    endCameraDrag
  );

  cameraBox?.addEventListener(
    "pointercancel",
    endCameraDrag
  );

  /* =======================================================
     CAMERA RESIZE
     ======================================================= */

  function beginCameraResize(event) {
    if (!cameraBox) return;

    event.preventDefault();
    event.stopPropagation();

    state.camera.resizing = true;

    state.camera.startX =
      event.clientX;

    state.camera.startY =
      event.clientY;

    state.camera.startWidth =
      state.camera.width;

    state.camera.startHeight =
      state.camera.height;

    cameraResize.setPointerCapture?.(
      event.pointerId
    );
  }

  function moveCameraResize(event) {
    if (!state.camera.resizing) {
      return;
    }

    event.preventDefault();

    const dx =
      event.clientX -
      state.camera.startX;

    const dy =
      event.clientY -
      state.camera.startY;

    state.camera.width =
      Math.max(
        120,
        state.camera.startWidth +
          dx / state.zoom
      );

    state.camera.height =
      Math.max(
        85,
        state.camera.startHeight +
          dy / state.zoom
      );

    if (
      state.camera.width >
      board.clientWidth * 0.55
    ) {
      state.camera.width =
        board.clientWidth * 0.55;
    }

    if (
      state.camera.height >
      board.clientHeight * 0.55
    ) {
      state.camera.height =
        board.clientHeight * 0.55;
    }

    constrainCamera();
    applyCameraPosition();
  }

  function endCameraResize() {
    state.camera.resizing = false;
  }

  cameraResize?.addEventListener(
    "pointerdown",
    beginCameraResize
  );

  cameraResize?.addEventListener(
    "pointermove",
    moveCameraResize
  );

  cameraResize?.addEventListener(
    "pointerup",
    endCameraResize
  );

  cameraResize?.addEventListener(
    "pointercancel",
    endCameraResize
  );

  function constrainCamera() {
    const maxX =
      Math.max(
        0,
        board.clientWidth -
          state.camera.width
      );

    const maxY =
      Math.max(
        0,
        board.clientHeight -
          state.camera.height
      );

    state.camera.x =
      Math.max(
        0,
        Math.min(
          state.camera.x,
          maxX
        )
      );

    state.camera.y =
      Math.max(
        0,
        Math.min(
          state.camera.y,
          maxY
        )
      );
  }

  /* =======================================================
     CAMERA EFFECT
     ======================================================= */

  function setCameraEffect(effect) {
    if (!cameraBox) return;

    cameraBox.classList.remove(
      "effect-normal",
      "effect-soft-blur",
      "effect-office",
      "effect-classroom",
      "effect-gradient"
    );

    cameraBox.classList.add(
      `effect-${effect}`
    );

    showToast(
      `Camera effect: ${effect}`
    );
  }

  function setupCameraEffect() {
    const select =
      document.querySelector(
        "#cameraEffect, [data-camera-effect]"
      );

    select?.addEventListener(
      "change",
      () => {
        setCameraEffect(
          select.value
        );
      }
    );
  }

  /* =======================================================
     CAMERA CENTER
     ======================================================= */

  function centerCamera() {
    state.camera.x =
      Math.max(
        0,
        (board.clientWidth -
          state.camera.width) /
          2
      );

    state.camera.y =
      Math.max(
        0,
        (board.clientHeight -
          state.camera.height) /
          2
      );

    applyCameraPosition();

    showToast(
      "Camera centered"
    );
  }

  /* =======================================================
     MICROPHONE
     ======================================================= */

  async function getMicrophone() {
    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      throw new Error(
        "Microphone is not supported"
      );
    }

    const stream =
      await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },

        video: false
      });

    state.microphoneStream =
      stream;

    return stream;
  }

  function stopMicrophone() {
    if (state.microphoneStream) {
      state.microphoneStream
        .getTracks()
        .forEach((track) => {
          track.stop();
        });
    }

    state.microphoneStream = null;
  }

  /* =======================================================
     RECORDING CANVAS
     ======================================================= */

  function createRecordCanvas() {
    if (!state.recordCanvas) {
      state.recordCanvas =
        document.createElement("canvas");

      state.recordCanvas.width = 1280;
      state.recordCanvas.height = 720;

      state.recordCtx =
        state.recordCanvas.getContext(
          "2d",
          {
            alpha: false
          }
        );
    }
  }

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

    context.drawImage(
      source,
      drawX,
      drawY,
      drawWidth,
      drawHeight
    );
  }

  function drawCover(
    context,
    source,
    x,
    y,
    width,
    height
  ) {
    if (
      !source ||
      !source.videoWidth &&
      !source.width
    ) {
      return;
    }

    const sourceWidth =
      source.videoWidth ||
      source.width;

    const sourceHeight =
      source.videoHeight ||
      source.height;

    const scale =
      Math.max(
        width / sourceWidth,
        height / sourceHeight
      );

    const drawWidth =
      sourceWidth * scale;

    const drawHeight =
      sourceHeight * scale;

    const drawX =
      x +
      (width - drawWidth) / 2;

    const drawY =
      y +
      (height - drawHeight) / 2;

    context.drawImage(
      source,
      drawX,
      drawY,
      drawWidth,
      drawHeight
    );
  }

  function renderRecordingFrame() {
    if (
      !state.recordCtx ||
      !state.recordCanvas
    ) {
      return;
    }

    const c =
      state.recordCtx;

    const W =
      state.recordCanvas.width;

    const H =
      state.recordCanvas.height;

    /* Background */
    c.fillStyle = "#ffffff";

    c.fillRect(
      0,
      0,
      W,
      H
    );

    /* -----------------------------------------------------
       PDF
       ----------------------------------------------------- */

    if (
      pdfCanvas &&
      pdfCanvas.width &&
      pdfCanvas.height &&
      pdfCanvas.style.display !==
        "none"
    ) {
      drawContain(
        c,
        pdfCanvas,
        0,
        0,
        W,
        H
      );
    }

    /* -----------------------------------------------------
       IMAGE
       ----------------------------------------------------- */

    if (state.currentImage) {
      drawContain(
        c,
        state.currentImage,
        0,
        0,
        W,
        H
      );
    }

    /* -----------------------------------------------------
       DRAWING
       ----------------------------------------------------- */

    if (
      drawingCanvas &&
      drawingCanvas.width
    ) {
      const boardRect =
        board.getBoundingClientRect();

      const scaleX =
        W /
        Math.max(
          1,
          boardRect.width
        );

      const scaleY =
        H /
        Math.max(
          1,
          boardRect.height
        );

      c.save();

      c.scale(
        scaleX,
        scaleY
      );

      c.drawImage(
        drawingCanvas,
        0,
        0,
        boardRect.width,
        boardRect.height
      );

      c.restore();
    }

    /* -----------------------------------------------------
       CAMERA
       ----------------------------------------------------- */

    if (
      state.cameraOn &&
      mentorVideo &&
      mentorVideo.readyState >= 2
    ) {
      const boardWidth =
        board.clientWidth;

      const boardHeight =
        board.clientHeight;

      const scaleX =
        W /
        Math.max(
          1,
          boardWidth
        );

      const scaleY =
        H /
        Math.max(
          1,
          boardHeight
        );

      const x =
        state.camera.x *
        scaleX;

      const y =
        state.camera.y *
        scaleY;

      const width =
        state.camera.width *
        scaleX;

      const height =
        state.camera.height *
        scaleY;

      c.save();

      /* Shadow */
      c.shadowColor =
        "rgba(0,0,0,0.28)";

      c.shadowBlur = 22;

      c.shadowOffsetY = 7;

      c.beginPath();

      if (
        cameraBox?.classList.contains(
          "circle"
        )
      ) {
        c.arc(
          x + width / 2,
          y + height / 2,
          Math.min(
            width,
            height
          ) / 2,
          0,
          Math.PI * 2
        );
      } else {
        const radius =
          cameraBox?.classList.contains(
            "rectangle"
          )
            ? 8
            : 18;

        roundedRect(
          c,
          x,
          y,
          width,
          height,
          radius
        );
      }

      c.clip();

      if (state.mirror) {
        c.translate(
          x + width,
          y
        );

        c.scale(-1, 1);

        drawCover(
          c,
          mentorVideo,
          0,
          0,
          width,
          height
        );
      } else {
        drawCover(
          c,
          mentorVideo,
          x,
          y,
          width,
          height
        );
      }

      c.restore();

      /* Frame */
      c.save();

      c.strokeStyle =
        "rgba(255,255,255,0.96)";

      c.lineWidth = 5;

      c.beginPath();

      if (
        cameraBox?.classList.contains(
          "circle"
        )
      ) {
        c.arc(
          x + width / 2,
          y + height / 2,
          Math.min(
            width,
            height
          ) / 2 - 3,
          0,
          Math.PI * 2
        );
      } else {
        roundedRect(
          c,
          x + 2,
          y + 2,
          width - 4,
          height - 4,
          18
        );
      }

      c.stroke();

      c.restore();
    }

    /* -----------------------------------------------------
       BRAND WATERMARK
       ----------------------------------------------------- */

    c.save();

    c.fillStyle =
      "rgba(23,32,51,0.72)";

    c.font =
      "600 18px Arial";

    c.fillText(
      "SNK Smart Board",
      24,
      H - 24
    );

    c.restore();
  }

  function roundedRect(
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

    context.beginPath();

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

    context.closePath();
  }

  /* =======================================================
     RECORDING MIME TYPE
     ======================================================= */

  function getRecordingMimeType() {
    const types = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm"
    ];

    if (
      !window.MediaRecorder
    ) {
      return "";
    }

    return (
      types.find((type) =>
        MediaRecorder.isTypeSupported(
          type
        )
      ) || ""
    );
  }

  /* =======================================================
     START RECORDING
     ======================================================= */

  async function startRecording() {
    if (
      state.recording.active
    ) {
      return;
    }

    if (
      !window.MediaRecorder
    ) {
      showToast(
        "Recording is not supported in this browser"
      );

      return;
    }

    try {
      createRecordCanvas();

      await getMicrophone();

      const canvasStream =
        state.recordCanvas.captureStream(
          30
        );

      const audioTracks =
        state.microphoneStream
          ? state.microphoneStream.getAudioTracks()
          : [];

      audioTracks.forEach(
        (track) => {
          canvasStream.addTrack(track);
        }
      );

      state.recording.stream =
        canvasStream;

      state.recording.audioTracks =
        audioTracks;

      const mimeType =
        getRecordingMimeType();

      state.recording.mimeType =
        mimeType;

      const options =
        mimeType
          ? {
              mimeType
            }
          : undefined;

      const recorder =
        new MediaRecorder(
          canvasStream,
          options
        );

      state.recording.recorder =
        recorder;

      state.recording.chunks = [];

      recorder.ondataavailable =
        (event) => {
          if (
            event.data &&
            event.data.size > 0
          ) {
            state.recording.chunks.push(
              event.data
            );
          }
        };

      recorder.onerror =
        (event) => {
          console.error(
            "MediaRecorder error:",
            event
          );

          showToast(
            "Recording error occurred"
          );
        };

      recorder.onstop =
        handleRecordingStop;

      recorder.start(1000);

      state.recording.active = true;
      state.recording.paused = false;
      state.recording.startedAt =
        Date.now();
      state.recording.elapsedBeforePause =
        0;

      startRecordingTimer();

      updateRecordingUI();

      showToast(
        "Class recording started"
      );

      renderRecordingLoop();
    } catch (error) {
      console.error(
        "Recording start failed:",
        error
      );

      stopMicrophone();

      showToast(
        "Microphone permission is required"
      );
    }
  }

  /* =======================================================
     RECORDING RENDER LOOP
     ======================================================= */

  let recordingAnimationId = null;

  function renderRecordingLoop() {
    if (
      !state.recording.active
    ) {
      return;
    }

    renderRecordingFrame();

    recordingAnimationId =
      requestAnimationFrame(
        renderRecordingLoop
      );
  }

  function stopRecordingLoop() {
    if (
      recordingAnimationId
    ) {
      cancelAnimationFrame(
        recordingAnimationId
      );

      recordingAnimationId =
        null;
    }
  }

  /* =======================================================
     PAUSE / RESUME
     ======================================================= */

  function pauseRecording() {
    const recorder =
      state.recording.recorder;

    if (
      !state.recording.active ||
      !recorder
    ) {
      return;
    }

    if (
      recorder.state ===
      "recording"
    ) {
      recorder.pause();

      state.recording.paused =
        true;

      state.recording.elapsedBeforePause +=
        Date.now() -
        state.recording.startedAt;

      stopRecordingTimer();

      updateRecordingUI();

      showToast(
        "Recording paused"
      );
    }
  }

  function resumeRecording() {
    const recorder =
      state.recording.recorder;

    if (
      !state.recording.active ||
      !recorder
    ) {
      return;
    }

    if (
      recorder.state ===
      "paused"
    ) {
      recorder.resume();

      state.recording.paused =
        false;

      state.recording.startedAt =
        Date.now();

      startRecordingTimer();

      updateRecordingUI();

      showToast(
        "Recording resumed"
      );

      renderRecordingLoop();
    }
  }

  /* =======================================================
     STOP RECORDING
     ======================================================= */

  function stopRecording() {
    const recorder =
      state.recording.recorder;

    if (
      !state.recording.active ||
      !recorder
    ) {
      return;
    }

    try {
      if (
        recorder.state !==
        "inactive"
      ) {
        recorder.stop();
      }
    } catch (error) {
      console.error(error);

      handleRecordingStop();
    }
  }

  function handleRecordingStop() {
    stopRecordingLoop();
    stopRecordingTimer();

    const mime =
      state.recording.mimeType ||
      "video/webm";

    const blob =
      new Blob(
        state.recording.chunks,
        {
          type: mime
        }
      );

    if (state.recording.url) {
      URL.revokeObjectURL(
        state.recording.url
      );
    }

    state.recording.url =
      URL.createObjectURL(blob);

    state.recording.active =
      false;

    state.recording.paused =
      false;

    if (
      recordingPreview
    ) {
      recordingPreview.src =
        state.recording.url;

      recordingPreview.controls =
        true;
    }

    if (
      downloadRecording
    ) {
      downloadRecording.href =
        state.recording.url;

      downloadRecording.download =
        `SNK-Smart-Board-${formatDateForFile()}.webm`;

      downloadRecording.style.display =
        "inline-flex";
    }

    stopMicrophone();

    if (
      state.recording.stream
    ) {
      state.recording.stream
        .getTracks()
        .forEach((track) => {
          try {
            track.stop();
          } catch (_) {}
        });
    }

    state.recording.stream =
      null;

    state.recording.recorder =
      null;

    updateRecordingUI();

    showRecordingModal();

    showToast(
      "Recording finished"
    );
  }

  /* =======================================================
     RECORDING TIMER
     ======================================================= */

  function startRecordingTimer() {
    stopRecordingTimer();

    state.recording.timer =
      setInterval(() => {
        updateRecordingTimer();
      }, 500);
  }

  function stopRecordingTimer() {
    if (
      state.recording.timer
    ) {
      clearInterval(
        state.recording.timer
      );

      state.recording.timer =
        null;
    }
  }

  function getElapsedMilliseconds() {
    if (
      state.recording.paused
    ) {
      return (
        state.recording.elapsedBeforePause
      );
    }

    return (
      state.recording.elapsedBeforePause +
      (
        state.recording.active
          ? Date.now() -
            state.recording.startedAt
          : 0
      )
    );
  }

  function formatTime(milliseconds) {
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
      hours,
      minutes,
      seconds
    ]
      .map((value) =>
        String(value).padStart(
          2,
          "0"
        )
      )
      .join(":");
  }

  function updateRecordingTimer() {
    const timer =
      $(".record-timer");

    if (!timer) return;

    timer.textContent =
      formatTime(
        getElapsedMilliseconds()
      );
  }

  function formatDateForFile() {
    const date =
      new Date();

    return date
      .toISOString()
      .replace(
        /[:.]/g,
        "-"
      );
  }

  function updateRecordingUI() {
    const light =
      $(".recording-light");

    if (light) {
      light.classList.toggle(
        "active",
        state.recording.active &&
          !state.recording.paused
      );

      light.classList.toggle(
        "paused",
        state.recording.paused
      );
    }

    const start =
      findButton(
        "startRecording",
        "recordStart"
      );

    const pause =
      findButton(
        "pauseRecording",
        "recordPause"
      );

    const resume =
      findButton(
        "resumeRecording",
        "recordResume"
      );

    const stop =
      findButton(
        "stopRecording",
        "recordStop"
      );

    if (start) {
      start.disabled =
        state.recording.active;
    }

    if (pause) {
      pause.disabled =
        !state.recording.active ||
        state.recording.paused;
    }

    if (resume) {
      resume.disabled =
        !state.recording.active ||
        !state.recording.paused;
    }

    if (stop) {
      stop.disabled =
        !state.recording.active;
    }

    updateRecordingTimer();
  }

  /* =======================================================
     RECORDING MODAL
     ======================================================= */

  function showRecordingModal() {
    if (!recordingModal) return;

    recordingModal.classList.add(
      "show"
    );
  }

  function closeRecordingModal() {
    recordingModal?.classList.remove(
      "show"
    );

    if (
      recordingPreview
    ) {
      recordingPreview.pause();
    }
  }

  /* =======================================================
     MICROPHONE BUTTON
     ======================================================= */

  async function testMicrophone() {
    try {
      if (
        state.microphoneStream
      ) {
        stopMicrophone();

        showToast(
          "Microphone turned off"
        );

        return;
      }

      await getMicrophone();

      showToast(
        "Microphone is ready"
      );
    } catch (error) {
      console.error(error);

      showToast(
        "Microphone permission denied"
      );
    }
  }

  /* =======================================================
     SAVE PNG
     ======================================================= */

  function saveBoardPNG() {
    createRecordCanvas();

    renderRecordingFrame();

    const link =
      document.createElement("a");

    link.download =
      `SNK-Smart-Board-${formatDateForFile()}.png`;

    link.href =
      state.recordCanvas.toDataURL(
        "image/png"
      );

    link.click();

    showToast(
      "Board image saved"
    );
  }

  /* =======================================================
     FULLSCREEN
     ======================================================= */

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        showToast(
          "Fullscreen enabled"
        );
      } else {
        await document.exitFullscreen();

        showToast(
          "Fullscreen disabled"
        );
      }
    } catch (error) {
      console.error(error);

      showToast(
        "Fullscreen is not available"
      );
    }
  }

  /* =======================================================
     NEW BOARD
     ======================================================= */

  function newBoard() {
    const confirmed =
      window.confirm(
        "Start a new Smart Board?"
      );

    if (!confirmed) return;

    state.pages = [
      createPage()
    ];

    state.currentPage = 0;

    state.undoStack = [];
    state.redoStack = [];

    state.currentImage = null;

    if (imageLayer) {
      imageLayer.innerHTML = "";
    }

    clearCanvasVisual();

    if (pdfCanvas) {
      hidePdfCanvas();
    }

    state.currentPdf = null;
    pdfDocument = null;
    state.pdfPage = 1;
    state.pdfTotalPages = 0;

    updatePageIndicator();
    updatePdfStatus();

    showToast(
      "New Smart Board created"
    );
  }

  /* =======================================================
     KEYBOARD SHORTCUTS
     ======================================================= */

  document.addEventListener(
    "keydown",
    (event) => {
      const key =
        event.key.toLowerCase();

      if (
        (event.ctrlKey ||
          event.metaKey) &&
        key === "z"
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
        key === "y"
      ) {
        event.preventDefault();

        redo();

        return;
      }

      if (key === "escape") {
        closeRecordingModal();

        return;
      }

      if (key === "p") {
        setTool("pen");
      }

      if (key === "m") {
        setTool("marker");
      }

      if (key === "e") {
        setTool("eraser");
      }
    }
  );

  /* =======================================================
     GENERIC ACTION SETUP
     ======================================================= */

  function setupActions() {
    findButton(
      "undo",
      "undoButton"
    )?.addEventListener(
      "click",
      undo
    );

    findButton(
      "redo",
      "redoButton"
    )?.addEventListener(
      "click",
      redo
    );

    findButton(
      "clear",
      "clearBoard"
    )?.addEventListener(
      "click",
      clearBoard
    );

    findButton(
      "new",
      "newBoard"
    )?.addEventListener(
      "click",
      newBoard
    );

    findButton(
      "image",
      "openImage",
      "uploadImage"
    )?.addEventListener(
      "click",
      openImagePicker
    );

    findButton(
      "pdf",
      "openPdf",
      "uploadPdf"
    )?.addEventListener(
      "click",
      openPdfPicker
    );

    findButton(
      "save",
      "saveBoard",
      "save"
    )?.addEventListener(
      "click",
      saveBoardPNG
    );

    findButton(
      "fullscreen"
    )?.addEventListener(
      "click",
      toggleFullscreen
    );

    findButton(
      "zoomIn"
    )?.addEventListener(
      "click",
      zoomIn
    );

    findButton(
      "zoomOut"
    )?.addEventListener(
      "click",
      zoomOut
    );

    findButton(
      "zoomReset"
    )?.addEventListener(
      "click",
      resetZoom
    );

    findButton(
      "nextPage"
    )?.addEventListener(
      "click",
      nextBoardPage
    );

    findButton(
      "previousPage"
    )?.addEventListener(
      "click",
      previousBoardPage
    );

    findButton(
      "addPage"
    )?.addEventListener(
      "click",
      addPage
    );

    findButton(
      "pdfNext"
    )?.addEventListener(
      "click",
      pdfNext
    );

    findButton(
      "pdfPrevious"
    )?.addEventListener(
      "click",
      pdfPrevious
    );

    findButton(
      "cameraOn",
      "cameraToggle"
    )?.addEventListener(
      "click",
      toggleCamera
    );

    findButton(
      "cameraOff"
    )?.addEventListener(
      "click",
      stopCamera
    );

    findButton(
      "cameraMirror"
    )?.addEventListener(
      "click",
      toggleMirror
    );

    findButton(
      "cameraCenter",
      "centerCamera"
    )?.addEventListener(
      "click",
      centerCamera
    );

    findButton(
      "microphone",
      "mic"
    )?.addEventListener(
      "click",
      testMicrophone
    );

    findButton(
      "startRecording",
      "recordStart"
    )?.addEventListener(
      "click",
      startRecording
    );

    findButton(
      "pauseRecording",
      "recordPause"
    )?.addEventListener(
      "click",
      pauseRecording
    );

    findButton(
      "resumeRecording",
      "recordResume"
    )?.addEventListener(
      "click",
      resumeRecording
    );

    findButton(
      "stopRecording",
      "recordStop"
    )?.addEventListener(
      "click",
      stopRecording
    );

    findButton(
      "closeRecording",
      "closeModal"
    )?.addEventListener(
      "click",
      closeRecordingModal
    );

    document
      .querySelector(
        ".modal-close"
      )
      ?.addEventListener(
        "click",
        closeRecordingModal
      );

    recordingModal?.addEventListener(
      "click",
      (event) => {
        if (
          event.target ===
          recordingModal
        ) {
          closeRecordingModal();
        }
      }
    );
  }

  /* =======================================================
     DATA-ACTION FALLBACK
     ======================================================= */

  function setupDataActions() {
    $$("[data-action]").forEach(
      (element) => {
        if (
          element.dataset.bound ===
          "true"
        ) {
          return;
        }

        const action =
          element.dataset.action;

        let handler = null;

        switch (action) {
          case "undo":
            handler = undo;
            break;

          case "redo":
            handler = redo;
            break;

          case "clear":
            handler = clearBoard;
            break;

          case "new":
            handler = newBoard;
            break;

          case "save":
            handler = saveBoardPNG;
            break;

          case "fullscreen":
            handler = toggleFullscreen;
            break;

          case "image":
            handler = openImagePicker;
            break;

          case "pdf":
            handler = openPdfPicker;
            break;

          case "zoomIn":
            handler = zoomIn;
            break;

          case "zoomOut":
            handler = zoomOut;
            break;

          case "nextPage":
            handler = nextBoardPage;
            break;

          case "previousPage":
            handler = previousBoardPage;
            break;

          case "addPage":
            handler = addPage;
            break;

          case "nextSlide":
          case "nextPdf":
            handler = pdfNext;
            break;

          case "previousSlide":
          case "previousPdf":
            handler = pdfPrevious;
            break;

          case "camera":
          case "cameraToggle":
            handler = toggleCamera;
            break;

          case "cameraMirror":
            handler = toggleMirror;
            break;

          case "cameraCenter":
            handler = centerCamera;
            break;

          case "startRecording":
            handler = startRecording;
            break;

          case "pauseRecording":
            handler = pauseRecording;
            break;

          case "resumeRecording":
            handler = resumeRecording;
            break;

          case "stopRecording":
            handler = stopRecording;
            break;

          case "microphone":
            handler = testMicrophone;
            break;
        }

        if (handler) {
          element.addEventListener(
            "click",
            handler
          );

          element.dataset.bound =
            "true";
        }
      }
    );
  }

  /* =======================================================
     RESPONSIVE RESIZE
     ======================================================= */

  let resizeTimer = null;

  window.addEventListener(
    "resize",
    () => {
      clearTimeout(
        resizeTimer
      );

      resizeTimer =
        setTimeout(() => {
          resizeDrawingCanvas();

          constrainCamera();

          applyCameraPosition();

          if (
            pdfDocument &&
            state.pdfPage
          ) {
            renderPdfPage(
              state.pdfPage
            );
          }
        }, 180);
    }
  );

  /* =======================================================
     PAGE VISIBILITY
     ======================================================= */

  document.addEventListener(
    "visibilitychange",
    () => {
      if (
        document.hidden &&
        state.recording.active
      ) {
        /*
          Do not stop recording.
          Browser may continue rendering
          depending on tab policy.
        */
      }
    }
  );

  /* =======================================================
     BEFORE UNLOAD
     ======================================================= */

  window.addEventListener(
    "beforeunload",
    () => {
      if (
        state.cameraStream
      ) {
        state.cameraStream
          .getTracks()
          .forEach((track) =>
            track.stop()
          );
      }

      if (
        state.microphoneStream
      ) {
        state.microphoneStream
          .getTracks()
          .forEach((track) =>
            track.stop()
          );
      }

      if (
        state.recording.recorder &&
        state.recording.recorder.state !==
          "inactive"
      ) {
        try {
          state.recording.recorder.stop();
        } catch (_) {}
      }
    }
  );

  /* =======================================================
     INITIALIZATION
     ======================================================= */

  function initialize() {
    ensurePages();

    setupBrush();
    setupToolButtons();
    setupColorAndSize();

    setupActions();
    setupDataActions();

    setupCameraEffect();

    resizeDrawingCanvas();

    cameraPositionDefaults();

    applyZoom();

    updatePageIndicator();
    updatePdfStatus();

    updateCameraButtons();
    updateRecordingUI();

    setTool("pen");

    /*
      Give browser a moment to finish layout,
      then resize canvas again.
    */
    requestAnimationFrame(() => {
      resizeDrawingCanvas();
      cameraPositionDefaults();
    });

    console.log(
      "SNK Smart Board Teacher Engine loaded."
    );
  }

  initialize();

  /* =======================================================
     PUBLIC API
     ======================================================= */

  window.SNKSmartBoard = {
    startCamera,
    stopCamera,
    toggleCamera,

    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,

    undo,
    redo,
    clearBoard,

    zoomIn,
    zoomOut,
    resetZoom,

    nextBoardPage,
    previousBoardPage,
    addPage,

    pdfNext,
    pdfPrevious,

    setTool,
    saveBoardPNG,

    state
  };

})();
