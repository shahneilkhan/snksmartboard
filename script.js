/* =========================================================
   SNK SMART BOARD
   SCRIPT.JS
   STEP 11.2.4
   FAST WIRELESS DRAWING ENGINE
   ========================================================= */

"use strict";


/* =========================================================
   SMART BOARD STATE
   ========================================================= */

const smartBoardState = {

  tool: "pen",

  color: "#111827",

  size: 5,

  drawing: false,

  wirelessDrawing: false,

  lastX: 0,

  lastY: 0,

  wirelessLastX: 0,

  wirelessLastY: 0

};


/* =========================================================
   CANVAS
   ========================================================= */

const canvas =
  document.getElementById("drawingCanvas");


let ctx = null;


if (canvas) {

  ctx =
    canvas.getContext(
      "2d",
      {
        alpha: true
      }
    );

}


/* =========================================================
   RESIZE
   ========================================================= */

function resizeSmartBoardCanvas() {

  if (!canvas) {
    return;
  }


  const rect =
    canvas.getBoundingClientRect();


  if (
    rect.width <= 0 ||
    rect.height <= 0
  ) {

    return;

  }


  const oldWidth =
    canvas.width;


  const oldHeight =
    canvas.height;


  const oldImage =
    document.createElement(
      "canvas"
    );


  oldImage.width =
    oldWidth;


  oldImage.height =
    oldHeight;


  if (
    oldWidth > 0 &&
    oldHeight > 0
  ) {

    const oldCtx =
      oldImage.getContext(
        "2d"
      );


    oldCtx.drawImage(
      canvas,
      0,
      0
    );

  }


  const ratio =
    window.devicePixelRatio ||
    1;


  canvas.width =
    Math.round(
      rect.width *
      ratio
    );


  canvas.height =
    Math.round(
      rect.height *
      ratio
    );


  canvas.style.width =
    rect.width + "px";


  canvas.style.height =
    rect.height + "px";


  ctx =
    canvas.getContext(
      "2d",
      {
        alpha: true
      }
    );


  ctx.setTransform(
    ratio,
    0,
    0,
    ratio,
    0,
    0
  );


  if (
    oldWidth > 0 &&
    oldHeight > 0
  ) {

    ctx.drawImage(
      oldImage,
      0,
      0,
      oldWidth,
      oldHeight,
      0,
      0,
      rect.width,
      rect.height
    );

  }

}


window.addEventListener(
  "resize",
  function () {

    setTimeout(
      resizeSmartBoardCanvas,
      100
    );

  }
);


/* =========================================================
   DRAWING STYLE
   ========================================================= */

function applyDrawingStyle() {

  if (!ctx) {
    return;
  }


  ctx.lineCap =
    "round";


  ctx.lineJoin =
    "round";


  if (
    smartBoardState.tool ===
    "eraser"
  ) {

    ctx.globalCompositeOperation =
      "destination-out";

    ctx.globalAlpha =
      1;

  }

  else if (
    smartBoardState.tool ===
    "marker"
  ) {

    ctx.globalCompositeOperation =
      "source-over";

    ctx.globalAlpha =
      0.35;

  }

  else {

    ctx.globalCompositeOperation =
      "source-over";

    ctx.globalAlpha =
      1;

  }


  ctx.strokeStyle =
    smartBoardState.color;


  ctx.lineWidth =
    smartBoardState.size;

}


/* =========================================================
   DRAW ONE SEGMENT
   ========================================================= */

function drawSegment(
  x1,
  y1,
  x2,
  y2,
  pressure = 0.5
) {

  if (
    !ctx ||
    !canvas
  ) {

    return;

  }


  applyDrawingStyle();


  let width =
    smartBoardState.size;


  if (
    pressure > 0 &&
    pressure <= 1
  ) {

    width =
      Math.max(
        1,
        smartBoardState.size *
        (
          0.55 +
          pressure
        )
      );

  }


  ctx.lineWidth =
    width;


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


  ctx.closePath();


  ctx.globalAlpha =
    1;


  ctx.globalCompositeOperation =
    "source-over";

}


/* =========================================================
   NORMAL LOCAL POINTER
   ========================================================= */

function getCanvasPoint(
  clientX,
  clientY
) {

  const rect =
    canvas.getBoundingClientRect();


  return {

    x:
      clientX -
      rect.left,

    y:
      clientY -
      rect.top

  };

}


if (canvas) {

  canvas.addEventListener(
    "pointerdown",
    function (event) {

      smartBoardState.drawing =
        true;


      const point =
        getCanvasPoint(
          event.clientX,
          event.clientY
        );


      smartBoardState.lastX =
        point.x;


      smartBoardState.lastY =
        point.y;


      drawSegment(
        point.x,
        point.y,
        point.x + 0.01,
        point.y + 0.01,
        event.pressure || 0.5
      );


      try {

        canvas.setPointerCapture(
          event.pointerId
        );

      }

      catch (error) {}

    }
  );


  canvas.addEventListener(
    "pointermove",
    function (event) {

      if (
        !smartBoardState.drawing
      ) {

        return;

      }


      const point =
        getCanvasPoint(
          event.clientX,
          event.clientY
        );


      drawSegment(

        smartBoardState.lastX,

        smartBoardState.lastY,

        point.x,

        point.y,

        event.pressure || 0.5

      );


      smartBoardState.lastX =
        point.x;


      smartBoardState.lastY =
        point.y;

    }
  );


  canvas.addEventListener(
    "pointerup",
    function (event) {

      smartBoardState.drawing =
        false;


      try {

        canvas.releasePointerCapture(
          event.pointerId
        );

      }

      catch (error) {}

    }
  );


  canvas.addEventListener(
    "pointercancel",
    function () {

      smartBoardState.drawing =
        false;

    }
  );

}


/* =========================================================
   WIRELESS COORDINATE
   ========================================================= */

function wirelessPoint(
  x,
  y
) {

  const rect =
    canvas.getBoundingClientRect();


  return {

    x:
      x *
      rect.width,

    y:
      y *
      rect.height

  };

}


/* =========================================================
   WIRELESS POINTER DOWN
   ========================================================= */

function wirelessPointerDown(
  payload
) {

  if (
    !payload ||
    !canvas
  ) {

    return;

  }


  const point =
    wirelessPoint(
      payload.x,
      payload.y
    );


  smartBoardState.wirelessDrawing =
    true;


  smartBoardState.wirelessLastX =
    point.x;


  smartBoardState.wirelessLastY =
    point.y;


  drawSegment(
    point.x,
    point.y,
    point.x + 0.01,
    point.y + 0.01,
    payload.pressure || 0.5
  );

}


/* =========================================================
   WIRELESS POINTER BATCH
   ========================================================= */

function wirelessPointerBatch(
  payload
) {

  if (
    !smartBoardState.wirelessDrawing ||
    !payload ||
    !Array.isArray(
      payload.points
    )
  ) {

    return;

  }


  const points =
    payload.points;


  for (
    let i = 0;
    i < points.length;
    i++
  ) {

    const point =
      wirelessPoint(
        points[i].x,
        points[i].y
      );


    drawSegment(

      smartBoardState.wirelessLastX,

      smartBoardState.wirelessLastY,

      point.x,

      point.y,

      points[i].pressure || 0.5

    );


    smartBoardState.wirelessLastX =
      point.x;


    smartBoardState.wirelessLastY =
      point.y;

  }

}


/* =========================================================
   WIRELESS POINTER UP
   ========================================================= */

function wirelessPointerUp() {

  smartBoardState.wirelessDrawing =
    false;

}


/* =========================================================
   TOOL
   ========================================================= */

function setWirelessTool(
  tool
) {

  if (!tool) {
    return;
  }


  smartBoardState.tool =
    tool;


  const button =
    document.querySelector(
      `[data-tool="${tool}"]`
    );


  if (button) {

    document
      .querySelectorAll(
        "[data-tool]"
      )
      .forEach(
        item =>
          item.classList.remove(
            "active"
          )
      );


    button.classList.add(
      "active"
    );

  }

}


/* =========================================================
   COLOR
   ========================================================= */

function setWirelessColor(
  color
) {

  if (!color) {
    return;
  }


  smartBoardState.color =
    color;


  const button =
    document.querySelector(
      `[data-color="${color}"]`
    );


  if (button) {

    document
      .querySelectorAll(
        "[data-color]"
      )
      .forEach(
        item =>
          item.classList.remove(
            "active"
          )
      );


    button.classList.add(
      "active"
    );

  }

}


/* =========================================================
   SIZE
   ========================================================= */

function setWirelessSize(
  size
) {

  const value =
    Number(size);


  if (
    !Number.isFinite(value)
  ) {

    return;

  }


  smartBoardState.size =
    Math.max(
      1,
      Math.min(
        100,
        value
      )
    );


  const input =
    document.querySelector(
      "#sizeRange, #brushSize, #size"
    );


  if (input) {

    input.value =
      smartBoardState.size;

  }


  const label =
    document.querySelector(
      "#sizeValue, #brushSizeValue"
    );


  if (label) {

    label.textContent =
      smartBoardState.size +
      "px";

  }

}


/* =========================================================
   CLEAR
   ========================================================= */

function wirelessClear() {

  if (
    !canvas ||
    !ctx
  ) {

    return;

  }


  const rect =
    canvas.getBoundingClientRect();


  ctx.clearRect(
    0,
    0,
    rect.width,
    rect.height
  );

}


/* =========================================================
   EXISTING FUNCTION FINDER
   ========================================================= */

function callExistingFunction(
  names
) {

  for (
    const name of names
  ) {

    if (
      typeof window[name] ===
      "function"
    ) {

      try {

        window[name]();

      }

      catch (error) {

        console.error(
          name,
          error
        );

      }


      return true;

    }

  }


  return false;

}


/* =========================================================
   WIRELESS COMMAND RECEIVER
   ========================================================= */

window.SNKSmartBoardReceiveCommand =
  function (command) {

    if (!command) {
      return;
    }


    const type =
      command.type;


    const payload =
      command.payload ||
      {};


    switch (type) {


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


      case "pointerup":

        wirelessPointerUp();

        break;


      case "tool":

        setWirelessTool(
          payload.tool
        );

        break;


      case "color":

        setWirelessColor(
          payload.color
        );

        break;


      case "size":

        setWirelessSize(
          payload.size
        );

        break;


      case "undo":

        callExistingFunction(
          [
            "undoDrawing",
            "undo"
          ]
        );

        break;


      case "redo":

        callExistingFunction(
          [
            "redoDrawing",
            "redo"
          ]
        );

        break;


      case "clear":

        wirelessClear();

        break;


      case "new":

        if (
          !callExistingFunction(
            [
              "newBoard"
            ]
          )
        ) {

          wirelessClear();

        }

        break;


      case "zoomIn":

        callExistingFunction(
          [
            "zoomIn"
          ]
        );

        break;


      case "zoomOut":

        callExistingFunction(
          [
            "zoomOut"
          ]
        );

        break;


      case "nextPage":

        callExistingFunction(
          [
            "nextPage"
          ]
        );

        break;


      case "previousPage":

        callExistingFunction(
          [
            "previousPage"
          ]
        );

        break;


      case "nextSlide":

        callExistingFunction(
          [
            "nextSlide"
          ]
        );

        break;


      case "previousSlide":

        callExistingFunction(
          [
            "previousSlide"
          ]
        );

        break;


      case "cameraOn":

        callExistingFunction(
          [
            "startCamera"
          ]
        );

        break;


      case "cameraOff":

        callExistingFunction(
          [
            "stopCamera"
          ]
        );

        break;


      case "cameraMirror":

        callExistingFunction(
          [
            "toggleCameraMirror"
          ]
        );

        break;


      case "startRecording":

        callExistingFunction(
          [
            "startRecording"
          ]
        );

        break;


      case "pauseRecording":

        callExistingFunction(
          [
            "pauseRecording"
          ]
        );

        break;


      case "resumeRecording":

        callExistingFunction(
          [
            "resumeRecording"
          ]
        );

        break;


      case "stopRecording":

        callExistingFunction(
          [
            "stopRecording"
          ]
        );

        break;


      default:

        console.log(
          "Unknown command:",
          type
        );

    }

  };


/* =========================================================
   FIREBASE WIRELESS LISTENER
   ========================================================= */

function startWirelessListener() {

  if (
    !window.SNKFirebase
  ) {

    setTimeout(
      startWirelessListener,
      500
    );

    return;

  }


  if (
    !window.SNKSmartBoardPairing ||
    !window
      .SNKSmartBoardPairing
      .state
  ) {

    setTimeout(
      startWirelessListener,
      500
    );

    return;

  }


  const pairingState =
    window
      .SNKSmartBoardPairing
      .state;


  if (
    !pairingState.sessionPath
  ) {

    setTimeout(
      startWirelessListener,
      500
    );

    return;

  }


  const {

    db,
    ref,
    onValue

  } =
    window.SNKFirebase;


  const commandRef =
    ref(
      db,
      pairingState.sessionPath +
      "/commands"
    );


  onValue(
    commandRef,
    function (snapshot) {

      const commands =
        snapshot.val();


      if (!commands) {
        return;
      }


      Object
        .entries(commands)
        .forEach(
          function (
            [id, command]
          ) {

            if (
              window
                .SNKProcessedWirelessCommands
                .has(id)
            ) {

              return;

            }


            window
              .SNKProcessedWirelessCommands
              .add(id);


            window
              .SNKSmartBoardReceiveCommand(
                command
              );

          }
        );

    }
  );


  console.log(
    "Fast wireless listener ready."
  );

}


window.SNKProcessedWirelessCommands =
  new Set();


/* =========================================================
   INIT
   ========================================================= */

window.addEventListener(
  "load",
  function () {

    setTimeout(
      resizeSmartBoardCanvas,
      300
    );


    setTimeout(
      startWirelessListener,
      1500
    );

  }
);
