/**
 * TODO
 * * Animate dates
 * * Touch events
 * * Optimize floating window rendering
 * * Refactor code
 * * Improve yAxis animation
 */

const VERBOSE = false;

const DATA_ENDPOINT = "./chart_data.json";
const LINES_COUNT = 6;
const SCALE_RATE = 1;
const MINIMAP_HEIGHT = 75;
const INITIAL_X_SCALE = 5;
const ANIMATION_STEPS = 16;
const Y_AXIS_ANIMATION_SHIFT = 200;
const DATE_MARGIN = 16;
const HEX_REGEX = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i;
const PIXEL_RATIO = (() => {
  const ctx = document.createElement("canvas").getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const bsr =
    ctx.webkitBackingStorePixelRatio ||
    ctx.mozBackingStorePixelRatio ||
    ctx.msBackingStorePixelRatio ||
    ctx.oBackingStorePixelRatio ||
    ctx.backingStorePixelRatio ||
    1;
  return dpr / bsr;
})();

const monthNames = [
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
];

const weekdaysNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

let appElement;

const modes = {
  Night: "night",
  Day: "day"
};

const listenerOpts = {
  passive: true
};

const _$TelegramCharts = {
  modeSwitcherData: {
    element: null,
    updateHooks: [],
    captions: {
      [modes.Night]: "Switch to Day Mode",
      [modes.Day]: "Switch to Night Mode"
    },
    mode: modes.Day
  },
  listenersActivated: false,
  mousemoveConsumers: [],
  mouseupConsumers: [],
  onMouseUp: event => {
    const mouseupConsumers = _$TelegramCharts.mouseupConsumers;
    for (let i = 0; i < mouseupConsumers.length; i++) {
      mouseupConsumers[i](event);
    }
  },
  onMouseMove: event => {
    const mousemoveConsumers = _$TelegramCharts.mousemoveConsumers;
    for (let i = 0; i < mousemoveConsumers.length; i++) {
      mousemoveConsumers[i](event);
    }
  },
  activateDragEvents: () => {
    window.document.addEventListener(
      "mousemove",
      _$TelegramCharts.onMouseMove,
      listenerOpts
    );
    window.document.addEventListener(
      "mouseup",
      _$TelegramCharts.onMouseUp,
      listenerOpts
    );
    _$TelegramCharts.listenersActivated = true;
  }
};

const dataTypes = {
  Line: "line",
  Date: "x"
};

const cavasType = {
  Minimap: "minimap",
  Chart: "chart",
  Float: "float"
};

const chartTypesList = [cavasType.Minimap, cavasType.Chart];

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
    day: { r: 148, g: 162, b: 171 },
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
    r="17"
    stroke="currentColor"
    stroke-width="3"
    fill="currentColor"
  />
  <polyline
    points="13,22 18,27 27,17"
    stroke-width="4"
    stroke-linejoin="round"
    stroke-linecap="round"
    stroke="white"
    fill="none"
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

const isLine = type => type === dataTypes.Line;

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

const calculateHorisontalRatio = (count, width) => width / count;

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
  context.setTransform(PIXEL_RATIO, 0, 0, PIXEL_RATIO, 0, 0);
  context.font = "11px Helvetica, Arial";
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
    cachedDates[timestamp] = `${monthNames[date.getMonth()]} ${date.getDate()}`;
  }
  return cachedDates[timestamp];
};

const cachedWeekdays = {};

const toWeekday = timestamp => {
  if (!cachedWeekdays[timestamp]) {
    const date = new Date(timestamp);
    cachedWeekdays[timestamp] = `${weekdaysNames[date.getDay()]}`;
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
  dragger.className = "chart__minimap-dragger hide-selection";
  dragger.style.height = `${MINIMAP_HEIGHT - 4}px`;
  dragger.style.width = `${width}px`;

  const arrowLeft = document.createElement("div");
  arrowLeft.className =
    "chart__minimap-dragger-arrow chart__minimap-dragger-arrow--left";
  const arrowRight = document.createElement("div");
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
  floatingWindow.className = "floating-window visually-hidden";
  floatingWindow.innerHTML = `
    <p class="floating-window__date"></p>
      <ul class="floating-window__sections">
        ${sections}
      </ul>
    `;
  return floatingWindow;
};

class Chart {
  constructor(container, data, { w, h }) {
    this._data = data;
    this._dataCount = data.columns[0].length - 1;

    this._chart = createCanvasObject(cavasType.Chart, w, h);
    this._chart.height -= DATE_MARGIN;
    this._chart.canvas.className = "chart__chart-canvas";
    this._chart.context = this._chart.canvas.getContext("2d");

    this._float = createCanvasObject(cavasType.Float, w, h);
    this._float.canvas.className = "chart__float-canvas";
    this._float.context = this._float.canvas.getContext("2d");

    this._minimap = createCanvasObject(cavasType.Minimap, w, MINIMAP_HEIGHT);
    this._minimap.canvas.className = "chart__minimap-canvas";
    this._minimap.context = this._minimap.canvas.getContext("2d");

    this._rgbColors = {};
    this._animations = [];

    this._transitions = {
      [cavasType.Minimap]: {
        yRatioModifer: 0,
        xRatioModifer: 1
      },
      [cavasType.Chart]: {
        yRatioModifer: 0,
        xRatioModifer: INITIAL_X_SCALE
      },
      chartsOpacity: {},
      yAxis: {
        opacity: 1,
        toDown: false,
        shift: 0
      },
      xShift: 0
    };

    for (let column of data.columns) {
      const type = column[0];

      if (isLine(this._data.types[type])) {
        this._rgbColors[type] = hexToRgb(this._data.colors[type]);
        this._transitions.chartsOpacity[type] = 1;
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
        dateElem: null
      },
      drag: {
        active: false,
        resize: false,
        leftArrow: false,
        dragger: createDragger(dragWidth),
        elem: null,
        initialWidth: dragWidth,
        width: dragWidth,
        downX: 0,
        marginLeft: viewShift
      }
    };

    const fragment = document.createDocumentFragment();
    const wrapper = document.createElement("div");
    const dragger = this._state.drag.dragger;
    this._state.floatingWindow.elem = createFloatingWindow(
      this._data,
      this._rgbColors
    );
    this._state.floatingWindow.dateElem = this._state.floatingWindow.elem.querySelector(
      ".floating-window__date"
    );

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
    this._floatMouseMove = throttle(this._floatMouseMove.bind(this), 60);
    this._floatMouseLeave = this._floatMouseLeave.bind(this);

    dragger.addEventListener("mousedown", this._startDrag, listenerOpts);

    if (!_$TelegramCharts.listenersActivated) {
      _$TelegramCharts.activateDragEvents();
    }

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

    this._localExtremums = {
      prev: { min: 0, max: 0 },
      current: { min: 0, max: 0 }
    };

    this._globalExtremums = {
      prev: { min: 0, max: 0 },
      current: { min: 0, max: 0 }
    };

    this._findAllExtremums();
    this._render();
    this._renderButtons();
  }

  _floatMouseMove(event) {
    const { scale, shift, window } = this._getHorisontalParams(this._chart);
    const cursorX = getCursorXPosition(this._float.canvas, event);
    const selected = Math.ceil(cursorX / scale + window[0]);
    this._drawFloatingLine(selected, selected * scale + shift);
  }

  _drawFloatingLine(index, x) {
    const { canvas, context, height } = this._float;
    const { chartsOpacity } = this._transitions;
    this._clear(canvas);

    context.beginPath();
    context.lineWidth = 1;
    context.strokeStyle =
      colors.FloatingLine[_$TelegramCharts.modeSwitcherData.mode];

    context.moveTo(x, 0);
    context.lineTo(x, height - DATE_MARGIN * 2);
    context.stroke();

    const yScale = this._getVerticalParams(this._chart);
    let dates;

    const data = {
      date: 0,
      x,
      values: {}
    };

    for (let column of this._data.columns) {
      const type = column[0];

      if (!isLine(this._data.types[type])) {
        dates = column;
        continue;
      }

      if (chartsOpacity[type]) {
        const y = height - column[index] * yScale - DATE_MARGIN * 2;

        data.date = dates[index];
        data.values[type] = column[index];

        context.strokeStyle = rgbToString(this._rgbColors[type], 1);
        context.beginPath();
        context.arc(x, y, 5, 0, 2 * Math.PI, false);
        context.fillStyle =
          colors.ChartBackground[_$TelegramCharts.modeSwitcherData.mode];
        context.fill();
        context.lineWidth = 2;
        context.stroke();
      }
    }
    this._updateFloatingWindow(data);
  }

  _updateFloatingWindow({ x, date, values }) {
    const {
      floatingWindow: { elem, dateElem }
    } = this._state;
    elem.className = "floating-window";
    dateElem.innerHTML = `${toWeekday(date)}, ${toDateString(date)}`;

    for (const type in values) {
      elem.querySelector(`.${getLabelClass(type)}`).innerHTML = values[type];
    }

    elem.style = `transform: translateX(${x + 15}px)`;
  }

  _hideFloatingWindowLabel(type, hide) {
    const {
      floatingWindow: { elem }
    } = this._state;
    const countElem = elem.querySelector(`.${getLabelClass(type)}`);
    const className = hide
      ? "floating-window__section floating-window__section--hidden"
      : "floating-window__section";
    countElem.parentNode.className = className;
  }

  _floatMouseLeave() {
    setTimeout(() => {
      this._clear(this._float.canvas);
      this._state.floatingWindow.elem.className =
        "floating-window visually-hidden";
    }, 100);
  }

  _findAllExtremums() {
    this._findExtremums(
      this._localExtremums,
      this._getHorisontalParams(this._chart).window
    );
    this._findExtremums(this._globalExtremums);
  }

  _findExtremums(store, range) {
    const { _data, _state } = this;
    let max = -Infinity;
    let min = Infinity;
    let from = 1;
    let to = _data.columns[0].length;

    if (range) {
      from = range[0] + 1;
      to = range[1] + 1;
    }

    for (let column of _data.columns) {
      const type = column[0];

      if (isLine(_data.types[type]) && !_state.exclude[type]) {
        for (let i = from; i < to; i++) {
          if (column[i] > max) {
            max = column[i];
          }
          if (column[i] < min) {
            min = column[i];
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

  _startDrag(event) {
    if (event.which !== 1 || !event.target) return;

    const { drag } = this._state;
    const { classList } = event.target;

    if (classList.contains("chart__minimap-dragger-arrow")) {
      drag.resize = true;

      if (classList.contains("chart__minimap-dragger-arrow--left")) {
        drag.leftArrow = true;
      }
    } else {
      this._state.drag.dragger.classList += " chart__minimap-dragger--dragging";
    }

    drag.elem = event.target;
    drag.downX = event.pageX;
    drag.active = true;
    this._animationLoop();
  }

  _moveDrag({ pageX, movementX }) {
    const { drag } = this._state;

    if (!drag.active) return;

    var moveX = pageX - drag.downX;

    if (Math.abs(moveX) < 4 || movementX === 0) return;

    const maxPadding = this._minimap.width - drag.width;

    if (drag.resize) {
      if (drag.leftArrow) {
        if (
          drag.width - movementX < drag.initialWidth / 2 ||
          drag.marginLeft + movementX < 0
        ) {
          return;
        }

        const newVal = drag.marginLeft + movementX;
        const newShift = newVal / this._minimap.width;
        drag.marginLeft = newVal;
        setTransform(drag.dragger.style, newVal);
        this._transitions.xShift = newShift;

        return this._changeDragWidth(-movementX);
      }

      if (
        drag.width + movementX < drag.initialWidth / 2 ||
        drag.marginLeft + movementX > maxPadding
      ) {
        return;
      }

      return this._changeDragWidth(movementX);
    }

    const sum = drag.marginLeft + movementX;
    const val = sum < 0 ? 0 : sum > maxPadding ? maxPadding : sum;
    setTransform(drag.dragger.style, val);
    drag.marginLeft = val;

    this._transitions.xShift = val / this._minimap.width;
    this._checkYScaleChange();
  }

  _checkYScaleChange() {
    const extremums = this._localExtremums;
    this._findAllExtremums();

    if (
      extremums.prev.max !== extremums.current.max ||
      extremums.prev.min !== extremums.current.min
    ) {
      this._pushAnimation(
        this._animateVertical(this._findVerticalRatioDelta())
      );
      this._pushAnimation(
        this._animateYAxis(extremums.prev.max < extremums.current.max)
      );
    }
  }

  _changeDragWidth(delta) {
    const { [cavasType.Chart]: record } = this._transitions;
    const { drag } = this._state;
    const changedWidth = drag.width + delta;
    const deltaRatio = drag.width / changedWidth;
    drag.width = changedWidth;
    drag.dragger.style.width = `${changedWidth}px`;

    this._pushAnimation(
      this._animateHorisontalScale(
        record.xRatioModifer,
        deltaRatio * record.xRatioModifer
      )
    );
    this._checkYScaleChange();
  }

  _endDrag() {
    const { drag } = this._state;
    drag.elem = null;
    drag.active = false;
    drag.leftArrow = false;
    drag.resize = false;
    drag.downX = 0;
    this._state.drag.dragger.classList = "chart__minimap-dragger";
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
    this._renderAdditionalInfo(this._chart);
    this._chart.context.lineWidth = 2;
    const xParams = this._getHorisontalParams(this._chart);
    this._renderChart(this._chart, xParams);
    this._renderLabels(this._chart, xParams);
  }

  _drawMinimap() {
    const { context, height, width } = this._minimap;
    const { drag } = this._state;
    context.fillStyle =
      colors.MinimapBackground[_$TelegramCharts.modeSwitcherData.mode];
    this._renderChart(this._minimap, this._getHorisontalParams(this._minimap));
    context.fillRect(0, 0, drag.marginLeft, height);
    context.fillRect(drag.marginLeft + drag.width, 0, width, height);
  }

  _renderAdditionalInfo({ context, width, height }) {
    const stepSize = height / LINES_COUNT;
    const {
      _transitions: { yAxis }
    } = this;

    context.beginPath();

    for (let i = 0; i < LINES_COUNT; i++) {
      const shift = height - i * stepSize;
      const isZero = i === 0;

      context.strokeStyle = rgbToString(
        colors.ChartSeparator[_$TelegramCharts.modeSwitcherData.mode],
        isZero ? 1 : yAxis.opacity
      );

      const y = shift - DATE_MARGIN + (isZero ? 0 : yAxis.shift);

      context.moveTo(0, y);
      context.lineTo(width, y);

      if (yAxis.opacity < 1 && !isZero) {
        context.strokeStyle = rgbToString(
          colors.ChartSeparator[_$TelegramCharts.modeSwitcherData.mode],
          1 - yAxis.opacity
        );
        const y = shift - DATE_MARGIN - (Y_AXIS_ANIMATION_SHIFT - yAxis.shift);
        context.moveTo(0, y);
        context.lineTo(width, y);
      }
    }

    context.stroke();
    context.closePath();
  }

  _renderLabels({ context, height }, { shift }) {
    const {
      _localExtremums: extremums,
      _transitions: { yAxis }
    } = this;
    const stepSize = height / LINES_COUNT;

    context.lineWidth = 1;

    if (extremums.current.max !== -Infinity) {
      for (let i = 0; i < LINES_COUNT; i++) {
        const yShift = height - i * stepSize;
        const isZero = i === 0;

        context.fillStyle = rgbToString(
          colors.ChartText[_$TelegramCharts.modeSwitcherData.mode],
          isZero ? 1 : yAxis.opacity
        );

        const y = yShift - 6 - DATE_MARGIN + (isZero ? 0 : yAxis.shift);

        context.fillText(
          Math.round(extremums.current.max * (i / LINES_COUNT)),
          -shift,
          y
        );

        if (yAxis.opacity < 1 && !isZero) {
          context.fillStyle = rgbToString(
            colors.ChartText[_$TelegramCharts.modeSwitcherData.mode],
            1 - yAxis.opacity
          );

          context.fillText(
            Math.round(extremums.prev.max * (i / LINES_COUNT)),
            -shift,
            yShift - 6 - DATE_MARGIN - (Y_AXIS_ANIMATION_SHIFT - yAxis.shift)
          );
        }
      }
    }
  }

  _getHorisontalParams({ width, type }) {
    const {
      _transitions: { xShift, [type]: record },
      _dataCount: count
    } = this;
    const xRatio = calculateHorisontalRatio(count, width);
    const scale = xRatio * record.xRatioModifer;

    const params = {
      scale,
      shift: -(count * scale * xShift),
      window: []
    };

    const start = Math.round(-params.shift / params.scale) - 1;
    const end = Math.round((width - params.shift) / params.scale);

    params.window[0] = start < 0 ? 0 : start;
    params.window[1] = end > count ? count : end;

    return params;
  }

  _getVerticalParams({ height, type }) {
    const { _transitions, _localExtremums, _globalExtremums } = this;
    const usedExtremums =
      type === cavasType.Chart ? _localExtremums : _globalExtremums;

    return (
      calculateVerticalRatio(usedExtremums.current.max, height) +
      _transitions[type].yRatioModifer
    );
  }

  _renderChart(canvasParams, { scale, shift }) {
    const { context, width, height, type: canvasType } = canvasParams;
    const {
      _data: data,
      _transitions: { chartsOpacity }
    } = this;
    const isChart = canvasType === cavasType.Chart;
    const yScale = this._getVerticalParams(canvasParams);

    if (shift && isChart) {
      context.translate(shift, 0);
    }

    const savedWidth = context.lineWidth;
    const savedFillStyle = context.fillStyle;
    const savedTextAlign = context.textAlign;
    let datesPainted = false;
    let dates;

    const everyCount = Math.round(100 / scale);

    for (let column of data.columns) {
      const type = column[0];
      const opacityValue = chartsOpacity[type];
      const isDates = !isLine(data.types[type]);

      if (isDates) {
        dates = column;
        continue;
      }

      if (opacityValue !== 0) {
        context.beginPath();
        context.strokeStyle = rgbToString(this._rgbColors[type], opacityValue);
        context.moveTo(0, height - column[1] * yScale);

        for (let i = 2; i < column.length; i++) {
          if (isChart && (i + 1) * scale + shift < 0) {
            continue;
          }

          const x = i * scale;
          let y = height - column[i] * yScale;

          if (isChart) {
            y -= DATE_MARGIN;
          }
          context.lineTo(x, y);

          if (isChart && !datesPainted && !(i % everyCount)) {
            context.textAlign = "center";
            context.lineWidth = 1;
            context.fillStyle = rgbToString(
              colors.ChartText[_$TelegramCharts.modeSwitcherData.mode]
            );

            context.fillText(toDateString(dates[i]), x, height);

            context.lineWidth = savedWidth;
            context.fillStyle = savedFillStyle;
            context.textAlign = savedTextAlign;
          }

          if (isChart && x + shift > width) break;
        }

        datesPainted = true;
        context.stroke();
        context.closePath();
      }
    }
  }

  _renderButtons() {
    let items = "";
    const { _data: data, _container: container } = this;

    for (let type in data.types) {
      if (isLine(data.types[type])) {
        items += `<li class="charts-selector__item">
          <label class="checkbox" style="color: ${rgbToString(
            this._rgbColors[type]
          )}">
            <input
              type="checkbox"
              class="checkbox__input visually-hidden"
              name="${type}"
              checked
            >
            ${CheckedIcon}
            <span class="checkbox__title">${data.names[type]}</span>
          </label>
        </li>`;
      }
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
    this._pushAnimation(this._animateHideChart(target.name, target.checked));
    this._state.exclude[target.name] = !target.checked;
    this._hideFloatingWindowLabel(target.name, !target.checked);
    this._findAllExtremums();

    this._pushAnimation(this._animateVertical(this._findVerticalRatioDelta()));
    if (this._localExtremums.prev.max !== this._localExtremums.current.max) {
      this._pushAnimation(
        this._animateYAxis(
          this._localExtremums.prev.max < this._localExtremums.current.max
        )
      );
    }

    this._animationLoop();
  }

  _pushAnimation(animation) {
    this._animations[animation.tag] = animation.hook;
  }

  _findVerticalRatioDelta() {
    const glob = this._globalExtremums;
    const local = this._localExtremums;

    const deltas = {};

    for (const canvasType of chartTypesList) {
      const { height } = this[`_${canvasType}`];
      const isChart = canvasType === cavasType.Chart;
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

  _animateHorisontalScale(oldVal, newVal) {
    const tag = "_animateHorisontalScale";
    const step = (newVal - oldVal) / ANIMATION_STEPS;
    const { [cavasType.Chart]: record } = this._transitions;
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
        console.log("Animate y axis");

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
          delete this._animations[tag];
          yAxis.opacity = 1;
          yAxis.shift = 0;
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
      window.requestAnimationFrame(this._animationLoop);
    } else {
      this._render();
    }
  }
}

const onFetchData = data => {
  const fragment = document.createDocumentFragment();

  const w = 800;
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
  const { modeSwitcherData: data } = _$TelegramCharts;
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
