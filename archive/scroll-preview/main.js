const stage = document.querySelector(".stage");
const fallback = stage.querySelector("img");
const canvas = document.createElement("canvas");
const context = canvas.getContext("2d", { alpha: false });
stage.append(canvas);

// 各ZIPの境界で同じポーズを重ねて表示しない。
const timeline = [
  ...Array.from({ length: 121 }, (_, index) => ["idle", index + 1]),
  ...Array.from({ length: 120 }, (_, index) => ["one", index + 2]),
  ...Array.from({ length: 120 }, (_, index) => ["two", index + 2]),
  ...Array.from({ length: 120 }, (_, index) => ["three", index + 2]),
];
const stops = [0, 120, 240, 360, 480];
const cache = new Map();
// 4-loopの縮小・位置補正後も画面端まで埋まる共通倍率。
const FILL_ZOOM = 1.07;

let displayed = 0;
let target = stops[1];
let stopIndex = 0;
let playing = true;
let blockedUntil = 0;
let wheelAmount = 0;
let touchStartY = null;
let lastDraw = 0;
let raf = 0;
let initialized = false;
let loopActive = false;
let loopFrame = 1;
let exitState = null;
let loopJustStarted = false;
let enterState = null;

document.documentElement.style.overflow = "hidden";

function frameUrl(index) {
  const [directory, frame] = timeline[index];
  return `../../assets/frames/${directory}/frame_${String(frame).padStart(3, "0")}.webp`;
}

function prepareUrl(url) {
  if (cache.has(url)) return cache.get(url);
  const entry = { image: new Image(), ready: false };
  entry.image.src = url;
  entry.image.decode().then(() => {
    entry.ready = true;
    schedule();
  }).catch(() => {});
  cache.set(url, entry);
  while (cache.size > 96) cache.delete(cache.keys().next().value);
  return entry;
}

function prepare(index) {
  if (index < 0 || index >= timeline.length) return null;
  return prepareUrl(frameUrl(index));
}

function prepareLoop(stop, frame) {
  const version = stop === 4 ? "?aspect=corrected" : "";
  return prepareUrl(`../../assets/frames/loop-${stop}/frame_${String(frame).padStart(3, "0")}.webp${version}`);
}

function resizeCanvas() {
  const ratio = Math.min(devicePixelRatio || 1, 1.5);
  canvas.width = Math.round(canvas.clientWidth * ratio);
  canvas.height = Math.round(canvas.clientHeight * ratio);
  initialized = false;
  schedule();
}

function draw(image, alignLoopFour = false) {
  context.fillStyle = "#08090b";
  context.fillRect(0, 0, canvas.width, canvas.height);
  paint(image, 1, alignLoopFour);
  fallback.style.visibility = "hidden";
  initialized = true;
}

function paint(image, opacity, alignLoopFour = false) {
  const scale = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight) * FILL_ZOOM;
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  context.save();
  if (alignLoopFour) {
    context.translate(canvas.width / 2 + 1.6 * scale, canvas.height / 2 - 10.9 * scale);
    context.scale(0.9734, 0.9734);
    context.translate(-canvas.width / 2, -canvas.height / 2);
  }
  context.globalAlpha = opacity;
  context.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
  context.restore();
}

function drawFade(from, to, opacity, alignFrom = false, alignTo = false) {
  context.fillStyle = "#08090b";
  context.fillRect(0, 0, canvas.width, canvas.height);
  paint(from, 1, alignFrom);
  paint(to, opacity, alignTo);
  fallback.style.visibility = "hidden";
  initialized = true;
}

function transitionStartUrl(direction) {
  if (direction < 0) return frameUrl(displayed);
  const directory = ["one", "two", "three"][stopIndex - 1];
  return `../../assets/frames/${directory}/frame_001.webp`;
}

function startSegment(direction) {
  if (playing || exitState || performance.now() < blockedUntil) return;
  const nextStop = stopIndex + direction;
  if (nextStop < 0 || nextStop >= stops.length) {
    wheelAmount = 0;
    return;
  }
  wheelAmount = 0;
  if (loopActive) {
    exitState = { direction, startTime: null };
    prepareUrl(transitionStartUrl(direction));
    for (let step = 1; step <= 20; step++) prepare(displayed + direction * step);
    schedule();
    return;
  }
  target = stops[nextStop];
  playing = true;
  schedule();
}

function tick(time) {
  raf = 0;
  const current = prepare(displayed);
  if (!initialized) {
    if (!current?.ready) {
      schedule();
      return;
    }
    draw(current.image);
  }

  if (loopActive) {
    if (enterState) {
      const nextFrame = loopFrame === 121 ? 2 : loopFrame + 1;
      const loopNext = prepareLoop(stopIndex, nextFrame);
      if (enterState.startTime === null) enterState.startTime = time;
      if (time - lastDraw >= 33 && loopNext?.ready) {
        loopFrame = nextFrame;
        lastDraw = time;
      }
      const loopImage = prepareLoop(stopIndex, loopFrame);
      if (current?.ready && loopImage?.ready) {
        const progress = Math.min(1, (time - enterState.startTime) / 220);
        drawFade(current.image, loopImage.image, progress, false, true);
      }
      if (time - enterState.startTime >= 220 && loopImage?.ready) {
        enterState = null;
        lastDraw = time;
      }
      schedule();
      return;
    }
    if (loopJustStarted) {
      const loopStart = prepareLoop(stopIndex, 1);
      if (loopStart?.ready) {
        draw(loopStart.image, stopIndex === 4);
        loopJustStarted = false;
        lastDraw = time;
      }
      schedule();
      return;
    }
    if (exitState) {
      const nextFrame = loopFrame === 121 ? 2 : loopFrame + 1;
      const loopNext = prepareLoop(stopIndex, nextFrame);
      if (time - lastDraw >= 33 && loopNext?.ready) {
        loopFrame = nextFrame;
        lastDraw = time;
      }
      const from = prepareLoop(stopIndex, loopFrame);
      const nextStart = prepareUrl(transitionStartUrl(exitState.direction));
      if (from?.ready && nextStart?.ready && exitState.startTime === null) exitState.startTime = time;
      if (from?.ready && nextStart?.ready) {
        const progress = Math.min(1, (time - exitState.startTime) / 220);
        drawFade(from.image, nextStart.image, progress, stopIndex === 4);
      } else if (from?.ready) {
        draw(from.image, stopIndex === 4);
      }
      if (exitState.startTime !== null && time - exitState.startTime >= 220) {
        const direction = exitState.direction;
        exitState = null;
        loopActive = false;
        target = stops[stopIndex + direction];
        playing = true;
        lastDraw = time;
      }
      schedule();
      return;
    }
    for (let step = 1; step <= 18; step++) {
      prepareLoop(stopIndex, 2 + ((loopFrame + step - 2) % 120));
    }
    if (time - lastDraw >= 33) {
      const nextFrame = loopFrame === 121 ? 2 : loopFrame + 1;
      const next = prepareLoop(stopIndex, nextFrame);
      if (next?.ready) {
        loopFrame = nextFrame;
        lastDraw = time;
        draw(next.image, stopIndex === 4);
      }
    }
    schedule();
    return;
  }

  const direction = Math.sign(target - displayed);
  if (!direction) {
    if (playing) {
      playing = false;
      stopIndex = stops.indexOf(target);
      blockedUntil = time + 250;
      if (stopIndex >= 1) {
        loopActive = true;
        loopFrame = 1;
        enterState = stopIndex === 4 ? { startTime: null } : null;
        loopJustStarted = stopIndex !== 4;
        if (stopIndex === 4) {
          for (let frame = 1; frame <= 12; frame++) prepareLoop(4, frame);
        }
        if (stopIndex < 4) prepareUrl(transitionStartUrl(1));
        schedule();
      }
    }
    return;
  }

  for (let step = 1; step <= 28; step++) prepare(displayed + direction * step);
  if (time - lastDraw >= 33) {
    const next = prepare(displayed + direction);
    if (next?.ready) {
      displayed += direction;
      lastDraw = time;
      draw(next.image);
    }
  }
  schedule();
}

function schedule() {
  if (!raf) raf = requestAnimationFrame(tick);
}

addEventListener("wheel", (event) => {
  event.preventDefault();
  if (playing || performance.now() < blockedUntil) return;
  wheelAmount += event.deltaY;
  if (Math.abs(wheelAmount) >= 30) startSegment(Math.sign(wheelAmount));
}, { passive: false });
addEventListener("touchstart", (event) => {
  touchStartY = event.touches[0]?.clientY ?? null;
}, { passive: true });
addEventListener("touchend", (event) => {
  if (touchStartY === null) return;
  const delta = touchStartY - (event.changedTouches[0]?.clientY ?? touchStartY);
  touchStartY = null;
  if (Math.abs(delta) >= 40) startSegment(Math.sign(delta));
}, { passive: true });
addEventListener("keydown", (event) => {
  if (["ArrowDown", "PageDown", " "].includes(event.key)) {
    event.preventDefault();
    startSegment(1);
  } else if (["ArrowUp", "PageUp"].includes(event.key)) {
    event.preventDefault();
    startSegment(-1);
  }
});
addEventListener("resize", () => {
  resizeCanvas();
});
resizeCanvas();
prepare(0);
schedule();
