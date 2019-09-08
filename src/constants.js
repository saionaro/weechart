export const HIDDEN_CLASS = "visually-hidden";
export const ACTIVE_ARROW_CLASS = "chart__minimap-dragger-arrow--active";
export const LINES_COUNT = 6;
export const SCALE_RATE = 1;
export const MINIMAP_HEIGHT = 50;
export const MINIMAL_DRAG_WIDTH = 40;
export const ANIMATION_STEPS = 16;
export const DATES_PLACE = 65;
export const DATE_MARGIN = 32;
export const MOUSE_LEAVE_TIMEOUT = 100;

export const PIXEL_RATIO = (() => {
  const ctx = document.createElement("canvas").getContext("2d");
  const dpr = devicePixelRatio || 1;
  const bsr =
    ctx.webkitBackingStorePixelRatio ||
    ctx.mozBackingStorePixelRatio ||
    ctx.msBackingStorePixelRatio ||
    ctx.oBackingStorePixelRatio ||
    ctx.backingStorePixelRatio ||
    1;

  return dpr / bsr;
})();

export const HEX_REGEX = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i;

export const CANVAS_TYPES = {
  Minimap: "minimap",
  MinimapBackground: "minimap-background",
  Chart: "chart",
  Float: "float"
};

export const CHART_TYPES = {
  Line: "line",
  Bar: "bar",
  Area: "area"
};

export const COLORS = {
  ChartSeparator: {
    day: {
      r: 235,
      g: 240,
      b: 243
    },
    night: {
      r: 39,
      g: 53,
      b: 69
    }
  },
  FloatingLine: {
    day: "#dee6eb",
    night: "#384a5b"
  },
  ChartBackground: {
    day: "#ffffff",
    night: "#222f3f"
  },
  ChartText: {
    day: {
      r: 175,
      g: 181,
      b: 187
    },
    night: {
      r: 80,
      g: 103,
      b: 121
    }
  },
  MinimapBackground: {
    day: "rgba(240, 247, 252, 0.6)",
    night: "rgba(29, 42, 57, 0.8)"
  }
};

export const CHECKED_ICON = `
  <svg class="checked-icon" height="20" width="20" viewBox="0 0 40 40">
    <polyline class="checked-icon__done" points="12,21 18,27 30,14" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" stroke="white" fill="none" />
  </svg>
`;

export const LISTENER_OPTIONS = { passive: true };
