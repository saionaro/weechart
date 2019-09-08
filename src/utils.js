import { PIXEL_RATIO, SCALE_RATE } from "./constants";

export function createHiDPICanvas(w, h) {
  const canvas = document.createElement("canvas");
  canvas.width = w * PIXEL_RATIO;
  canvas.height = h * PIXEL_RATIO;
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
  const context = canvas.getContext("2d");
  context.lineJoin = "round";
  context.setTransform(PIXEL_RATIO, 0, 0, PIXEL_RATIO, 0, 0);
  context.font = "lighter 13px Helvetica, Arial";
  return canvas;
}

export function throttle(func, ms) {
  let isThrottled = false;
  let savedArgs = null;

  return function wrapper(...args) {
    if (isThrottled) {
      savedArgs = args;
      return;
    }

    func(...args);

    isThrottled = true;

    setTimeout(function() {
      isThrottled = false;

      if (savedArgs) {
        wrapper.apply(void 0, savedArgs);
        savedArgs = null;
      }
    }, ms);
  };
}

export function fuzzyAdd(sum, number) {
  const result = sum + number;
  if (sum > 0) return result < 0 ? 0 : result;
  return result > 0 ? 0 : result;
}

export function short(number) {
  if (number > 1000000) {
    return (number / 1000000).toFixed(1) + "M";
  }
  if (number > 1000) {
    return (number / 1000).toFixed(1) + "K";
  }
  return number;
}

export function calculateVerticalRatio(maxValue, height) {
  if (maxValue > height) {
    return height / maxValue;
  } else {
    const scaledHeight = SCALE_RATE * height;

    if (maxValue < scaledHeight) {
      return scaledHeight / maxValue;
    } else return 1;
  }
}

export function getCursorXPosition(canvas, event) {
  return event.clientX - canvas.getBoundingClientRect().left;
}

export function setTransform(style, value) {
  style.transform = `translateX(${value}px)`;
}

export function createExtremumStore() {
  return {
    prev: {
      min: 0,
      max: 0
    },
    current: {
      min: 0,
      max: 0
    }
  };
}
