import { LISTENER_OPTIONS } from "./constants";

export const WeeChart = {
  modes: {
    Night: "night",
    Day: "day"
  },
  mode: "day",
  listenersActivated: false,
  mousemoveConsumers: [],
  mouseupConsumers: [],
  touchmoveConsumers: [],
  charts: [],
  onMouseUp: function(event) {
    const mouseupConsumers = WeeChart.mouseupConsumers;

    for (let i = 0; i < mouseupConsumers.length; i++) {
      mouseupConsumers[i](event);
    }
  },
  onTouchMove: function(event) {
    const touchmoveConsumers = WeeChart.touchmoveConsumers;

    for (let i = 0; i < touchmoveConsumers.length; i++) {
      touchmoveConsumers[i](event);
    }
  },
  onMouseMove: function(event) {
    const mousemoveConsumers = WeeChart.mousemoveConsumers;

    for (let i = 0; i < mousemoveConsumers.length; i++) {
      mousemoveConsumers[i](event);
    }
  },
  activateDragEvents: function() {
    document.addEventListener(
      "mousemove",
      WeeChart.onMouseMove,
      LISTENER_OPTIONS
    );
    document.addEventListener("mouseup", WeeChart.onMouseUp, LISTENER_OPTIONS);
    document.addEventListener(
      "touchmove",
      WeeChart.onTouchMove,
      LISTENER_OPTIONS
    );
    document.addEventListener("touchend", WeeChart.onMouseUp, LISTENER_OPTIONS);

    WeeChart.listenersActivated = true;
  },
  /**
   * Set night/day mode
   * @param {"night"|"day"} mode Mode name
   */
  setMode: function(mode) {
    WeeChart.mode = mode;

    for (let i = 0; i < WeeChart.charts.length; i++) {
      requestAnimationFrame(() => WeeChart.charts[i].setMode(mode));
    }
  }
};
