import { toDateString, toWeekday } from "./date";
import {
  CANVAS_TYPES,
  CHART_TYPES,
  COLORS,
  CHECKED_ICON,
  HIDDEN_CLASS,
  ACTIVE_ARROW_CLASS,
  LINES_COUNT,
  MINIMAP_HEIGHT,
  MINIMAL_DRAG_WIDTH,
  ANIMATION_STEPS,
  DATES_PLACE,
  DATE_MARGIN,
  MOUSE_LEAVE_TIMEOUT,
  LISTENER_OPTIONS
} from "./constants";
import { hexToRgb, rgbToString } from "./colors";
import {
  createHiDPICanvas,
  throttle,
  fuzzyAdd,
  short,
  calculateVerticalRatio,
  getCursorXPosition,
  setTransform,
  createExtremumStore
} from "./utils";

const appElement = document.querySelector(".app");

const _$TelegramCharts = {
  modes: {
    Night: "night",
    Day: "day"
  },
  modeSwitcherData: {
    element: null,
    updateHooks: [],
    captions: {
      night: "Switch to Day Mode",
      day: "Switch to Night Mode"
    },
    mode: "day"
  },
  listenersActivated: false,
  mousemoveConsumers: [],
  mouseupConsumers: [],
  touchmoveConsumers: [],
  onMouseUp: function(event) {
    const mouseupConsumers = _$TelegramCharts.mouseupConsumers;

    for (let i = 0; i < mouseupConsumers.length; i++) {
      mouseupConsumers[i](event);
    }
  },
  onTouchMove: function(event) {
    const touchmoveConsumers = _$TelegramCharts.touchmoveConsumers;

    for (let i = 0; i < touchmoveConsumers.length; i++) {
      touchmoveConsumers[i](event);
    }
  },
  onMouseMove: function(event) {
    const mousemoveConsumers = _$TelegramCharts.mousemoveConsumers;

    for (let i = 0; i < mousemoveConsumers.length; i++) {
      mousemoveConsumers[i](event);
    }
  },
  activateDragEvents: function() {
    document.addEventListener(
      "mousemove",
      _$TelegramCharts.onMouseMove,
      LISTENER_OPTIONS
    );
    document.addEventListener(
      "mouseup",
      _$TelegramCharts.onMouseUp,
      LISTENER_OPTIONS
    );
    document.addEventListener(
      "touchmove",
      _$TelegramCharts.onTouchMove,
      LISTENER_OPTIONS
    );
    document.addEventListener(
      "touchend",
      _$TelegramCharts.onMouseUp,
      LISTENER_OPTIONS
    );
    _$TelegramCharts.listenersActivated = true;
  }
};

const chartedCanvasTypesList = [CANVAS_TYPES.Minimap, CANVAS_TYPES.Chart];

function createCanvasObject(type, width, height) {
  return {
    canvas: createHiDPICanvas(width, height),
    context: null,
    width: width,
    height: height,
    type: type
  };
}

function createDragger(width) {
  const dragger = document.createElement("div");
  const arrowLeft = document.createElement("div");
  const arrowRight = document.createElement("div");

  dragger.className = "chart__minimap-dragger hide-selection";
  dragger.style.height = `${MINIMAP_HEIGHT}px`;
  dragger.style.width = `${width}px`;
  arrowLeft.className =
    "chart__minimap-dragger-arrow chart__minimap-dragger-arrow--left";
  arrowRight.className =
    "chart__minimap-dragger-arrow chart__minimap-dragger-arrow--right";
  dragger.appendChild(arrowLeft);
  dragger.appendChild(arrowRight);

  return dragger;
}

function getLabelClass(title) {
  return "floating-window__" + title.replace(/ +/g, "_");
}

function createFloatingWindow(data, colors) {
  let sections = "";

  for (const type in data.names) {
    sections += `
      <li class="floating-window__section" style="color: ${rgbToString(
        colors[type]
      )}">
        <span class="floating-window__count ${getLabelClass(type)}"></span>
        <span class="floating-window__label">${data.names[type]}</span>
      </li>`;
  }

  const floatingWindow = document.createElement("div");
  floatingWindow.className = `floating-window ${HIDDEN_CLASS}`;
  floatingWindow.innerHTML =
    '<p class="floating-window__date"></p><ul class="floating-window__sections">' +
    sections +
    "</ul>";

  floatingWindow.innerHTML = `
    <p class="floating-window__date"></p>
    <ul class="floating-window__sections">${sections}</ul>`;

  return floatingWindow;
}

function getColor(color) {
  return COLORS[color][_$TelegramCharts.modeSwitcherData.mode];
}

export class Chart {
  constructor(container, data, params) {
    const w = params.w;
    const h = params.h;
    this._data = data;
    this._lines = [];
    this._dates = null;
    this._chartType = null;
    const dotsCount = data.columns[0].length - 1;

    if (dotsCount > 400) {
      this._overflow = true;
      this._dataCount = 400;
    } else {
      this._overflow = false;
      this._dataCount = dotsCount;
    }

    this._visibleCount = 0;
    this._minimapCleaned = false;
    this._forceRenderDates = true;
    this._datesCleaned = false;
    this._activeAnimations = 0;
    this._chart = createCanvasObject(CANVAS_TYPES.Chart, w, h);
    this._chart.height -= DATE_MARGIN;
    this._yAxisAnimationShift = (this._chart.height / LINES_COUNT) * 3;
    this._chart.canvas.className = "chart__chart-canvas hide-selection";
    this._chart.context = this._chart.canvas.getContext("2d");
    this._float = createCanvasObject(CANVAS_TYPES.Float, w, h);
    this._float.height -= DATE_MARGIN;
    this._float.canvas.className = "chart__float-canvas hide-selection";
    this._float.context = this._float.canvas.getContext("2d");
    this._minimap = createCanvasObject(CANVAS_TYPES.Minimap, w, MINIMAP_HEIGHT);
    this._minimapBackground = createCanvasObject(
      CANVAS_TYPES.MinimapBackground,
      w,
      MINIMAP_HEIGHT
    );
    this._minimapBackground.canvas.className =
      "chart__minimap-background-canvas hide-selection";
    this._minimapBackground.context = this._minimapBackground.canvas.getContext(
      "2d"
    );
    this._minimap.canvas.className = "chart__minimap-canvas hide-selection";
    this._minimap.context = this._minimap.canvas.getContext("2d");
    this._rgbColors = {};
    this._animations = [];
    const pixelsForDot = w / this._dataCount;
    let startScale = 1;

    if (pixelsForDot < 35) {
      startScale = 35 / pixelsForDot;

      const dragWidth = w / startScale;

      if (dragWidth < MINIMAL_DRAG_WIDTH) {
        startScale = w / MINIMAL_DRAG_WIDTH;
      }
    }

    this._transitions = {
      chartsOpacity: {},
      datesOpacity: 1,
      yAxis: {
        opacity: 1,
        toDown: false,
        shift: 0
      },
      xShift: 0
    };

    this._transitions[CANVAS_TYPES.Minimap] = {
      yRatioModifer: 0,
      xRatioModifer: 1
    };

    this._transitions[CANVAS_TYPES.Chart] = {
      yRatioModifer: 0,
      xRatioModifer: startScale
    };

    for (let j = 0; j < data.columns.length; j++) {
      const column = data.columns[j];
      const type = column[0];

      if (this._data.types[type] !== "x") {
        this._rgbColors[type] = hexToRgb(this._data.colors[type]);
        this._transitions.chartsOpacity[type] = 1;

        const data = column.slice(1);

        if (this._overflow) {
          data = data.slice(-this._dataCount);
        }

        this._lines.push({ type, data });

        this._chartType = this._chartType
          ? this._chartType
          : this._data.types[type];

        this._visibleCount++;
      } else {
        let dates = column.slice(1);

        if (this._overflow) {
          dates = dates.slice(-this._dataCount);
        }

        this._dates = dates;
      }
    }

    this._container = container;
    this._checkboxContainer = null;
    const dragWidth = w / startScale;
    const viewShift = w - dragWidth;
    this._state = {
      exclude: {},
      floatingWindow: {
        elem: null,
        labels: {},
        dateElem: null
      },
      drag: {
        active: false,
        resize: false,
        leftArrow: false,
        dragger: createDragger(dragWidth),
        elem: null,
        leftElem: null,
        rightElem: null,
        initialWidth: dragWidth,
        width: dragWidth,
        marginLeft: viewShift,
        savedTouchX: 0,
        touchEventAdapterData: {
          movementX: 0
        }
      }
    };
    const fragment = document.createDocumentFragment();
    const wrapper = document.createElement("div");
    const floatingWindow = this._state.floatingWindow;
    const drag = this._state.drag;
    const dragger = drag.dragger;
    drag.leftElem = dragger.querySelector(
      ".chart__minimap-dragger-arrow--left"
    );
    drag.rightElem = dragger.querySelector(
      ".chart__minimap-dragger-arrow--right"
    );
    floatingWindow.elem = createFloatingWindow(this._data, this._rgbColors);
    floatingWindow.dateElem = floatingWindow.elem.querySelector(
      ".floating-window__date"
    );

    for (let j = 0; j < this._lines.length; j++) {
      floatingWindow.labels[
        this._lines[j].type
      ] = floatingWindow.elem.querySelector(
        `.${getLabelClass(this._lines[j].type)}`
      );
    }

    setTransform(dragger.style, viewShift);
    this._transitions.xShift = viewShift / this._minimap.width;
    wrapper.className = "chart__minimap-wrapper";
    wrapper.style.width = `${w}px`;
    wrapper.appendChild(this._minimap.canvas);
    wrapper.appendChild(this._minimapBackground.canvas);
    wrapper.appendChild(dragger);
    fragment.appendChild(this._chart.canvas);
    fragment.appendChild(this._float.canvas);
    fragment.appendChild(this._state.floatingWindow.elem);
    fragment.appendChild(wrapper);

    this._container.appendChild(fragment);

    this._container.style.width = `${w}px`;
    this._onChangeCheckbox = this._onChangeCheckbox.bind(this);
    this._animationLoop = this._animationLoop.bind(this);
    this._startDrag = this._startDrag.bind(this);
    this._moveDrag = this._moveDrag.bind(this);
    this._endDrag = this._endDrag.bind(this);
    this._startDragTouchAdapter = this._startDragTouchAdapter.bind(this);
    this._moveDragTouchAdapter = throttle(
      this._moveDragTouchAdapter.bind(this),
      16
    );
    this._floatMoveTouchAdapter = this._floatMoveTouchAdapter.bind(this);
    this._floatMouseMove = throttle(this._floatMouseMove.bind(this), 60);
    this._checkYScaleChange = throttle(this._checkYScaleChange.bind(this), 160);
    this._floatMouseLeave = this._floatMouseLeave.bind(this);
    dragger.addEventListener("mousedown", this._startDrag, LISTENER_OPTIONS);
    dragger.addEventListener(
      "touchstart",
      this._startDragTouchAdapter,
      LISTENER_OPTIONS
    );

    if (!_$TelegramCharts.listenersActivated) {
      _$TelegramCharts.activateDragEvents();
    }

    _$TelegramCharts.touchmoveConsumers.push(this._moveDragTouchAdapter);
    _$TelegramCharts.mouseupConsumers.push(this._endDrag);
    _$TelegramCharts.mousemoveConsumers.push(this._moveDrag);
    _$TelegramCharts.modeSwitcherData.updateHooks.push(this._animationLoop);

    this._float.canvas.addEventListener(
      "mousemove",
      this._floatMouseMove,
      LISTENER_OPTIONS
    );

    this._float.canvas.addEventListener(
      "mouseleave",
      this._floatMouseLeave,
      LISTENER_OPTIONS
    );

    this._float.canvas.addEventListener(
      "touchstart",
      this._floatMoveTouchAdapter,
      LISTENER_OPTIONS
    );

    this._localExtremums = createExtremumStore();
    this._globalExtremums = createExtremumStore();
    this._chartXParams = {
      scale: 0,
      shift: 0,
      window: []
    };
    this._minimapXParams = {
      scale: 0,
      shift: 0,
      window: []
    };

    this._storeXParams(this._minimapXParams, this._minimap);
    this._storeXParams(this._chartXParams, this._chart);

    const hiddenDates = this._getHiddenDates(this._dataCount, w);

    this._hiddenDates = {
      prev: hiddenDates,
      current: hiddenDates
    };

    this._findAllExtremums();
    this._render();
    this._drawMinimap();
    this._renderButtons();
  }

  _floatMoveTouchAdapter(event) {
    this._floatMouseMove(event.changedTouches[0]);
  }

  _floatMouseMove(event) {
    const active = this._state.drag.active;
    if (active || !this._visibleCount) return;

    const scale = this._chartXParams.scale;
    const shift = this._chartXParams.shift;
    const cursorX = getCursorXPosition(this._float.canvas, event);
    const selected = Math.round((cursorX - shift) / scale);

    this._drawFloatingLine(selected, selected * scale + shift);
  }

  _drawFloatingLine(index, x) {
    const canvas = this._float.canvas;
    const context = this._float.context;
    const height = this._float.height;
    const width = this._float.width;
    const chartsOpacity = this._transitions.chartsOpacity;

    this._clear(canvas);

    context.beginPath();
    context.lineWidth = 1;
    context.strokeStyle = getColor("FloatingLine");
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();

    const yScale = this._getYParams(this._chart);

    const data = {
      date: 0,
      x: x,
      toLeft: width / 2 < x,
      values: {}
    };

    for (let i = 0; i < this._lines.length; i++) {
      const column = this._lines[i];

      if (chartsOpacity[column.type]) {
        const y = height - column.data[index] * yScale;
        data.date = this._dates[index];
        data.values[column.type] = column.data[index];
        context.strokeStyle = rgbToString(this._rgbColors[column.type], 1);
        context.beginPath();
        context.arc(x, y, 5, 0, 2 * Math.PI, false);
        context.lineWidth = 2.5;
        context.fillStyle = getColor("ChartBackground");
        context.fill();
        context.stroke();
      }
    }

    this._updateFloatingWindow(data);
  }

  _updateFloatingWindow(params) {
    const x = params.x;
    const date = params.date;
    const toLeft = params.toLeft;
    const values = params.values;
    const elem = this._state.floatingWindow.elem;
    const dateElem = this._state.floatingWindow.dateElem;
    const labels = this._state.floatingWindow.labels;
    elem.classList.remove(HIDDEN_CLASS);
    dateElem.innerHTML = toWeekday(date) + ", " + toDateString(date);

    for (const type in values) {
      labels[type].innerHTML = short(values[type]);
    }

    let shift;

    if (toLeft) {
      shift = x - elem.offsetWidth - 15;
    } else {
      shift = x + 15;
    }

    setTransform(elem.style, shift);
  }

  _hideFloatingWindowLabel(type, hide) {
    let labels = this._state.floatingWindow.labels;
    labels[type].parentNode.classList.toggle(
      "floating-window__section--hidden",
      hide
    );
  }

  _floatMouseLeave() {
    setTimeout(() => {
      this._clear(this._float.canvas);
      this._state.floatingWindow.elem.classList.add(HIDDEN_CLASS);
    }, MOUSE_LEAVE_TIMEOUT);
  }

  _findAllExtremums() {
    const window = this._chartXParams.window;

    this._findExtremums(this._localExtremums, window);
    this._findExtremums(this._globalExtremums);
  }

  _findExtremums(store, range) {
    let max = -Infinity;
    let min = Infinity;
    let from = 1;
    let to = this._dataCount;

    if (range) {
      from = range[0] + 1;
      to = range[1] + 1;
    }

    for (let j = 0; j < this._lines.length; j++) {
      const column = this._lines[j];

      if (!this._state.exclude[column.type]) {
        for (let i = from; i < to; i++) {
          if (column.data[i] > max) {
            max = column.data[i];
          }

          if (column.data[i] < min) {
            min = column.data[i];
          }
        }
      }
    }

    if (max !== -Infinity && min / max > 0.5) {
      max += min;
    } else {
      max *= 1.05;
    }

    store.prev.min = store.current.min;
    store.prev.max = store.current.max;
    store.current.min = min;
    store.current.max = max;
  }

  _startDragTouchAdapter(event) {
    this._floatMouseLeave();

    this._startDrag({
      which: 1,
      target: event.target
    });
  }

  _startDrag(event) {
    if (event.which !== 1 || !event.target) return;

    const drag = this._state.drag;
    const classList = event.target.classList;
    let className = "chart__minimap-dragger--dragging";

    if (classList.contains("chart__minimap-dragger-arrow")) {
      className = "chart__minimap-dragger--resizing";
      drag.resize = true;

      if (classList.contains("chart__minimap-dragger-arrow--left")) {
        drag.leftArrow = true;
        drag.leftElem.classList.add(ACTIVE_ARROW_CLASS);
      } else {
        drag.rightElem.classList.add(ACTIVE_ARROW_CLASS);
      }
    }

    this._state.drag.dragger.classList.add(className);
    drag.active = true;

    this._animationLoop();
  }

  _moveDragTouchAdapter(event) {
    const touch = event.changedTouches[0];
    const drag = this._state.drag;
    const savedX = drag.savedTouchX;
    const currentX = touch.clientX;
    let speed = 0;

    if (savedX) {
      speed = currentX - savedX;
    }

    drag.savedTouchX = currentX;
    drag.touchEventAdapterData.movementX = speed;

    this._moveDrag(drag.touchEventAdapterData);
  }

  _moveDrag(event) {
    const movementX = event.movementX;
    const drag = this._state.drag;

    if (!drag.active || !movementX) return;

    this._forceRenderDates = true;

    if (drag.resize) {
      return this._handleResize(movementX);
    }

    const maxPadding = this._minimap.width - drag.width;
    const sum = drag.marginLeft + movementX;
    const val = sum < 0 ? 0 : sum > maxPadding ? maxPadding : sum;

    setTransform(drag.dragger.style, val);
    drag.marginLeft = val;
    this._transitions.xShift = val / this._minimap.width;

    this._storeXParams(this._chartXParams, this._chart);
    this._checkYScaleChange();
  }

  _handleResize(delta) {
    const drag = this._state.drag;

    if (drag.leftArrow) {
      if (
        drag.width - delta < MINIMAL_DRAG_WIDTH ||
        drag.marginLeft + delta < 0
      ) {
        return;
      }

      const newVal = drag.marginLeft + delta;
      const newShift = newVal / this._minimap.width;

      drag.marginLeft = newVal;
      setTransform(drag.dragger.style, newVal);
      this._transitions.xShift = newShift;

      return this._changeDragWidth(-delta);
    }

    const maxPadding = this._minimap.width - drag.width;

    if (
      drag.width + delta < MINIMAL_DRAG_WIDTH ||
      drag.marginLeft + delta > maxPadding
    ) {
      return;
    }

    this._changeDragWidth(delta);
  }

  _changeDragWidth(delta) {
    const record = this._transitions[CANVAS_TYPES.Chart];
    const drag = this._state.drag;
    const changedWidth = drag.width + delta;
    const deltaRatio = drag.width / changedWidth;

    drag.width = changedWidth;
    drag.dragger.style.width = changedWidth + "px";

    this._pushAnimation(
      this._animateHorisontal(
        record.xRatioModifer,
        deltaRatio * record.xRatioModifer
      )
    );

    this._storeXParams(this._chartXParams, this._chart);
    this._checkYScaleChange();
    this._checkHiddenDatesChange();
  }

  _checkHiddenDatesChange() {
    const dates = this._hiddenDates;
    const hiddenDates = this._getHiddenDates(
      this._dataCount,
      this._chart.width
    );

    if (hiddenDates._$count !== dates.current._$count) {
      dates.prev = dates.current;
      dates.current = hiddenDates;

      this._pushAnimation(
        this._animateDates(dates.prev._$count < dates.current._$count)
      );
    }
  }

  _checkYScaleChange() {
    const extrPrev = this._localExtremums.prev;
    const extrCurr = this._localExtremums.current;

    this._findAllExtremums();

    if (extrPrev.max !== extrCurr.max) {
      this._pushAnimation(this._animateVertical(this._findYDeltas()));
      this._pushAnimation(this._animateYAxis(extrPrev.max < extrCurr.max));
    }
  }

  _endDrag() {
    const drag = this._state.drag;

    drag.active = false;
    drag.leftArrow = false;
    drag.resize = false;
    drag.savedTouchX = 0;
    drag.dragger.classList.remove("chart__minimap-dragger--resizing");
    drag.dragger.classList.remove("chart__minimap-dragger--dragging");
    drag.leftElem.classList.remove(ACTIVE_ARROW_CLASS);
    drag.rightElem.classList.remove(ACTIVE_ARROW_CLASS);
  }

  _shouldRenderMinimap() {
    let opacityInProcess = false;

    for (let i = 0; i < this._lines.length; i++) {
      const column = this._lines[i];
      const val = this._transitions.chartsOpacity[column.type];

      if (val > 0 && val < 1) {
        opacityInProcess = true;
        break;
      }
    }

    return (
      opacityInProcess ||
      !!this._transitions[CANVAS_TYPES.Minimap].yRatioModifer ||
      this._minimapCleaned
    );
  }

  _shouldRenderDates() {
    if (this._transitions.datesOpacity !== 1) {
      return true;
    }

    return this._forceRenderDates || this._datesCleaned;
  }

  _cleanUp() {
    this._clearChart();

    if (this._shouldRenderMinimap()) {
      this._clear(this._minimap.canvas);
      this._minimapCleaned = true;
    }

    if (this._shouldRenderDates()) {
      this._clearDates();
      this._datesCleaned = true;
    }
    this._clear(this._minimapBackground.canvas);
  }

  _clearChart() {
    this._chart.context.clearRect(0, 0, this._chart.width, this._chart.height);
  }

  _clearDates() {
    this._chart.context.clearRect(
      0,
      this._chart.height,
      this._chart.width,
      this._chart.height + DATE_MARGIN
    );
  }

  _clear(canvas) {
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
  }

  _render() {
    this._drawChart();

    if (this._shouldRenderMinimap()) {
      this._drawMinimap();
      this._minimapCleaned = false;
    }

    if (this._shouldRenderDates()) {
      this._renderDates();
      this._datesCleaned = false;
      this._forceRenderDates = false;
    }

    this._drawMinimapBackground();
  }

  _drawChart() {
    this._chart.context.lineWidth = 1;
    this._renderLines(this._chart);
    this._chart.context.lineWidth = 2.5;
    this._renderChart(this._chart, this._chartXParams);
    this._renderYValues();
  }

  _drawMinimap() {
    this._renderChart(this._minimap, this._minimapXParams);
  }

  _drawMinimapBackground() {
    const context = this._minimapBackground.context;
    const drag = this._state.drag;

    context.fillStyle = getColor("MinimapBackground");
    context.fillRect(0, 0, drag.marginLeft + 8, this._minimapBackground.height);
    context.fillRect(
      drag.marginLeft + drag.width - 8,
      0,
      this._minimapBackground.width,
      this._minimapBackground.height
    );
  }

  _renderLines(chart) {
    const context = chart.context;
    const width = chart.width;
    const height = chart.height;
    const current = this._localExtremums.current;
    const yAxis = this._transitions.yAxis;
    const stepSize = height / LINES_COUNT;
    const color = getColor("ChartSeparator");

    context.beginPath();

    if (current.max !== -Infinity) {
      for (let i = 1; i < LINES_COUNT; i++) {
        const shift = height - i * stepSize;
        const y = shift + yAxis.shift;

        if (y <= height) {
          context.strokeStyle = rgbToString(color, yAxis.opacity);
          context.moveTo(0, y);
          context.lineTo(width, y);
        }

        if (yAxis.opacity < 1) {
          context.strokeStyle = rgbToString(color, 1 - yAxis.opacity);
          const yCoord =
            y + this._yAxisAnimationShift * (yAxis.toDown ? 1 : -1);

          if (yCoord < height) {
            context.moveTo(0, yCoord);
            context.lineTo(width, yCoord);
          }
        }
      }

      context.strokeStyle = rgbToString(color, 1);
      context.moveTo(0, height);
      context.lineTo(width, height);
    }

    context.stroke();
  }

  _renderDates() {
    const context = this._chart.context;
    const height = this._chart.height;
    const scale = this._chartXParams.scale;
    const shift = this._chartXParams.shift;
    const window = this._chartXParams.window;
    const hiddenDates = this._hiddenDates;
    const datesOpacity = this._transitions.datesOpacity;

    for (let i = window[0]; i < window[1]; i++) {
      const x = i * scale + shift;
      const isLast = i === this._dataCount - 1;
      const hide = hiddenDates.current[i] && !hiddenDates.prev[i];
      const show = !hiddenDates.current[i] && hiddenDates.prev[i];
      const isTransition = show || hide;
      let opacity = 1;
      context.textAlign = isLast ? "right" : "center";
      context.lineWidth = 1;

      if (isTransition) {
        opacity = datesOpacity;
      }

      if (opacity && (isTransition || !hiddenDates.current[i])) {
        context.fillStyle = rgbToString(getColor("ChartText"), opacity);
        context.fillText(toDateString(this._dates[i]), x, height + 18);
      }
    }
  }

  _renderYValues() {
    const context = this._chart.context;
    const height = this._chart.height;
    const current = this._localExtremums.current;
    const prev = this._localExtremums.prev;
    const yAxis = this._transitions.yAxis;
    const stepSize = height / LINES_COUNT;
    const color = getColor("ChartText");
    const maxHeight = height - 6;

    context.lineWidth = 1;

    if (current.max !== -Infinity) {
      context.textAlign = "left";

      for (let i = 1; i < LINES_COUNT; i++) {
        const yShift = maxHeight - i * stepSize;
        const y = yShift + yAxis.shift;
        const part = i / LINES_COUNT;

        if (y < maxHeight) {
          context.fillStyle = rgbToString(color, yAxis.opacity);
          context.fillText(short(Math.round(current.max * part)), 0, y);
        }

        if (yAxis.opacity < 1) {
          const yCoord =
            y + this._yAxisAnimationShift * (yAxis.toDown ? 1 : -1);

          if (yCoord < maxHeight) {
            context.fillStyle = rgbToString(color, 1 - yAxis.opacity);
            context.fillText(short(Math.round(prev.max * part)), 0, yCoord);
          }
        }
      }

      context.fillStyle = rgbToString(color, 1);
      context.fillText(0, 0, maxHeight);
    }
  }

  _storeXParams(store, data) {
    const type = data.type;
    const xShift = this._transitions.xShift;
    const record = this._transitions[type];
    const count = this._dataCount;
    const countM1 = count - 1;
    const scale = (data.width / countM1) * record.xRatioModifer;

    store.scale = scale;
    store.shift = -(countM1 * scale * xShift);
    store.window[0] = 0;
    store.window[1] = count;

    if (type === CANVAS_TYPES.Chart) {
      const start = Math.round(-store.shift / store.scale) - 1;
      const end = Math.round((data.width - store.shift) / store.scale) + 2;
      store.window[0] = start < 0 ? 0 : start;
      store.window[1] = end > count ? count : end;
    }
  }

  _getYParams(data) {
    const usedExtremums =
      data.type === CANVAS_TYPES.Chart
        ? this._localExtremums
        : this._globalExtremums;
    return (
      calculateVerticalRatio(usedExtremums.current.max, data.height) +
      this._transitions[data.type].yRatioModifer
    );
  }

  _getHiddenDates(total, width) {
    const window = this._chartXParams.window;
    const toHide = {};
    let count = window[1] - window[0];
    let iter = 1;
    let hiddenCount = 0;

    while (count * DATES_PLACE > width) {
      for (let i = total - 1 - iter; i >= 0; i -= 2 * iter) {
        if (!toHide[i]) {
          hiddenCount++;
        }
        toHide[i] = true;
      }

      let localCount = 0;

      for (let i = window[0]; i < window[1]; i++) {
        localCount += toHide[i] ? 0 : 1;
      }

      count = localCount;
      iter++;
    }

    toHide._$count = hiddenCount;

    return toHide;
  }

  _renderChart(params, data) {
    const context = params.context;
    const chartsOpacity = this._transitions.chartsOpacity;
    const isChart = params.type === CANVAS_TYPES.Chart;
    const yScale = this._getYParams(params);

    for (let j = 0; j < this._lines.length; j++) {
      const column = this._lines[j];
      const type = column.type;
      const opacity = chartsOpacity[type];

      if (opacity !== 0) {
        context.beginPath();
        context.strokeStyle = rgbToString(this._rgbColors[type], opacity);
        context.fillStyle = rgbToString(this._rgbColors[type], opacity);

        for (let i = data.window[0]; i < data.window[1]; i++) {
          const x = i * data.scale + (isChart ? data.shift : 0);
          const y = params.height - column.data[i] * yScale;

          if (this._chartType === CHART_TYPES.Bar) {
            context.fillRect(x - data.scale, y, data.scale, params.height - y);
          } else {
            context.lineTo(x, y);
          }
        }

        context.stroke();
      }
    }
  }

  _renderButtons() {
    let items = "";
    const data = this._data;
    const container = this._container;

    for (let i = 0; i < this._lines.length; i++) {
      const column = this._lines[i];
      const type = column.type;
      const color = rgbToString(this._rgbColors[type]);

      items += `
        <li class="charts-selector__item hide-selection">
          <label class="checkbox" style="color: ${color}; border-color: ${color};">
            <input type="checkbox" class="checkbox__input ${HIDDEN_CLASS}" name="${type}" checked>
            <div class="checkbox__wrapper" style="background-color: ${color};">
              ${CHECKED_ICON}
              <span class="checkbox__title">
                ${data.names[type]}
              </span>
            </div>
          </label>
        </li>`;
    }

    const tempContainer = document.createElement("div");
    tempContainer.innerHTML = `<ul class="charts-selector">${items}</ul>`;
    this._checkboxContainer = tempContainer.children[0];

    this._checkboxContainer.addEventListener(
      "change",
      this._onChangeCheckbox,
      LISTENER_OPTIONS
    );

    container.appendChild(this._checkboxContainer);
  }

  _onChangeCheckbox(event) {
    const target = event.target;
    const extremums = this._localExtremums;

    this._floatMouseLeave();
    this._pushAnimation(this._animateHideChart(target.name, target.checked));
    this._state.exclude[target.name] = !target.checked;
    this._visibleCount += this._state.exclude[target.name] ? -1 : 1;
    this._hideFloatingWindowLabel(target.name, !target.checked);
    this._findAllExtremums();
    this._pushAnimation(this._animateVertical(this._findYDeltas()));

    if (extremums.prev.max !== extremums.current.max) {
      this._pushAnimation(
        this._animateYAxis(extremums.prev.max < extremums.current.max)
      );
    }

    this._animationLoop();
  }

  _pushAnimation(animation) {
    if (!this._animations[animation.tag]) {
      this._activeAnimations++;
    }

    this._animations[animation.tag] = animation.hook;
  }

  _findYDeltas() {
    const glob = this._globalExtremums;
    const local = this._localExtremums;
    const deltas = {};

    for (let i = 0; i < chartedCanvasTypesList.length; i++) {
      const canvasType = chartedCanvasTypesList[i];
      const height = this["_" + canvasType].height;
      const isChart = canvasType === CANVAS_TYPES.Chart;
      const extrOld = isChart ? local.prev : glob.prev;
      const extrNew = isChart ? local.current : glob.current;

      deltas[canvasType] =
        calculateVerticalRatio(extrNew.max, height) -
        calculateVerticalRatio(extrOld.max, height);
    }

    return deltas;
  }

  _animateVertical(deltas) {
    const tag = "_animateVertical";
    const steps = {};

    for (let i = 0; i < chartedCanvasTypesList.length; i++) {
      const canvasType = chartedCanvasTypesList[i];
      steps[canvasType] = deltas[canvasType] / ANIMATION_STEPS;
      this._transitions[canvasType].yRatioModifer = -deltas[canvasType];
    }

    return {
      hook: () => {
        let finishedAnimations = 0;

        for (let i = 0; i < chartedCanvasTypesList.length; i++) {
          const canvasType = chartedCanvasTypesList[i];
          const record = this._transitions[canvasType];
          const yModifer = record.yRatioModifer;

          if (
            (yModifer >= 0 && deltas[canvasType] > 0) ||
            (yModifer <= 0 && deltas[canvasType] < 0) ||
            steps[canvasType] === 0
          ) {
            finishedAnimations++;
          } else {
            record.yRatioModifer = fuzzyAdd(yModifer, steps[canvasType]);
          }
        }

        if (finishedAnimations === chartedCanvasTypesList.length) {
          delete this._animations[tag];
          this._activeAnimations--;
        }
      },
      tag
    };
  }

  _animateHorisontal(oldVal, newVal) {
    const tag = "_animateHorisontal";
    const step = (newVal - oldVal) / ANIMATION_STEPS;
    const record = this._transitions[CANVAS_TYPES.Chart];

    record.xRatioModifer = newVal;

    return {
      hook: () => {
        record.xRatioModifer += step;

        if (
          (step < 0 && record.xRatioModifer <= newVal) ||
          (step > 0 && record.xRatioModifer >= newVal) ||
          step === 0
        ) {
          record.xRatioModifer = newVal;
          delete this._animations[tag];
          this._activeAnimations--;
        }
      },
      tag
    };
  }

  _animateHideChart(type, value) {
    const tag = "_animateHideChart";

    return {
      hook: () => {
        const record = this._transitions.chartsOpacity;
        record[type] += value ? 0.08 : -0.08;

        if ((record[type] <= 0 && !value) || (record[type] >= 1 && value)) {
          record[type] = value ? 1 : 0;
          delete this._animations[tag];
          this._activeAnimations--;
        }
      },
      tag
    };
  }

  _animateDates(hide) {
    const tag = "_animateHideChart";
    const record = this._transitions;
    record.datesOpacity = hide ? 1 : 0;

    return {
      hook: () => {
        record.datesOpacity += hide ? -0.06 : 0.06;

        if (
          (record.datesOpacity <= 0 && hide) ||
          (record.datesOpacity >= 1 && !hide)
        ) {
          record.datesOpacity = hide ? 0 : 1;
          delete this._animations[tag];
          this._activeAnimations--;
        }
      },
      tag
    };
  }

  _animateYAxis(toDown) {
    const tag = "_animateYAxis";
    const yAxis = this._transitions.yAxis;

    yAxis.toDown = toDown;
    yAxis.opacity = 0;
    yAxis.shift = this._yAxisAnimationShift * (toDown ? -1 : 1);

    return {
      hook: () => {
        if (yAxis.opacity < 1) {
          yAxis.opacity += 0.05;
        }

        if (toDown) {
          if (yAxis.shift < 0) {
            yAxis.shift += (20 / ANIMATION_STEPS) * 8;
          }
        } else {
          if (yAxis.shift > 0) {
            yAxis.shift -= (20 / ANIMATION_STEPS) * 8;
          }
        }

        if (
          yAxis.opacity >= 1 &&
          ((toDown && yAxis.shift >= 0) || (!toDown && yAxis.shift <= 0))
        ) {
          yAxis.opacity = 1;
          yAxis.shift = 0;
          delete this._animations[tag];
          this._activeAnimations--;
        }
      },
      tag
    };
  }

  _animationLoop() {
    this._cleanUp();

    if (this._activeAnimations || this._state.drag.active) {
      for (const key in this._animations) {
        this._animations[key]();
      }

      this._render();

      requestAnimationFrame(this._animationLoop);
    } else {
      this._render();
    }
  }
}

function switchMode() {
  const data = _$TelegramCharts.modeSwitcherData;
  const modes = _$TelegramCharts.modes;
  const isNight = data.mode === modes.Night;
  const newMode = isNight ? modes.Day : modes.Night;

  data.mode = newMode;
  data.element.innerHTML = data.captions[newMode];
  appElement.classList = isNight ? "app" : "app app--night";

  for (let i = 0; i < data.updateHooks.length; i++) {
    data.updateHooks[i]();
  }
}

const switcherData = _$TelegramCharts.modeSwitcherData;

switcherData.element = appElement.querySelector(".mode-switcher");
switcherData.element.addEventListener("click", switchMode, LISTENER_OPTIONS);
