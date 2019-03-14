/**
 * TODO
 * * Fix paddings
 * * Add dates labels
 * * Add window-view
 */

const VERBOSE = true;

const DATA_ENDPOINT = "./chart_data.json";
const LINES_COUNT = 6;
const SCALE_RATE = 0.9;
const MINIMAP_HEIGHT = 50;
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

const createHiDPICanvas = (w, h, ratio = PIXEL_RATIO) => {
  const canvas = document.createElement("canvas");
  canvas.width = w * ratio;
  canvas.height = h * ratio;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  canvas.getContext("2d").setTransform(ratio, 0, 0, ratio, 0, 0);
  return canvas;
};

const calculateHorisontalRatio = (count, width) => width / count;

const findExtremums = (data, excludes) => {
  let max = -Infinity;
  let min = Infinity;

  for (let column of data.columns) {
    const type = column[0];

    if (isLine(data.types[type]) && !excludes[type]) {
      for (let i = 1; i < column.length; i++) {
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
  drugger.className = "chart__minimap-drugger";
  drugger.style.height = `${MINIMAP_HEIGHT}px`;
  drugger.style.width = `${width}px`;
  return drugger;
};

class Chart {
  constructor(container, data, { w, h }) {
    this._data = data;
    this._dataCount = data.columns[0].length - 1;

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
        xRatioModifer: 0
      },
      [cavasType.Chart]: {
        yRatioModifer: 0,
        xRatioModifer: 0
      },
      opacity: {},
      xShift: 0.5
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
    this._state = {
      exclude: {},
      drag: {
        elem: null,
        width: w / 10,
        downX: 0,
        downY: 0,
        deltaX: 0
      }
    };
    this._onChangeCheckbox = this._onChangeCheckbox.bind(this);
    this._animationLoop = this._animationLoop.bind(this);
    this._startDrag = this._startDrag.bind(this);
    this._moveDrag = this._moveDrag.bind(this);
    this._endDrag = this._endDrag.bind(this);

    container.appendChild(this._graph.canvas);
    container.appendChild(this._chart.canvas);

    const wrapper = document.createElement("div");
    wrapper.className = "chart__minimap-wrapper";
    const dragger = createDragger(this._state.drag.width);

    wrapper.appendChild(this._minimap.canvas);
    wrapper.appendChild(dragger);

    dragger.addEventListener("mousedown", this._startDrag, listenerOpts);
    wrapper.addEventListener("mouseup", this._endDrag, listenerOpts);
    wrapper.addEventListener("mouseleave", this._endDrag, listenerOpts);
    wrapper.addEventListener("mousemove", this._moveDrag, listenerOpts);

    container.appendChild(wrapper);

    this._render();
    this._renderButtons();
  }

  _startDrag(event) {
    if (event.which !== 1) {
      return;
    }

    var elem = event.target;

    if (!elem) return;

    const { drag } = this._state;

    drag.elem = elem;
    drag.downX = event.pageX;
    drag.downY = event.pageY;
  }

  _moveDrag(event) {
    const { drag } = this._state;

    if (!drag.elem) {
      return;
    }

    var moveX = event.pageX - drag.downX;

    if (Math.abs(moveX) < 4) {
      return;
    }

    const sum = drag.deltaX + event.movementX;
    const maxPadding = this._minimap.width - drag.width;
    let val = sum < 0 ? 0 : sum > maxPadding ? maxPadding : sum;
    drag.elem.style.transform = `translateX(${val}px)`;
    drag.deltaX = val;
  }

  _endDrag() {
    this._state.drag.elem = null;
    this._state.drag.downX = 0;
    this._state.drag.downY = 0;
  }

  _render() {
    const extremums = findExtremums(this._data, this._state.exclude);
    this._drawChart(extremums);
    this._drawMinimap(extremums);
  }

  _drawChart(extremums) {
    this._chart.context.lineWidth = 1;
    this._renderAdditionalInfo(this._graph);
    this._chart.context.lineWidth = 2;
    this._renderChart(this._chart, extremums);
    this._renderLabels(this._graph, extremums);
  }

  _drawMinimap(extremums) {
    this._minimap.context.fillStyle = colors.MinimapBackground;
    this._minimap.context.fillRect(
      0,
      0,
      this._minimap.canvas.width,
      this._minimap.canvas.height
    );
    this._renderChart(this._minimap, extremums);
  }

  _clear(canvas) {
    const context = canvas.getContext("2d");
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
    context.restore();
    context.closePath();
  }

  _renderLabels({ context, height }, extremums) {
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

  _renderChart({ context, width, height, type: canvasType }, extremums) {
    const { _data: data, _transitions: transitions, _dataCount: count } = this;
    const yRatio = calculateVerticalRatio(extremums.max, height);
    const xRatio = calculateHorisontalRatio(data.columns[0].length, width);

    // full = 1200
    // 10% => 120

    // TODO paddings
    // const lowestDot = extremums.min * verticalRatio;
    // const highestDot = extremums.max * verticalRatio;
    // const paddings = (scaledPixelsHeight - (highestDot - lowestDot)) / 2;
    // const delta = 0; //lowestDot - paddings;

    if (VERBOSE) {
      console.log("Vertical ratio: " + yRatio);
      console.log("Horisontal ratio: " + xRatio);
      console.log(extremums);
    }

    // const xShift = transitions.common.xShift;

    // if (xShift && canvasType === cavasType.Chart) {
    //   const shift = count * xRatioFinal * xShift;
    //   context.translate(-shift, 0);
    // }
    // console.log(transitions);

    // const transitions = this._transitions[type];
    const yModifer = transitions[canvasType].yRatioModifer;
    let xModifer = transitions[canvasType].xRatioModifer;

    const yRatioFinal = yRatio + yModifer;
    let xRatioFinal;

    if (canvasType === cavasType.Chart) {
      xModifer = 10;
      xRatioFinal = xRatio * xModifer;
    } else {
      xRatioFinal = xRatio + xModifer;
    }

    for (let column of data.columns) {
      const type = column[0];
      const opacity = transitions.opacity[type];

      if (isLine(data.types[type]) && opacity !== 0) {
        context.beginPath();
        context.strokeStyle = rgbToString(this._rgbColors[type], opacity);
        context.moveTo(0, height - column[1] * yRatioFinal);

        for (let i = 2; i < column.length; i++) {
          context.lineTo(i * xRatioFinal, height - column[i] * yRatioFinal);
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
            <input type="checkbox" class="checkbox__input visually-hidden" name="${type}" checked>
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
    this._animations["_hideChart"] = this._hideChart(
      target.name,
      target.checked
    );
    const deltas = this._findVerticalRatioDelta(target.name, target.checked);
    this._animations["_animateCharts"] = this._animateCharts(deltas);
    this._animationLoop();
  }

  _findVerticalRatioDelta(type, value) {
    const oldExtremums = findExtremums(this._data, this._state.exclude);
    this._state.exclude[type] = !value;
    const newExtremums = findExtremums(this._data, this._state.exclude);

    const deltas = {};

    for (const canvasType of chartTypesList) {
      const { height } = this[`_${canvasType}`];
      const oldVerticalRatio = calculateVerticalRatio(oldExtremums.max, height);
      const newVerticalRatio = calculateVerticalRatio(newExtremums.max, height);
      deltas[canvasType] = newVerticalRatio - oldVerticalRatio;
    }
    return deltas;
  }

  _animateCharts(deltas) {
    const steps = {};

    for (let canvasType of chartTypesList) {
      steps[canvasType] = deltas[canvasType] / 16;
      this._transitions[canvasType].yRatioModifer = -deltas[canvasType];
    }

    return () => {
      console.log("animate");

      for (let canvasType of chartTypesList) {
        const record = this._transitions[canvasType];
        const yModifer = record.yRatioModifer;

        if (
          (yModifer >= 0 && deltas[canvasType] > 0) ||
          (yModifer <= 0 && deltas[canvasType] < 0) ||
          steps[canvasType] === 0
        ) {
          delete this._animations["_animateCharts"];
        } else {
          record.yRatioModifer = fuzzyAdd(yModifer, steps[canvasType]);
        }
      }
    };
  }

  _hideChart(type, value) {
    return () => {
      console.log("hide");
      const record = this._transitions.opacity;
      record[type] += value ? 0.08 : -0.08;

      if ((record[type] <= 0 && !value) || (record[type] >= 1 && value)) {
        delete this._animations["_hideChart"];
        record[type] = value ? 1 : 0;
      }
    };
  }

  _animationLoop() {
    console.log("animation tick");
    this._clear(this._chart.canvas);
    this._clear(this._graph.canvas);
    this._clear(this._minimap.canvas);

    if (Object.keys(this._animations).length) {
      for (let key in this._animations) {
        this._animations[key].call(this);
      }
      this._render();
      window.requestAnimationFrame(this._animationLoop);
    } else {
      this._render();
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
