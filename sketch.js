let ax = 0;
let ay = 0;
let az = 0;

let wx = 0;
let wy = 0;
let wz = 0;

let isRecording = false;
let isPreparing = false;
let samples = [];
let smoothedSamples =[];
let trimStartTime = null;
let trimEndTime = null;
const minTrimDuration = 2000;
let gesturePalette = [
  [84, 0.025, 245, 0.5],
  [75, 0.050, 250, 0.5],
  [66, 0.075, 255, 0.5]
]; 
let recordingStartTime;
let playbackStartTime = null;

let startButton;
let expandButton;

let statusText;
let tableContainer;


let viewYaw = 0;
let viewPitch = -0.2;
let viewDistance = 800;
let gestureRadius = 0;
let maxViewDistance = 1600;
let minViewDistance = 250;
let viewTargetX = 0;
let viewTargetY = 0;
let viewTargetZ = 0;

let activePointers = new Map();
let lastPinchDistance = null;


function setup() {
let gestureArea = document.getElementById("gesture-area");

gestureArea.style.display = "block";
let size = gestureArea.clientWidth;
gestureArea.style.display = "none";


let canvas = createCanvas(size, size, WEBGL);
  colorMode(OKLCH, 100, 0.4, 360, 1);

  canvas.parent("gesture-area");
  gestureArea.style.display = "none";

  canvas.elt.style.touchAction = "none";

  canvas.elt.addEventListener("pointerdown", startOrbit);
  canvas.elt.addEventListener("pointermove", moveOrbit);
  canvas.elt.addEventListener("pointerup", stopOrbit);
  canvas.elt.addEventListener("pointercancel", stopOrbit);

  const enableButton = createButton("Wake me up");
  enableButton.parent("capture-button-area");
  enableButton.elt.addEventListener("click", enableMotion);

  startButton = createButton("Go on, then");
  startButton.parent("capture-button-area");
  startButton.hide();
  startButton.elt.addEventListener("click", startCapture);

  statusText = createP("");
  statusText.parent("recording-status-area");
  

  tableContainer = createDiv();

 
  
  expandButton = createButton("Expand");
  expandButton.parent("gesture-area");
  expandButton.class("expand-view-button");
  expandButton.elt.addEventListener("click", toggleExpandedView);

  

  let resetButton = createButton("Reset view");
  resetButton.class("reset-view-button");
  resetButton.parent("gesture-area");
  resetButton.elt.addEventListener("click", resetView);


  const trimToggle = document.getElementById("trim-toggle");
  const trimControls = document.getElementById("trim-controls");

  trimToggle.addEventListener("click", () => {
    const isOpen = !trimControls.hidden;

    trimControls.hidden = isOpen;
    trimToggle.textContent = isOpen ? "Trim" : "Done";
  });

  const trimTimeline = document.getElementById("trim-timeline");
  const trimStartHandle = document.getElementById("trim-start-handle");
  const trimSelection = document.getElementById("trim-selection");

let dragStartX = null;
let dragStartTime = null;

trimStartHandle.addEventListener("pointerdown", (event) => {
  if (trimStartTime === null || trimEndTime === null) return;

  event.preventDefault();

  dragStartX = event.clientX;
  dragStartTime = trimStartTime;

  trimStartHandle.setPointerCapture(event.pointerId);
});

trimStartHandle.addEventListener("pointermove", (event) => {
  if (dragStartX === null) return;

  const recordingStart = samples[0].time;
  const recordingEnd = samples[samples.length - 1].time;
  const duration = recordingEnd - recordingStart;

  if (duration <= 0) return;

  const timelineWidth = trimTimeline.getBoundingClientRect().width;
  const deltaTime = (event.clientX - dragStartX) / timelineWidth * duration;

  trimStartTime = Math.max(
    recordingStart,
    Math.min(dragStartTime + deltaTime, trimEndTime - minTrimDuration)
  );

  const startPercent = (trimStartTime - recordingStart) / duration * 100;
  const endPercent = (trimEndTime - recordingStart) / duration * 100;

  trimStartHandle.style.left = `${startPercent}%`;

  trimSelection.style.left = `${startPercent}%`;
  trimSelection.style.width = `${endPercent - startPercent}%`;

  
});

function finishTrimDrag() {
  dragStartX = null;
  dragStartTime = null;
}

trimStartHandle.addEventListener("pointerup", finishTrimDrag);
trimStartHandle.addEventListener("pointercancel", finishTrimDrag);

const trimEndHandle = document.getElementById("trim-end-handle");

let endDragStartX = null;
let endDragStartTime = null;

trimEndHandle.addEventListener("pointerdown", (event) => {
  if (trimStartTime === null || trimEndTime === null) return;

  event.preventDefault();

  endDragStartX = event.clientX;
  endDragStartTime = trimEndTime;

  trimEndHandle.setPointerCapture(event.pointerId);
});

trimEndHandle.addEventListener("pointermove", (event) => {
  if (endDragStartX === null) return;

  const recordingStart = samples[0].time;
  const recordingEnd = samples[samples.length - 1].time;
  const duration = recordingEnd - recordingStart;

  if (duration <= 0) return;

  const timelineWidth = trimTimeline.getBoundingClientRect().width;
  const deltaTime = (event.clientX - endDragStartX) / timelineWidth * duration;

  trimEndTime = Math.min(
    recordingEnd,
    Math.max(endDragStartTime + deltaTime, trimStartTime + minTrimDuration)
  );

  const startPercent = (trimStartTime - recordingStart) / duration * 100;
  const endPercent = (trimEndTime - recordingStart) / duration * 100;

  trimEndHandle.style.left = `${endPercent}%`;

  trimSelection.style.width = `${endPercent - startPercent}%`;

  
});

function finishEndTrimDrag() {
  endDragStartX = null;
  endDragStartTime = null;
}

trimEndHandle.addEventListener("pointerup", finishEndTrimDrag);
trimEndHandle.addEventListener("pointercancel", finishEndTrimDrag);
}

function toggleExpandedView() {
  let gestureArea = document.getElementById("gesture-area");
  let previousBounds = gestureArea.getBoundingClientRect();
  let expanded = gestureArea.classList.toggle("is-expanded");

  expandButton.html(expanded ? "Close" : "Expand");
  document.body.style.overflow = expanded ? "hidden" : "";

  let canvasWidth = gestureArea.clientWidth;
  let canvasHeight = expanded
  ? gestureArea.clientHeight
  : canvasWidth;

  resizeCanvas(canvasWidth, canvasHeight);
  let newBounds = gestureArea.getBoundingClientRect();

let offsetX = previousBounds.left - newBounds.left;
let offsetY = previousBounds.top - newBounds.top;

let scaleX = previousBounds.width / newBounds.width;
let scaleY = previousBounds.height / newBounds.height;

  gestureArea.animate(
    [
      {
        transformOrigin: "top left",
        transform: `translate(${offsetX}px, ${offsetY}px) scale(${scaleX}, ${scaleY})`
      },
      {
        transformOrigin: "top left",
        transform: "translate(0, 0) scale(1, 1)"
      }
    ],
    {
      duration: 200,
      easing: "ease-in-out"
    }
  );


}

function resetView() {
  viewYaw = 0;
  viewPitch = -0.2;
  viewDistance = 800;

  viewTargetX = 0;
  viewTargetY = 0;
  viewTargetZ = 0;
}

async function enableMotion(event) {

  const button = event.currentTarget;
  const message = document.getElementById("motion-message");

  message.hidden = true;

  if (typeof DeviceMotionEvent === "undefined") {
    message.textContent =
      "Motion sensing isn't available on this device or browser.";
    message.hidden = false;
    button.disabled = true;
    return;
  }

  try {

    if (typeof DeviceMotionEvent.requestPermission === "function") {

      const permission = await DeviceMotionEvent.requestPermission();

      if (permission !== "granted") {
        message.textContent =
       "Uh oh! Under can't sense your movement just yet. Close and reopen your browser, then come back and try again. Still no luck? Check your browser's site permissions.";

        message.hidden = false;
        return;
      }
    }

    window.addEventListener("devicemotion", handleMotion);

    button.remove();
    startButton.show();
    document.getElementById("movement-ideas").hidden = false;

  } catch (error) {

    console.error("Motion permission error:", error);

    message.textContent =
      "Oops! Something went wrong while turning on motion sensing. Try again, or close and reopen your browser if it keeps happening.";

    message.hidden = false;
  }
}

function handleMotion(event) {
  
  // Live sensor values
  ax = event.acceleration?.x ?? 0;
  ay = event.acceleration?.y ?? 0;
  az = event.acceleration?.z ?? 0;

  wx = event.rotationRate?.alpha ?? 0;
  wy = event.rotationRate?.beta ?? 0;
  wz = event.rotationRate?.gamma ?? 0;


  // Save them only while recording
  if (isRecording) {

    let sample = {
      time: performance.now() - recordingStartTime,
      ax,
      ay,
      az,
      wx,
      wy,
      wz
    };

    samples.push(sample);
  }
}



function startCapture() {

  if (isRecording) {
    stopCapture();
    return;
  }

  document.getElementById("trim-toggle").hidden = true;
  document.getElementById("trim-controls").hidden = true;
  document.getElementById("gesture-area").style.display = "none";

  beginRecording();
  }


function beginRecording() {

  samples = [];
  smoothedSamples = [];
  playbackStartTime = null;

  recordingStartTime = performance.now();
  isRecording = true;

  tableContainer.html("");

  startButton.html("Recording · End");
  statusText.html("Recording");
}

function stopCapture() {

  isRecording = false;
  if (samples.length > 0) {
    trimStartTime = samples[0].time;
    trimEndTime = samples[samples.length - 1].time;
      


  }
  else {
    trimStartTime = null;
    trimEndTime = null;
  }
  smoothedSamples = gaussianSmooth(samples, 1000);
  gestureRadius = 0;
    for (let sample of smoothedSamples) {
      let distance = Math.hypot(
        sample.ax * 40,
        sample.ay * 40,
        sample.az * 40
      );

      gestureRadius = Math.max(gestureRadius, distance);
    }

  resetView();
  minViewDistance = 0.1;
  maxViewDistance = Math.max(1600, gestureRadius * 4.2);
  playbackStartTime = performance.now();

  statusText.html(
    `Finished! Captured ${samples.length} samples.`
  );

  //console.table(samples);

  //showTable();
  startButton.html("give me another");
  document.getElementById("gesture-area").style.display = "block";

  document.getElementById("trim-toggle").hidden = false;
  document.getElementById("trim-controls").hidden = true;
  document.getElementById("trim-toggle").textContent = "Trim";
  document.getElementById("trim-start-handle").style.left = "0%";
  document.getElementById("trim-selection").style.left = "0%";
  document.getElementById("trim-selection").style.width = "100%";
  document.getElementById("trim-end-handle").style.left = "100%";
}


function showTable() {

  let html = `
    <table border="1" cellpadding="5">
      <tr>
        <th>time (ms)</th>
        <th>ax</th>
        <th>ay</th>
        <th>az</th>
        <th>wx</th>
        <th>wy</th>
        <th>wz</th>
      </tr>
  `;

  for (let sample of samples) {

    html += `
      <tr>
        <td>${sample.time.toFixed(1)}</td>
        <td>${sample.ax.toFixed(3)}</td>
        <td>${sample.ay.toFixed(3)}</td>
        <td>${sample.az.toFixed(3)}</td>
        <td>${sample.wx.toFixed(3)}</td>
        <td>${sample.wy.toFixed(3)}</td>
        <td>${sample.wz.toFixed(3)}</td>
      </tr>
    `;
  }

  html += `</table>`;

  tableContainer.html(html);
}

function gaussianSmooth(data, widthMS) {

  let result = [];

  let radius = widthMS / 2;
  let sigma = widthMS / 6;

  for (let sample of data) {
    let sumAx = 0;
    let sumAy = 0;
    let sumAz = 0;
    let totalWeight = 0;
   for (let neighbor of data) {

      let dt = neighbor.time - sample.time;

      if (Math.abs(dt) > radius) {
      continue;
     }

    let weight = Math.exp(-0.5 * (dt / sigma) ** 2);
      sumAx += neighbor.ax * weight;
      sumAy += neighbor.ay * weight;
      sumAz += neighbor.az * weight;

    totalWeight += weight;
   }
    result.push({
    ...sample,
    ax: sumAx / totalWeight,
    ay: sumAy / totalWeight,
    az: sumAz / totalWeight
    });

  }
  return result;



}

function getGestureColor(time, startTime, endTime, palette = gesturePalette) {

  let duration = endTime - startTime;

  if (duration <= 0) {
    return color(...palette[0]); 
  }

  let progress = (time - startTime) / duration;

  progress = constrain(progress, 0, 1);

  if (progress <= 0.5) {
    return lerpColor(
      color(...palette[0]),
      color(...palette[1]),
      progress * 2
    );
  } else {
    return lerpColor(
      color(...palette[1]),
      color(...palette[2]),
      (progress - 0.5) * 2
    );
  }
}

function draw() {
  background("#0f0f0e");
  perspective(
    PI / 3,
    width / height,
    1,
    maxViewDistance + gestureRadius + 1000
  );

  let camX = viewTargetX + viewDistance * cos(viewPitch) * sin(viewYaw);
  let camY = viewTargetY + viewDistance * sin(viewPitch);
  let camZ = viewTargetZ + viewDistance * cos(viewPitch) * cos(viewYaw);

  camera(
    camX, camY, camZ,
    viewTargetX, viewTargetY, viewTargetZ,
    0, 1, 0
  );
  
  let visibleSamples = smoothedSamples.filter(sample =>
  sample.time >= trimStartTime &&
  sample.time <= trimEndTime
  );

  if (visibleSamples.length < 2) {
    return;
  }

  noFill();
  let startTime = visibleSamples[0].time;
  let endTime = visibleSamples[visibleSamples.length - 1].time;
  let duration = endTime - startTime;

  if (duration <= 0 || playbackStartTime === null) {
    return;
  }

  let elapsed = performance.now() - playbackStartTime;

  let playbackTime = startTime + (elapsed % duration);
    strokeWeight(.5
    );
  let highlightWidth = 50;
  let highlightPalette = gesturePalette.map(([l, c, h]) => [
  Math.min(l + 12, 100),
  c,
  h,
  1
  ]);

  beginShape();

  for (let sample of visibleSamples) {

    stroke(getGestureColor(sample.time, startTime, endTime));
    vertex(
      sample.ax * 40,
      sample.ay * 40,
      sample.az * 40
    );
  }

  endShape();

  // Traveling highlight

  strokeWeight(.7);

  beginShape();

  for (let sample of visibleSamples) {

    let distance = Math.abs(sample.time - playbackTime);

    if (distance <= highlightWidth) {
      let strength = 1 - distance / highlightWidth;
      let fadedPalette = highlightPalette.map(([l, c, h]) => [
        l, c, h, strength
     ]);

    stroke(getGestureColor(
      sample.time,
      startTime,
      endTime,
      fadedPalette
    ));

      vertex(
        sample.ax * 40,
        sample.ay * 40,
        sample.az * 40
      );

    }
}

endShape();
}

function startOrbit(event) {

  if (event.pointerType === "mouse" && event.button !== 0) {
    return;
  }

  if (activePointers.size >= 2) {
    return;
  }

  activePointers.set(event.pointerId, {
    x: event.clientX,
    y: event.clientY
  });

  event.currentTarget.setPointerCapture(event.pointerId);

  if (activePointers.size === 2) {
    lastPinchDistance = getPinchDistance();
  }
}


function moveOrbit(event) {

  if (!activePointers.has(event.pointerId)) {
    return;
  }

  let previous = activePointers.get(event.pointerId);

  let deltaX = event.clientX - previous.x;
  let deltaY = event.clientY - previous.y;

  activePointers.set(event.pointerId, {
    x: event.clientX,
    y: event.clientY
  });

  if (activePointers.size === 1) {

    viewYaw += deltaX * 0.008;

    viewPitch = constrain(
      viewPitch + deltaY * 0.008,
      -PI / 3,
      PI / 3
    );

  } else if (activePointers.size === 2) {
     let panX = deltaX / 2;
    let panY = deltaY / 2;

    let panScale = (
      2 * viewDistance * Math.tan(Math.PI / 6)
    ) / height;

    viewTargetX -= panScale * (
      panX * cos(viewYaw)
      - panY * sin(viewPitch) * sin(viewYaw)
    );

    viewTargetY -= panScale * (
      panY * cos(viewPitch)
    );

    viewTargetZ -= panScale * (
      -panX * sin(viewYaw)
      - panY * sin(viewPitch) * cos(viewYaw)
    );

    let pinchDistance = getPinchDistance();

    if (lastPinchDistance !== null && pinchDistance > 0) {

      viewDistance = constrain(
        viewDistance * (lastPinchDistance / pinchDistance),
        minViewDistance,
        maxViewDistance
      );
    }

    lastPinchDistance = pinchDistance;
  }
}


function stopOrbit(event) {

  if (!activePointers.has(event.pointerId)) {
    return;
  }

  activePointers.delete(event.pointerId);

  lastPinchDistance = null;
}

function getPinchDistance() {

  let pointers = [...activePointers.values()];

  let first = pointers[0];
  let second = pointers[1];

  return Math.hypot(
    second.x - first.x,
    second.y - first.y
  );
}