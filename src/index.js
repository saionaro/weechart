/**
 * TODO
 * * Refactor code
 * * Optimize _getXParams
 * * Add waves to checkbox
 * * Heal svg at firefox
 */

const VERBOSE = false;

const DATA_ENDPOINT = "./chart_data.json";
const HIDDEN_CLASS = "visually-hidden";
const DATA_TYPE_LINE = "line";
const ACTIVE_ARROW_CLASS = "chart__minimap-dragger-arrow--active";
const LINES_COUNT = 6;
const SCALE_RATE = 1;
const MINIMAP_HEIGHT = 50;
const INITIAL_X_SCALE = 5.35;
const ANIMATION_STEPS = 16;
const DATES_PLACE = 65;
const Y_AXIS_ANIMATION_SHIFT = 180;
const DATE_MARGIN = 16;
const HEX_REGEX = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i;
const PIXEL_RATIO = (() => {
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

const shortcuts = {
  months: [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec"
  ],
  weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
};

let appElement;

const listenerOpts = {
  passive: true
};

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
  onMouseUp: event => {
    const mouseupConsumers = _$TelegramCharts.mouseupConsumers;
    for (let i = 0; i < mouseupConsumers.length; i++) {
      mouseupConsumers[i](event);
    }
  },
  onTouchMove: event => {
    const touchmoveConsumers = _$TelegramCharts.touchmoveConsumers;
    for (let i = 0; i < touchmoveConsumers.length; i++) {
      touchmoveConsumers[i](event);
    }
  },
  onMouseMove: event => {
    const mousemoveConsumers = _$TelegramCharts.mousemoveConsumers;
    for (let i = 0; i < mousemoveConsumers.length; i++) {
      mousemoveConsumers[i](event);
    }
  },
  activateDragEvents: () => {
    document.addEventListener(
      "mousemove",
      _$TelegramCharts.onMouseMove,
      listenerOpts
    );
    document.addEventListener(
      "mouseup",
      _$TelegramCharts.onMouseUp,
      listenerOpts
    );

    document.addEventListener(
      "touchmove",
      _$TelegramCharts.onTouchMove,
      listenerOpts
    );

    document.addEventListener(
      "touchend",
      _$TelegramCharts.onMouseUp,
      listenerOpts
    );

    _$TelegramCharts.listenersActivated = true;
  }
};

const canvasTypesEnum = {
  Minimap: "minimap",
  Chart: "chart",
  Float: "float"
};

const chartTypesList = [canvasTypesEnum.Minimap, canvasTypesEnum.Chart];

const colors = {
  ChartSeparator: {
    day: { r: 235, g: 240, b: 243 },
    night: { r: 39, g: 53, b: 69 }
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
    day: { r: 175, g: 181, b: 187 },
    night: { r: 80, g: 103, b: 121 }
  },
  MinimapBackground: {
    day: "rgba(240, 247, 252, 0.6)",
    night: "rgba(29, 42, 57, 0.8)"
  }
};

const CheckedIcon = `<svg
  class="checked-icon"
  height="20"
  width="20"
  viewBox="0 0 40 40"
>
  <circle
    cx="20"
    cy="20"
    r="18"
    stroke="currentColor"
    stroke-width="2"
    fill="currentColor"
  />
  <polyline
    class="checked-icon__done"
    points="13,22 18,27 27,17"
    stroke-width="3"
    stroke-linejoin="round"
    stroke-linecap="round"
    stroke="white"
    fill="none"
  />
  <circle
    class="checked-icon__anime-circle"
    cx="20"
    cy="20"
    stroke="currentColor"
  />
</svg>`;

const hexToRgb = hex => {
  const result = HEX_REGEX.exec(hex);

  if (!result) return null;

  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  };
};

const rgbToString = (rgb, alpha = 1) =>
  `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;

const calculateVerticalRatio = (maxValue, height) => {
  if (maxValue > height) {
    return height / maxValue;
  } else {
    const scaledHeight = SCALE_RATE * height;

    if (maxValue < scaledHeight) {
      return scaledHeight / maxValue;
    } else return 1;
  }
};

const getCursorXPosition = (canvas, event) =>
  event.clientX - canvas.getBoundingClientRect().left;

const setTransform = (style, value) => {
  style.transform = `translateX(${value}px)`;
};

const createHiDPICanvas = (w, h) => {
  const canvas = document.createElement("canvas");
  canvas.width = w * PIXEL_RATIO;
  canvas.height = h * PIXEL_RATIO;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const context = canvas.getContext("2d");
  context.lineJoin = "round";
  context.setTransform(PIXEL_RATIO, 0, 0, PIXEL_RATIO, 0, 0);
  context.font = "lighter 13px Helvetica, Arial";
  return canvas;
};

const fuzzyAdd = (sum, number) => {
  const result = sum + number;

  if (sum > 0) return result < 0 ? 0 : result;

  return result > 0 ? 0 : result;
};

const throttle = (func, ms) => {
  let isThrottled = false;
  let savedArgs = null;

  const wrapper = (...args) => {
    if (isThrottled) {
      savedArgs = args;
      return;
    }

    func.apply(this, args);
    isThrottled = true;

    setTimeout(() => {
      isThrottled = false;

      if (savedArgs) {
        wrapper(...savedArgs);
        savedArgs = null;
      }
    }, ms);
  };

  return wrapper;
};

const cachedDates = {};

const toDateString = timestamp => {
  if (!cachedDates[timestamp]) {
    const date = new Date(timestamp);
    cachedDates[timestamp] = `${
      shortcuts.months[date.getMonth()]
    } ${date.getDate()}`;
  }
  return cachedDates[timestamp];
};

const chortcutNumber = number => {
  let res = number;
  if (number > 1000000) {
    return (number / 1000000).toFixed(1) + "M";
  }
  if (number > 1000) {
    return (number / 1000).toFixed(1) + "K";
  }
  return res;
};

const cachedWeekdays = {};

const toWeekday = timestamp => {
  if (!cachedWeekdays[timestamp]) {
    const date = new Date(timestamp);
    cachedWeekdays[timestamp] = `${shortcuts.weekdays[date.getDay()]}`;
  }
  return cachedWeekdays[timestamp];
};

const createCanvasObject = (type, width, height) => ({
  canvas: createHiDPICanvas(width, height),
  context: null,
  width,
  height,
  type
});

const createDragger = width => {
  const dragger = document.createElement("div");
  const arrowLeft = document.createElement("div");
  const arrowRight = document.createElement("div");

  dragger.className = "chart__minimap-dragger hide-selection";
  dragger.style.height = `${MINIMAP_HEIGHT - 4}px`;
  dragger.style.width = `${width}px`;

  arrowLeft.className =
    "chart__minimap-dragger-arrow chart__minimap-dragger-arrow--left";
  arrowRight.className =
    "chart__minimap-dragger-arrow chart__minimap-dragger-arrow--right";

  dragger.appendChild(arrowLeft);
  dragger.appendChild(arrowRight);

  return dragger;
};

const getLabelClass = title => `floating-window__${title.replace(/ +/g, "_")}`;

const createFloatingWindow = (data, colors) => {
  let sections = "";

  for (let type in data.names) {
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
  floatingWindow.innerHTML = `
    <p class="floating-window__date"></p>
      <ul class="floating-window__sections">
        ${sections}
      </ul>
    `;
  return floatingWindow;
};

const getColor = color => colors[color][_$TelegramCharts.modeSwitcherData.mode];

const createExtremumStore = () => ({
  prev: { min: 0, max: 0 },
  current: { min: 0, max: 0 }
});

class Chart {
  constructor(container, data, { w, h }) {
    this._data = data;
    this._lines = [];
    this._dates = null;
    this._dataCount = data.columns[0].length - 1;
    this._visibleCount = 0;

    this._chart = createCanvasObject(canvasTypesEnum.Chart, w, h);
    this._chart.height -= DATE_MARGIN;
    this._chart.canvas.className = "chart__chart-canvas hide-selection";
    this._chart.context = this._chart.canvas.getContext("2d");

    this._float = createCanvasObject(canvasTypesEnum.Float, w, h);
    this._float.canvas.className = "chart__float-canvas hide-selection";
    this._float.context = this._float.canvas.getContext("2d");

    this._minimap = createCanvasObject(
      canvasTypesEnum.Minimap,
      w,
      MINIMAP_HEIGHT
    );
    this._minimap.canvas.className = "chart__minimap-canvas hide-selection";
    this._minimap.context = this._minimap.canvas.getContext("2d");

    this._rgbColors = {};
    this._animations = [];

    this._transitions = {
      [canvasTypesEnum.Minimap]: {
        yRatioModifer: 0,
        xRatioModifer: 1
      },
      [canvasTypesEnum.Chart]: {
        yRatioModifer: 0,
        xRatioModifer: INITIAL_X_SCALE
      },
      chartsOpacity: {},
      datesOpacity: 1,
      yAxis: {
        opacity: 1,
        toDown: false,
        shift: 0
      },
      xShift: 0
    };

    for (let column of data.columns) {
      const type = column[0];

      if (this._data.types[type] === DATA_TYPE_LINE) {
        this._rgbColors[type] = hexToRgb(this._data.colors[type]);
        this._transitions.chartsOpacity[type] = 1;
        this._lines.push({
          type: column[0],
          data: column.slice(1)
        });
        this._visibleCount++;
      } else {
        this._dates = column.slice(1);
      }
    }

    this._container = container;
    this._checkboxContainer = null;
    const dragWidth = w / INITIAL_X_SCALE;
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
        touchEventAdapterData: { movementX: 0 }
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
    for (let column of this._lines) {
      floatingWindow.labels[column.type] = floatingWindow.elem.querySelector(
        `.${getLabelClass(column.type)}`
      );
    }

    setTransform(dragger.style, viewShift);
    this._transitions.xShift = viewShift / this._minimap.width;

    wrapper.className = "chart__minimap-wrapper";
    wrapper.appendChild(this._minimap.canvas);
    wrapper.appendChild(dragger);
    fragment.appendChild(this._chart.canvas);
    fragment.appendChild(this._float.canvas);
    fragment.appendChild(this._state.floatingWindow.elem);
    fragment.appendChild(wrapper);
    this._container.appendChild(fragment);

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

    dragger.addEventListener("mousedown", this._startDrag, listenerOpts);
    dragger.addEventListener(
      "touchstart",
      this._startDragTouchAdapter,
      listenerOpts
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
      listenerOpts
    );

    this._float.canvas.addEventListener(
      "mouseleave",
      this._floatMouseLeave,
      listenerOpts
    );

    this._float.canvas.addEventListener(
      "touchstart",
      this._floatMoveTouchAdapter,
      listenerOpts
    );

    this._localExtremums = createExtremumStore();
    this._globalExtremums = createExtremumStore();

    const hiddenDates = this._getHiddenDates(
      this._dataCount,
      this._getXParams(this._chart).window,
      w
    );

    this._hiddenDates = {
      prev: hiddenDates,
      current: hiddenDates
    };

    this._findAllExtremums();
    this._render();
    this._renderButtons();
  }

  _floatMoveTouchAdapter(event) {
    const touch = event.changedTouches[0];
    this._floatMouseMove(touch);
  }

  _floatMouseMove(event) {
    const {
      drag: { active }
    } = this._state;

    if (active || !this._visibleCount) return;

    const { scale, shift } = this._getXParams(this._chart);
    const cursorX = getCursorXPosition(this._float.canvas, event);
    const selected = Math.round((cursorX - shift) / scale);
    this._drawFloatingLine(selected, selected * scale + shift);
  }

  _drawFloatingLine(index, x) {
    const { canvas, context, height, width } = this._float;
    const { chartsOpacity } = this._transitions;
    this._clear(canvas);

    context.beginPath();
    context.lineWidth = 1;
    context.strokeStyle = getColor("FloatingLine");

    context.moveTo(x, 0);
    context.lineTo(x, height - DATE_MARGIN * 2);
    context.stroke();

    const yScale = this._getYParams(this._chart);

    const data = {
      date: 0,
      x,
      toLeft: width / 2 < x,
      values: {}
    };

    for (let column of this._lines) {
      if (chartsOpacity[column.type]) {
        const y = height - column.data[index] * yScale - DATE_MARGIN * 2;

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

  _updateFloatingWindow({ x, date, toLeft, values }) {
    const {
      floatingWindow: { elem, dateElem, labels }
    } = this._state;
    elem.classList.remove(HIDDEN_CLASS);
    dateElem.innerHTML = `${toWeekday(date)}, ${toDateString(date)}`;

    for (const type in values) {
      labels[type].innerHTML = chortcutNumber(values[type]);
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
    const {
      floatingWindow: { labels }
    } = this._state;

    labels[type].parentNode.classList.toggle(
      "floating-window__section--hidden",
      hide
    );
  }

  _floatMouseLeave() {
    setTimeout(() => {
      this._clear(this._float.canvas);
      this._state.floatingWindow.elem.classList.add(HIDDEN_CLASS);
    }, 100);
  }

  _findAllExtremums() {
    this._findExtremums(
      this._localExtremums,
      this._getXParams(this._chart).window
    );
    this._findExtremums(this._globalExtremums);
  }

  _findExtremums(store, range) {
    const { _lines, _state } = this;
    let max = -Infinity;
    let min = Infinity;
    let from = 1;
    let to = this._dataCount;

    if (range) {
      from = range[0] + 1;
      to = range[1] + 1;
    }

    for (let column of _lines) {
      if (!_state.exclude[column.type]) {
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

    if (max !== -Infinity) {
      max += min;
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

    const { drag } = this._state;
    const { classList } = event.target;

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
    const { drag } = this._state;
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

  _moveDrag({ movementX }) {
    const { drag } = this._state;

    if (!drag.active || !movementX) return;

    if (drag.resize) {
      return this._handleResize(movementX);
    }
    const maxPadding = this._minimap.width - drag.width;
    const sum = drag.marginLeft + movementX;
    const val = sum < 0 ? 0 : sum > maxPadding ? maxPadding : sum;
    setTransform(drag.dragger.style, val);
    drag.marginLeft = val;

    this._transitions.xShift = val / this._minimap.width;
    this._checkYScaleChange();
  }

  _handleResize(delta) {
    const { drag } = this._state;

    if (drag.leftArrow) {
      if (
        drag.width - delta < drag.initialWidth / 2 ||
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
      drag.width + delta < drag.initialWidth / 2 ||
      drag.marginLeft + delta > maxPadding
    ) {
      return;
    }

    this._changeDragWidth(delta);
  }

  _changeDragWidth(delta) {
    const { [canvasTypesEnum.Chart]: record } = this._transitions;
    const { drag } = this._state;
    const changedWidth = drag.width + delta;
    const deltaRatio = drag.width / changedWidth;
    drag.width = changedWidth;
    drag.dragger.style.width = `${changedWidth}px`;

    this._pushAnimation(
      this._animateHorisontal(
        record.xRatioModifer,
        deltaRatio * record.xRatioModifer
      )
    );
    this._checkYScaleChange();
    this._checkHiddenDatesChange();
  }

  _checkHiddenDatesChange() {
    const { _hiddenDates: dates } = this;

    const hiddenDates = this._getHiddenDates(
      this._dataCount,
      this._getXParams(this._chart).window,
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

    if (extrPrev.max !== extrCurr.max || extrPrev.min !== extrCurr.min) {
      this._pushAnimation(this._animateVertical(this._findYDeltas()));
      this._pushAnimation(this._animateYAxis(extrPrev.max < extrCurr.max));
    }
  }

  _endDrag() {
    const { drag } = this._state;
    drag.active = false;
    drag.leftArrow = false;
    drag.resize = false;
    drag.savedTouchX = 0;
    drag.dragger.classList.remove("chart__minimap-dragger--resizing");
    drag.dragger.classList.remove("chart__minimap-dragger--dragging");
    drag.leftElem.classList.remove(ACTIVE_ARROW_CLASS);
    drag.rightElem.classList.remove(ACTIVE_ARROW_CLASS);
  }

  _clear(canvas) {
    const context = canvas.getContext("2d");
    context.setTransform(PIXEL_RATIO, 0, 0, PIXEL_RATIO, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
  }

  _render() {
    this._drawChart();
    this._drawMinimap();
  }

  _drawChart() {
    this._chart.context.lineWidth = 1;
    this._renderLines(this._chart);
    this._chart.context.lineWidth = 2.5;
    const xParams = this._getXParams(this._chart);
    this._renderChart(this._chart, xParams);
    this._renderYValues(this._chart, xParams);
  }

  _drawMinimap() {
    const { context, height, width } = this._minimap;
    const { drag } = this._state;
    context.fillStyle = getColor("MinimapBackground");
    this._renderChart(this._minimap, this._getXParams(this._minimap));
    context.fillRect(0, 0, drag.marginLeft, height);
    context.fillRect(drag.marginLeft + drag.width, 0, width, height);
  }

  _renderLines({ context, width, height }) {
    const {
      _localExtremums: { current },
      _transitions: { yAxis }
    } = this;
    const stepSize = height / LINES_COUNT;
    const color = getColor("ChartSeparator");
    const maxHeight = height - DATE_MARGIN;

    context.beginPath();

    if (current.max !== -Infinity) {
      for (let i = 1; i < LINES_COUNT; i++) {
        const shift = maxHeight - i * stepSize;
        const y = shift + yAxis.shift;

        if (y <= maxHeight) {
          context.strokeStyle = rgbToString(color, yAxis.opacity);
          context.moveTo(0, y);
          context.lineTo(width, y);
        }

        if (yAxis.opacity < 1) {
          context.strokeStyle = rgbToString(color, 1 - yAxis.opacity);
          const y =
            shift -
            (Y_AXIS_ANIMATION_SHIFT * (yAxis.toDown ? -1 : 1) - yAxis.shift);

          if (y < maxHeight) {
            context.moveTo(0, y);
            context.lineTo(width, y);
          }
        }
      }
      context.strokeStyle = rgbToString(color, 1);
      context.moveTo(0, maxHeight);
      context.lineTo(width, maxHeight);
    }

    context.stroke();
    context.closePath();
  }

  _renderYValues({ context, height }, { shift }) {
    const {
      _localExtremums: { current, prev },
      _transitions: { yAxis }
    } = this;
    const stepSize = height / LINES_COUNT;
    const color = getColor("ChartText");
    const maxHeight = height - DATE_MARGIN - 6;

    context.lineWidth = 1;

    if (current.max !== -Infinity) {
      for (let i = 1; i < LINES_COUNT; i++) {
        const yShift = maxHeight - i * stepSize;
        const y = yShift + yAxis.shift;
        const part = i / LINES_COUNT;

        if (y < maxHeight) {
          context.fillStyle = rgbToString(color, yAxis.opacity);
          context.fillText(
            chortcutNumber(Math.round(current.max * part)),
            -shift,
            y
          );
        }

        if (yAxis.opacity < 1) {
          const yCoord =
            y -
            (Y_AXIS_ANIMATION_SHIFT * (yAxis.toDown ? -1 : 1) - yAxis.shift);

          if (yCoord < maxHeight) {
            context.fillStyle = rgbToString(color, 1 - yAxis.opacity);
            context.fillText(
              chortcutNumber(Math.round(prev.max * part)),
              -shift,
              yCoord
            );
          }
        }
      }
      context.fillStyle = rgbToString(color, 1);
      context.fillText(0, -shift, maxHeight);
    }
  }

  _getXParams({ width, type }) {
    const {
      _transitions: { xShift, [type]: record },
      _dataCount: count
    } = this;
    const countM1 = count - 1;
    const scale = (width / countM1) * record.xRatioModifer;

    const params = {
      scale,
      shift: -(countM1 * scale * xShift),
      window: [0, count]
    };

    if (type === canvasTypesEnum.Chart) {
      const start = Math.round(-params.shift / params.scale) - 1;
      const end = Math.round((width - params.shift) / params.scale) + 2;

      params.window[0] = start < 0 ? 0 : start;
      params.window[1] = end > count ? count : end;
    }

    return params;
  }

  _getYParams({ height, type }) {
    const { _transitions } = this;
    const usedExtremums =
      type === canvasTypesEnum.Chart
        ? this._localExtremums
        : this._globalExtremums;

    return (
      calculateVerticalRatio(usedExtremums.current.max, height) +
      _transitions[type].yRatioModifer
    );
  }

  _getHiddenDates(total, window, width) {
    const toHide = {};
    let count = window[1] - window[0];
    let iter = 1;

    while (count * DATES_PLACE > width) {
      for (let i = total - 1 - iter; i >= 0; i -= 2 * iter) {
        toHide[i] = true;
      }

      let localCount = 0;
      for (let i = window[0]; i < window[1]; i++) {
        localCount += toHide[i] ? 0 : 1;
      }
      count = localCount;
      iter++;
    }

    toHide._$count = Object.keys(toHide).length;

    return toHide;
  }

  _renderChart(canvasParams, { scale, shift, window }) {
    const { context, height, type: canvasType } = canvasParams;
    const {
      _hiddenDates: hiddenDates,
      _lines: lines,
      _transitions: { chartsOpacity, datesOpacity }
    } = this;
    const isChart = canvasType === canvasTypesEnum.Chart;
    const yScale = this._getYParams(canvasParams);

    if (shift && isChart) {
      context.translate(shift, 0);
    }

    const savedWidth = context.lineWidth;
    const savedFillStyle = context.fillStyle;
    const savedTextAlign = context.textAlign;

    let datesPainted = false;

    for (let column of lines) {
      const type = column.type;
      const opacityValue = chartsOpacity[type];

      if (opacityValue !== 0) {
        context.beginPath();
        context.strokeStyle = rgbToString(this._rgbColors[type], opacityValue);

        for (let i = window[0]; i < window[1]; i++) {
          const x = i * scale;
          let y = height - column.data[i] * yScale;

          if (isChart) {
            y -= DATE_MARGIN;
          }

          context.lineTo(x, y);

          if (isChart && !datesPainted) {
            const isLast = i === window[1] - 1;
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
              context.fillText(toDateString(this._dates[i]), x, height + 5);
            }

            context.lineWidth = savedWidth;
            context.fillStyle = savedFillStyle;
            context.textAlign = savedTextAlign;
          }
        }

        datesPainted = true;
        context.stroke();
        context.closePath();
      }
    }
  }

  _renderButtons() {
    let items = "";
    const { _data: data, _container: container, _lines } = this;

    for (let column of _lines) {
      const type = column.type;

      items += `<li class="charts-selector__item">
        <label class="checkbox" style="color: ${rgbToString(
          this._rgbColors[type]
        )}">
          <input
            type="checkbox"
            class="checkbox__input ${HIDDEN_CLASS}"
            name="${type}"
            checked
          >
          ${CheckedIcon}
          <span class="checkbox__title">${data.names[type]}</span>
        </label>
      </li>`;
    }

    const tempContainer = document.createElement("div");
    tempContainer.innerHTML = `<ul class="charts-selector">${items}</ul>`;
    this._checkboxContainer = tempContainer.children[0];
    this._checkboxContainer.addEventListener(
      "change",
      this._onChangeCheckbox,
      listenerOpts
    );
    container.appendChild(this._checkboxContainer);
  }

  _onChangeCheckbox({ target }) {
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
    this._animations[animation.tag] = animation.hook;
  }

  _findYDeltas() {
    const glob = this._globalExtremums;
    const local = this._localExtremums;
    const deltas = {};

    for (const canvasType of chartTypesList) {
      const { height } = this[`_${canvasType}`];
      const isChart = canvasType === canvasTypesEnum.Chart;
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

    for (let canvasType of chartTypesList) {
      steps[canvasType] = deltas[canvasType] / ANIMATION_STEPS;
      this._transitions[canvasType].yRatioModifer = -deltas[canvasType];
    }

    return {
      hook: () => {
        if (VERBOSE) {
          console.log("animate vertical");
        }

        let finishedAnimations = 0;

        for (let canvasType of chartTypesList) {
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

        if (finishedAnimations === chartTypesList.length) {
          delete this._animations[tag];
        }
      },
      tag
    };
  }

  _animateHorisontal(oldVal, newVal) {
    const tag = "_animateHorisontal";
    const step = (newVal - oldVal) / ANIMATION_STEPS;
    const { [canvasTypesEnum.Chart]: record } = this._transitions;
    record.xRatioModifer = newVal;

    return {
      hook: () => {
        if (VERBOSE) {
          console.log("animate horisontal scale");
        }
        record.xRatioModifer += step;

        if (
          (step < 0 && record.xRatioModifer <= newVal) ||
          (step > 0 && record.xRatioModifer >= newVal) ||
          step === 0
        ) {
          record.xRatioModifer = newVal;
          delete this._animations[tag];
        }
      },
      tag
    };
  }

  _animateHideChart(type, value) {
    const tag = "_animateHideChart";

    return {
      hook: () => {
        if (VERBOSE) {
          console.log("Hide chart");
        }
        const record = this._transitions.chartsOpacity;
        record[type] += value ? 0.08 : -0.08;

        if ((record[type] <= 0 && !value) || (record[type] >= 1 && value)) {
          delete this._animations[tag];
          record[type] = value ? 1 : 0;
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
        if (VERBOSE) {
          console.log("Dates opacity");
        }

        record.datesOpacity += hide ? -0.06 : 0.06;

        if (
          (record.datesOpacity <= 0 && hide) ||
          (record.datesOpacity >= 1 && !hide)
        ) {
          delete this._animations[tag];
          record.datesOpacity = hide ? 0 : 1;
        }
      },
      tag
    };
  }

  _animateYAxis(toDown) {
    const tag = "_animateYAxis";

    const {
      _transitions: { yAxis }
    } = this;

    yAxis.toDown = toDown;
    yAxis.opacity = 0;
    yAxis.shift = Y_AXIS_ANIMATION_SHIFT * (toDown ? -1 : 1);

    return {
      hook: () => {
        if (VERBOSE) {
          console.log("Animate y axis");
        }

        if (yAxis.opacity < 1) {
          yAxis.opacity += 0.08;
        }

        if (toDown) {
          if (yAxis.shift < 0) {
            yAxis.shift += (20 / ANIMATION_STEPS) * 8;
          } else return;
        } else {
          if (yAxis.shift > 0) {
            yAxis.shift -= (20 / ANIMATION_STEPS) * 8;
          } else return;
        }

        if (yAxis.opacity >= 1) {
          yAxis.opacity = 1;
          yAxis.shift = 0;
          delete this._animations[tag];
        }
      },
      tag
    };
  }

  _animationLoop() {
    if (VERBOSE) {
      console.log("animation tick");
    }

    this._clear(this._chart.canvas);
    this._clear(this._minimap.canvas);

    if (Object.keys(this._animations).length || this._state.drag.active) {
      for (let key in this._animations) {
        this._animations[key]();
      }
      this._render();
      requestAnimationFrame(this._animationLoop);
    } else {
      this._render();
    }
  }
}

const onFetchData = data => {
  const fragment = document.createDocumentFragment();
  const w = document.documentElement.clientWidth * 0.8;
  const h = 400;

  for (let i = 0; i < data.length; i++) {
    const chartContainer = document.createElement("div");
    chartContainer.className = "chart";
    new Chart(chartContainer, data[i], { w, h });
    fragment.appendChild(chartContainer);
  }

  appElement.querySelector(".app__charts").appendChild(fragment);
  _$TelegramCharts.modeSwitcherData.element.className = "button mode-switcher";
};

const fetchData = () =>
  fetch(DATA_ENDPOINT)
    .then(data => data.json())
    .catch(console.log);

const switchMode = () => {
  const { modeSwitcherData: data, modes } = _$TelegramCharts;
  const isNight = data.mode === modes.Night;
  const newMode = isNight ? modes.Day : modes.Night;

  data.mode = newMode;
  data.element.innerHTML = data.captions[newMode];
  appElement.classList = isNight ? "app" : "app app--night";

  for (let i = 0; i < data.updateHooks.length; i++) {
    data.updateHooks[i]();
  }
};

const bootUp = () => {
  const switcherData = _$TelegramCharts.modeSwitcherData;
  appElement = document.querySelector(".app");
  fetchData().then(onFetchData);
  switcherData.element = appElement.querySelector(".mode-switcher");
  switcherData.element.addEventListener("click", switchMode, listenerOpts);
};

document.addEventListener("DOMContentLoaded", bootUp);
