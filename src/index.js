/**
 * TODO
 * * Add paddings
 * * Add dates labels
 * * Floating window
 * * Night-mode
 * * _pushAnimation
 */

const VERBOSE = false;

const DATA_ENDPOINT = "./chart_data.json";
const LINES_COUNT = 6;
const SCALE_RATE = 1;
const MINIMAP_HEIGHT = 50;
const INITIAL_X_SCALE = 10;
const ANIMATION_STEPS = 16;
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

const listenerOpts = {
  passive: true
};

const types = {
  Line: "line",
  Date: "x"
};

const cavasType = {
  Minimap: "minimap",
  Chart: "chart",
  Graph: "graph"
};

const extremumType = {
  Local: "local",
  Global: "global"
};

const chartTypesList = [cavasType.Minimap, cavasType.Chart];

const colors = {
  ChartSeparator: "#ebf0f3",
  ChartText: "#94a2ab",
  MinimapBackground: "#f4f9fb"
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

let chartSet;

const hexToRgb = hex => {
  const result = HEX_REGEX.exec(hex);

  if (!result) {
    return null;
  }

  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  };
};

const rgbToString = (rgb, alpha = 1) =>
  `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;

const isLine = type => type === types.Line;

const calculateVerticalRatio = (maxValue, height) => {
  if (maxValue > height) {
    return height / maxValue;
  } else {
    const scaledHeight = SCALE_RATE * height;

    if (maxValue < scaledHeight) {
      return scaledHeight / maxValue;
    } else {
      return 1;
    }
  }
};

const calculateHorisontalRatio = (count, width) => width / count;

const createHiDPICanvas = (w, h) => {
  const canvas = document.createElement("canvas");
  canvas.width = w * PIXEL_RATIO;
  canvas.height = h * PIXEL_RATIO;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  canvas.getContext("2d").setTransform(PIXEL_RATIO, 0, 0, PIXEL_RATIO, 0, 0);
  return canvas;
};

const findExtremums = (data, excludes, range) => {
  let max = -Infinity;
  let min = Infinity;
  let from = 1;
  let to = data.columns[0].length;

  if (range) {
    from = range[0] + 1;
    to = range[1] + 1;
  }

  for (let column of data.columns) {
    const type = column[0];

    if (isLine(data.types[type]) && !excludes[type]) {
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

  return { max, min };
};

const fuzzyAdd = (sum, number) => {
  const result = sum + number;

  if (sum > 0) {
    return result < 0 ? 0 : result;
  }
  return result > 0 ? 0 : result;
};

const createCanvasObject = (type, width, height) => ({
  canvas: createHiDPICanvas(width, height),
  context: null,
  width,
  height,
  type
});

const createDragger = width => {
  const drugger = document.createElement("div");
  drugger.className = "chart__minimap-dragger";
  drugger.style.height = `${MINIMAP_HEIGHT}px`;
  drugger.style.width = `${width}px`;

  const arrowLeft = document.createElement("div");
  arrowLeft.className =
    "chart__minimap-dragger-arrow chart__minimap-dragger-arrow--left";
  const arrowRight = document.createElement("div");
  arrowRight.className =
    "chart__minimap-dragger-arrow chart__minimap-dragger-arrow--right";

  drugger.appendChild(arrowLeft);
  drugger.appendChild(arrowRight);

  return drugger;
};

class Chart {
  constructor(container, data, { w, h }) {
    this._data = data;
    this._dataCount = data.columns[0].length - 1;
    this._localExtremums = null;

    this._chart = createCanvasObject(cavasType.Chart, w, h);
    this._chart.canvas.className = "chart__chart-canvas";
    this._chart.context = this._chart.canvas.getContext("2d");

    this._graph = createCanvasObject(cavasType.Graph, w, h);
    this._graph.canvas.className = "chart__graph-canvas";
    this._graph.context = this._graph.canvas.getContext("2d");

    this._minimap = createCanvasObject(cavasType.Minimap, w, MINIMAP_HEIGHT);
    this._minimap.canvas.className = "chart__minimap-canvas";
    this._minimap.context = this._minimap.canvas.getContext("2d");

    this._rgbColors = {};
    this._transitions = {};
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
      opacity: {},
      xShift: 0
    };

    for (let column of data.columns) {
      const type = column[0];

      if (isLine(this._data.types[type])) {
        this._rgbColors[type] = hexToRgb(this._data.colors[type]);
        this._transitions.opacity[type] = 1;
      }
    }

    this._container = container;
    this._checkboxContainer = null;
    const dragWidth = w / INITIAL_X_SCALE;
    this._state = {
      exclude: {},
      drag: {
        active: false,
        resize: false,
        leftArrow: false,
        dragger: null,
        elem: null,
        initialWidth: dragWidth,
        width: dragWidth,
        downX: 0,
        deltaX: 0
      }
    };
    const fragment = document.createDocumentFragment();
    const wrapper = document.createElement("div");
    const dragger = createDragger(this._state.drag.width);
    this._state.drag.dragger = dragger;

    wrapper.className = "chart__minimap-wrapper";
    wrapper.appendChild(this._minimap.canvas);
    wrapper.appendChild(dragger);
    fragment.appendChild(this._graph.canvas);
    fragment.appendChild(this._chart.canvas);
    fragment.appendChild(wrapper);
    this._container.appendChild(fragment);

    this._onChangeCheckbox = this._onChangeCheckbox.bind(this);
    this._animationLoop = this._animationLoop.bind(this);
    this._startDrag = this._startDrag.bind(this);
    this._moveDrag = this._moveDrag.bind(this);
    this._endDrag = this._endDrag.bind(this);

    dragger.addEventListener("mousedown", this._startDrag, listenerOpts);
    wrapper.addEventListener("mouseup", this._endDrag, listenerOpts);
    wrapper.addEventListener("mouseleave", this._endDrag, listenerOpts);
    wrapper.addEventListener("mousemove", this._moveDrag, listenerOpts);

    this._localExtremums = findExtremums(
      this._data,
      this._state.exclude,
      this._getHorisontalParams(this._chart).window
    );

    this._globalExtremums = findExtremums(this._data, this._state.exclude);

    this._render();
    this._renderButtons();
  }

  _startDrag(event) {
    if (event.which !== 1 || !event.target) {
      return;
    }

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

    if (!drag.active) {
      return;
    }

    var moveX = pageX - drag.downX;

    if (Math.abs(moveX) < 4 || movementX === 0) {
      return;
    }

    const maxPadding = this._minimap.width - drag.width;

    if (drag.resize) {
      if (drag.leftArrow) {
        if (
          drag.width - movementX < drag.initialWidth ||
          drag.deltaX + movementX < 0
        ) {
          return;
        }

        const newVal = drag.deltaX + movementX;
        const newShift = newVal / this._minimap.width;
        drag.deltaX = newVal;
        drag.dragger.style.transform = `translateX(${newVal}px)`;
        this._transitions.xShift = newShift;

        return this._changeDragWidth(-movementX);
      }

      if (
        movementX + drag.width < drag.initialWidth ||
        maxPadding < drag.deltaX + movementX
      ) {
        return;
      }

      return this._changeDragWidth(movementX);
    }

    const sum = drag.deltaX + movementX;
    const val = sum < 0 ? 0 : sum > maxPadding ? maxPadding : sum;
    drag.dragger.style.transform = `translateX(${val}px)`;
    drag.deltaX = val;

    this._transitions.xShift = val / this._minimap.width;
    this._animations._animateVertical = this._animateVertical(
      this._findVerticalRatioDelta()
    );
  }

  _changeDragWidth(delta) {
    const { [cavasType.Chart]: record } = this._transitions;
    const { drag } = this._state;
    const changedWidth = drag.width + delta;
    const deltaRatio = drag.width / changedWidth;
    drag.width = changedWidth;
    drag.dragger.style.width = `${changedWidth}px`;

    this._animations._animateHorisontalScale = this._animateHorisontalScale(
      record.xRatioModifer,
      deltaRatio * record.xRatioModifer
    );
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

  _render() {
    this._drawChart();
    this._drawMinimap();
  }

  _drawChart() {
    this._chart.context.lineWidth = 1;
    this._renderAdditionalInfo(this._graph);
    this._chart.context.lineWidth = 2;
    this._renderChart(this._chart, this._getHorisontalParams(this._chart));
    this._renderLabels(this._graph);
  }

  _drawMinimap() {
    this._minimap.context.fillStyle = colors.MinimapBackground;
    this._minimap.context.fillRect(
      0,
      0,
      this._minimap.canvas.width,
      this._minimap.canvas.height
    );
    this._renderChart(this._minimap, this._getHorisontalParams(this._minimap));
  }

  _clear(canvas) {
    const context = canvas.getContext("2d");
    context.setTransform(PIXEL_RATIO, 0, 0, PIXEL_RATIO, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
  }

  _renderAdditionalInfo({ context, width, height }) {
    const stepSize = height / LINES_COUNT;

    context.beginPath();
    context.strokeStyle = colors.ChartSeparator;

    for (let i = 0; i < LINES_COUNT; i++) {
      const shift = height - i * stepSize;
      context.moveTo(0, shift);
      context.lineTo(width, shift);
    }

    context.stroke();
    context.closePath();
  }

  _renderLabels({ context, height }) {
    const { _localExtremums: extremums } = this;
    const stepSize = height / LINES_COUNT;

    context.lineWidth = 1;
    context.fillStyle = colors.ChartText;

    if (extremums.max !== -Infinity) {
      for (let i = 0; i < LINES_COUNT; i++) {
        const shift = height - i * stepSize;
        context.fillText(
          Math.round(extremums.max * (i / LINES_COUNT)),
          0,
          shift - 6
        );
      }
    }
  }

  _getHorisontalParams({ width, type }) {
    const { _transitions: transitions, _dataCount: count } = this;
    const xRatio = calculateHorisontalRatio(count, width);
    const scale = xRatio * transitions[type].xRatioModifer;

    const params = {
      scale,
      shift: -(count * scale * transitions.xShift),
      window: []
    };

    const start = Math.round(-params.shift / params.scale) - 1;

    params.window[0] = start < 0 ? 0 : start;
    params.window[1] = Math.round((width - params.shift) / params.scale);

    return params;
  }

  _getVerticalParams({ height, type }) {
    const { _transitions, _localExtremums, _globalExtremums } = this;
    const usedExtremums =
      type === cavasType.Chart ? _localExtremums : _globalExtremums;
    const yRatio = calculateVerticalRatio(usedExtremums.max, height);
    return yRatio + _transitions[type].yRatioModifer;
  }

  _renderChart(canvasParams, xParams) {
    const { context, width, height, type: canvasType } = canvasParams;
    const { _data: data, _transitions: transitions } = this;
    const isChart = canvasType === cavasType.Chart;

    // full = 1200
    // 10% => 120

    // TODO paddings
    // const lowestDot = extremums.min * verticalRatio;
    // const highestDot = extremums.max * verticalRatio;
    // const paddings = (scaledPixelsHeight - (highestDot - lowestDot)) / 2;
    // const delta = 0; //lowestDot - paddings;

    // if (VERBOSE) {
    //   console.log("Vertical ratio: " + yRatio);
    //   console.log("Horisontal ratio: " + xRatio);
    //   console.log(extremums);
    // }

    const yScale = this._getVerticalParams(canvasParams);
    const xScale = xParams.scale;
    const xShift = xParams.shift;

    if (xShift && isChart) {
      context.translate(xShift, 0);
    }

    for (let column of data.columns) {
      const type = column[0];
      const opacity = transitions.opacity[type];

      if (isLine(data.types[type]) && opacity !== 0) {
        context.beginPath();
        context.strokeStyle = rgbToString(this._rgbColors[type], opacity);
        context.moveTo(0, height - column[1] * yScale);

        for (let i = 2; i < column.length; i++) {
          if (isChart && (i + 1) * xScale + xShift < 0) {
            continue;
          }

          const x = i * xScale;
          context.lineTo(x, height - column[i] * yScale);

          if (isChart && x + xShift > width) {
            break;
          }
        }

        context.stroke();
        context.closePath();
      }
    }
  }

  _renderButtons() {
    let items = "";
    const { _data: data, _container: container } = this;

    for (let type in data.types) {
      if (data.types[type] === types.Line) {
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
    this._animations._hideChart = this._hideChart(target.name, target.checked);
    this._state.exclude[target.name] = !target.checked;
    const deltas = this._findVerticalRatioDelta();
    this._animations._animateVertical = this._animateVertical(deltas);
    this._animationLoop();
  }

  _findVerticalRatioDelta() {
    const oldExtremums = this._localExtremums;
    const newExtremums = findExtremums(
      this._data,
      this._state.exclude,
      this._getHorisontalParams(this._chart).window
    );

    const oldExtremumsGlobal = this._globalExtremums;
    const newExtremumsGlobal = findExtremums(this._data, this._state.exclude);

    const deltas = {};

    for (const canvasType of chartTypesList) {
      const { height } = this[`_${canvasType}`];
      const isChart = canvasType === canvasType.Chart;
      let extrOld = isChart ? oldExtremums : oldExtremumsGlobal;
      let extrNew = isChart ? newExtremums : newExtremumsGlobal;

      const oldVerticalRatio = calculateVerticalRatio(extrOld.max, height);
      const newVerticalRatio = calculateVerticalRatio(extrNew.max, height);
      deltas[canvasType] = newVerticalRatio - oldVerticalRatio;
    }

    this._localExtremums = newExtremums;
    this._globalExtremums = newExtremumsGlobal;

    return deltas;
  }

  _animateVertical(deltas) {
    const steps = {};

    for (let canvasType of chartTypesList) {
      steps[canvasType] = deltas[canvasType] / ANIMATION_STEPS;
      this._transitions[canvasType].yRatioModifer = -deltas[canvasType];
    }

    return () => {
      if (VERBOSE) {
        console.log("animate vertical");
      }

      for (let canvasType of chartTypesList) {
        const record = this._transitions[canvasType];
        const yModifer = record.yRatioModifer;

        if (
          (yModifer >= 0 && deltas[canvasType] > 0) ||
          (yModifer <= 0 && deltas[canvasType] < 0) ||
          steps[canvasType] === 0
        ) {
          delete this._animations._animateVertical;
        } else {
          record.yRatioModifer = fuzzyAdd(yModifer, steps[canvasType]);
        }
      }
    };
  }

  _animateHorisontalScale(oldVal, newVal) {
    const step = (newVal - oldVal) / ANIMATION_STEPS;
    const { [cavasType.Chart]: record } = this._transitions;
    record.xRatioModifer = newVal;

    return () => {
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
        delete this._animations._animateHorisontalScale;
      }
    };
  }

  _hideChart(type, value) {
    return () => {
      if (VERBOSE) {
        console.log("Hide chart");
      }
      const record = this._transitions.opacity;
      record[type] += value ? 0.08 : -0.08;

      if ((record[type] <= 0 && !value) || (record[type] >= 1 && value)) {
        delete this._animations._hideChart;
        record[type] = value ? 1 : 0;
      }
    };
  }

  _animationLoop() {
    if (VERBOSE) {
      console.log("animation tick");
    }

    if (Object.keys(this._animations).length || this._state.drag.active) {
      for (let key in this._animations) {
        this._animations[key]();
      }
      this._clear(this._chart.canvas);
      this._clear(this._graph.canvas);
      this._clear(this._minimap.canvas);

      this._render();
      window.requestAnimationFrame(this._animationLoop);
    }
  }
}

const onFetchData = data => {
  chartSet = data;
  const appContainer = document.querySelector(".app");
  const fragment = document.createDocumentFragment();

  const w = 800;
  const h = 400;

  for (let i = 0; i < data.length; i++) {
    const chartContainer = document.createElement("div");
    chartContainer.className = "chart";
    new Chart(chartContainer, data[i], { w, h });
    fragment.appendChild(chartContainer);
  }

  appContainer.appendChild(fragment);
};

const fetchData = () =>
  fetch(DATA_ENDPOINT)
    .then(data => data.json())
    .catch(console.log);

const bootUp = () => {
  fetchData().then(onFetchData);
};

document.addEventListener("DOMContentLoaded", bootUp);
