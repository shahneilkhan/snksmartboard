/* =========================================================
   SNK SMART BOARD
   SCRIPT.JS
   STEP 11.2.3
   WIRELESS PEN + TOUCH DRAWING
   ========================================================= */

"use strict";


/* =========================================================
   BASIC STATE
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

  wirelessLastY: 0,

  wirelessPointerId: null

};


/* =========================================================
   CANVAS
   ========================================================= */

const canvas =
  document.getElementById("drawingCanvas");


let ctx = null;


if (canvas) {

  ctx =
    canvas.getContext("2d", {
      alpha: true
    });

}


/* =========================================================
   CANVAS SIZE
   ========================================================= */

function resizeSmartBoardCanvas() {

  if (!canvas || !ctx) {
    return;
  }


  const rect =
    canvas.getBoundingClientRect();


  const oldCanvas =
    document.createElement("canvas");


  oldCanvas.width =
    canvas.width;

  oldCanvas.height =
    canvas.height;


  const oldCtx =
    oldCanvas.getContext("2d");


  if (
    canvas.width > 0 &&
    canvas.height > 0
  ) {

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
    Math.max(
      1,
      Math.round(
        rect.width * ratio
      )
    );


  canvas.height =
    Math.max(
      1,
      Math.round(
        rect.height * ratio
      )
    );


  canvas.style.width =
    rect.width + "px";


  canvas.style.height =
    rect.height + "px";


  ctx =
    canvas.getContext("2d", {
      alpha: true
    });


  ctx.setTransform(
    ratio,
    0,
    0,
    ratio,
    0,
    0
  );


  if (
    oldCanvas.width > 0 &&
    oldCanvas.height > 0
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


window.addEventListener(
  "resize",
  resizeSmartBoardCanvas
);


/* =========================================================
   DRAW SETTINGS
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
   GET CANVAS POSITION
   ========================================================= */

function getCanvasPoint(
  clientX,
  clientY
) {

  if (!canvas) {

    return {
      x: 0,
      y: 0
    };

  }


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


/* =========================================================
   DRAW LINE
   ========================================================= */

function drawLine(
  x1,
  y1,
  x2,
  y2,
  pressure = 0.5
) {

  if (!ctx) {
    return;
  }


  applyDrawingStyle();


  let width =
    smartBoardState.size;


  /*
    Pen pressure support.

    Most normal touch devices
    return around 0.5.

    Active stylus can provide
    a real pressure value.
  */

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
   LOCAL MOUSE / TOUCH / PEN
   ========================================================= */

if (canvas) {


  canvas.addEventListener(
    "pointerdown",
    function (event) {

      /*
        Prevent drawing twice when
        wireless controller is being
        used separately.
      */

      smartBoardState.drawing =
        true;


      canvas.setPointerCapture(
        event.pointerId
      );


      const point =
        getCanvasPoint(
          event.clientX,
          event.clientY
        );


      smartBoardState.lastX =
        point.x;


      smartBoardState.lastY =
        point.y;


      /*
        Dot at pointer start
      */

      drawLine(
        point.x,
        point.y,
        point.x + 0.01,
        point.y + 0.01,
        event.pressure || 0.5
      );

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


      drawLine(

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
   WIRELESS DRAWING
   ========================================================= */

function wirelessPointerDown(
  payload
) {

  if (!payload) {
    return;
  }


  smartBoardState.wirelessDrawing =
    true;


  const point =
    getWirelessCanvasPoint(
      payload.x,
      payload.y
    );


  smartBoardState.wirelessLastX =
    point.x;


  smartBoardState.wirelessLastY =
    point.y;


  /*
    Start point dot
  */

  drawLine(

    point.x,

    point.y,

    point.x + 0.01,

    point.y + 0.01,

    payload.pressure || 0.5

  );

}


function wirelessPointerMove(
  payload
) {

  if (
    !smartBoardState.wirelessDrawing ||
    !payload
  ) {

    return;

  }


  const point =
    getWirelessCanvasPoint(
      payload.x,
      payload.y
    );


  drawLine(

    smartBoardState.wirelessLastX,

    smartBoardState.wirelessLastY,

    point.x,

    point.y,

    payload.pressure || 0.5

  );


  smartBoardState.wirelessLastX =
    point.x;


  smartBoardState.wirelessLastY =
    point.y;

}


function wirelessPointerUp() {

  smartBoardState.wirelessDrawing =
    false;

}


/* =========================================================
   WIRELESS COORDINATE CONVERSION
   ========================================================= */

function getWirelessCanvasPoint(
  x,
  y
) {

  if (!canvas) {

    return {
      x: 0,
      y: 0
    };

  }


  const rect =
    canvas.getBoundingClientRect();


  /*
    Tablet sends its own screen
    coordinates.

    Controller.js sends normalized
    coordinates between 0 and 1.

    This lets different phone/tablet
    screen sizes work with the laptop.
  */


  if (
    x >= 0 &&
    x <= 1 &&
    y >= 0 &&
    y <= 1
  ) {

    return {

      x:
        x *
        rect.width,

      y:
        y *
        rect.height

    };

  }


  return {

    x:
      x,

    y:
      y

  };

}


/* =========================================================
   TOOL COMMAND
   ========================================================= */

function wirelessSetTool(
  tool
) {

  if (!tool) {
    return;
  }


  smartBoardState.tool =
    tool;


  /*
    Try to update existing UI
  */

  const toolButton =
    document.querySelector(
      `[data-tool="${tool}"]`
    );


  if (toolButton) {

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


    toolButton.classList.add(
      "active"
    );

  }


  console.log(
    "Wireless tool:",
    tool
  );

}


/* =========================================================
   COLOR COMMAND
   ========================================================= */

function wirelessSetColor(
  color
) {

  if (!color) {
    return;
  }


  smartBoardState.color =
    color;


  const colorButton =
    document.querySelector(
      `[data-color="${color}"]`
    );


  if (colorButton) {

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


    colorButton.classList.add(
      "active"
    );

  }

}


/* =========================================================
   SIZE COMMAND
   ========================================================= */

function wirelessSetSize(
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


  const sizeInput =
    document.querySelector(
      "#sizeRange, #brushSize, #size"
    );


  if (sizeInput) {

    sizeInput.value =
      smartBoardState.size;

  }


  const sizeValue =
    document.querySelector(
      "#sizeValue, #brushSizeValue"
    );


  if (sizeValue) {

    sizeValue.textContent =
      smartBoardState.size +
      "px";

  }

}


/* =========================================================
   CLEAR
   ========================================================= */

function clearSmartBoardCanvas() {

  if (!canvas || !ctx) {
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


  console.log(
    "Wireless clear"
  );

}


/* =========================================================
   UNDO
   ========================================================= */

function wirelessUndo() {

  /*
    If your existing Smart Board
    already has an undo function,
    use it automatically.
  */

  if (
    typeof window.undoDrawing ===
    "function"
  ) {

    window.undoDrawing();

    return;

  }


  if (
    typeof window.undo ===
    "function"
  ) {

    window.undo();

    return;

  }


  console.log(
    "Undo requested"
  );

}


/* =========================================================
   REDO
   ========================================================= */

function wirelessRedo() {

  if (
    typeof window.redoDrawing ===
    "function"
  ) {

    window.redoDrawing();

    return;

  }


  if (
    typeof window.redo ===
    "function"
  ) {

    window.redo();

    return;

  }


  console.log(
    "Redo requested"
  );

}


/* =========================================================
   MAIN WIRELESS COMMAND RECEIVER
   ========================================================= */

window.SNKSmartBoardReceiveCommand =
  function (command) {

    if (!command) {
      return;
    }


    console.log(
      "WIRELESS COMMAND:",
      command
    );


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


      case "pointermove":

        wirelessPointerMove(
          payload
        );

        break;


      case "pointerup":

        wirelessPointerUp();

        break;


      case "tool":

        wirelessSetTool(
          payload.tool
        );

        break;


      case "color":

        wirelessSetColor(
          payload.color
        );

        break;


      case "size":

        wirelessSetSize(
          payload.size
        );

        break;


      case "undo":

        wirelessUndo();

        break;


      case "redo":

        wirelessRedo();

        break;


      case "clear":

        clearSmartBoardCanvas();

        break;


      case "new":

        if (
          typeof window.newBoard ===
          "function"
        ) {

          window.newBoard();

        }
        else {

          clearSmartBoardCanvas();

        }

        break;


      case "zoomIn":

        if (
          typeof window.zoomIn ===
          "function"
        ) {

          window.zoomIn();

        }

        break;


      case "zoomOut":

        if (
          typeof window.zoomOut ===
          "function"
        ) {

          window.zoomOut();

        }

        break;


      case "nextPage":

        if (
          typeof window.nextPage ===
          "function"
        ) {

          window.nextPage();

        }

        break;


      case "previousPage":

        if (
          typeof window.previousPage ===
          "function"
        ) {

          window.previousPage();

        }

        break;


      case "nextSlide":

        if (
          typeof window.nextSlide ===
          "function"
        ) {

          window.nextSlide();

        }

        break;


      case "previousSlide":

        if (
          typeof window.previousSlide ===
          "function"
        ) {

          window.previousSlide();

        }

        break;


      case "cameraOn":

        if (
          typeof window.startCamera ===
          "function"
        ) {

          window.startCamera();

        }

        break;


      case "cameraOff":

        if (
          typeof window.stopCamera ===
          "function"
        ) {

          window.stopCamera();

        }

        break;


      case "cameraMirror":

        if (
          typeof window.toggleCameraMirror ===
          "function"
        ) {

          window.toggleCameraMirror();

        }

        break;


      case "startRecording":

        if (
          typeof window.startRecording ===
          "function"
        ) {

          window.startRecording();

        }

        break;


      case "pauseRecording":

        if (
          typeof window.pauseRecording ===
          "function"
        ) {

          window.pauseRecording();

        }

        break;


      case "resumeRecording":

        if (
          typeof window.resumeRecording ===
          "function"
        ) {

          window.resumeRecording();

        }

        break;


      case "stopRecording":

        if (
          typeof window.stopRecording ===
          "function"
        ) {

          window.stopRecording();

        }

        break;


      default:

        console.log(
          "Unknown wireless command:",
          type
        );

    }

  };


/* =========================================================
   FIREBASE COMMAND LISTENER
   ========================================================= */

function startWirelessCommandListener() {

  if (
    !window.SNKFirebase
  ) {

    setTimeout(
      startWirelessCommandListener,
      300
    );

    return;

  }


  const {

    db,
    ref,
    onValue

  } =
    window.SNKFirebase;


  /*
    The pairing system creates
    the session dynamically.

    We watch the pairing code
    stored by the laptop.
  */

  function waitForSession() {

    if (
      window.SNKSmartBoardPairing &&
      window.SNKSmartBoardPairing.state &&
      window.SNKSmartBoardPairing.state.sessionPath
    ) {

      const path =
        window
          .SNKSmartBoardPairing
          .state
          .sessionPath;


      const commandRef =
        ref(
          db,
          path +
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

                if (!command) {
                  return;
                }


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
        "Wireless command listener active"
      );


      return;

    }


    setTimeout(
      waitForSession,
      500
    );

  }


  waitForSession();

}


window.SNKProcessedWirelessCommands =
  new Set();


/* =========================================================
   INITIALIZE
   ========================================================= */

window.addEventListener(
  "load",
  function () {

    setTimeout(
      resizeSmartBoardCanvas,
      300
    );


    setTimeout(
      startWirelessCommandListener,
      1000
    );

  }
);
