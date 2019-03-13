/**
 * TODO
 * * Correct labels when padding chart
 * * Add dates labels
 * * Add window-view
 * * (!) Add animations
 */

const VERBOSE = true;

const DATA_ENDPOINT = "./chart_data.json";
const LINES_COUNT = 6;
const SCALE_RATE = 0.9;
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

const types = {
  Line: "line",
  Date: "x"
};

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

class Chart {
  constructor(container, data) {
    this._data = data;

    this._chart = {
      canvas: createHiDPICanvas(1000, 400),
      context: null,
      width: null,
      height: null
    };

    this._chart.context = this._chart.canvas.getContext("2d");
    this._chart.width = this._chart.canvas.width / PIXEL_RATIO;
    this._chart.height = this._chart.canvas.height / PIXEL_RATIO;

    this._minimap = {
      canvas: createHiDPICanvas(1000, 50),
      context: null,
      width: null,
      height: null
    };

    this._minimap.context = this._minimap.canvas.getContext("2d");
    this._minimap.width = this._minimap.canvas.width / PIXEL_RATIO;
    this._minimap.height = this._minimap.canvas.height / PIXEL_RATIO;

    this._rgbColors = {};
    this._transitions = {};
    this._animations = [];

    for (let column of data.columns) {
      const type = column[0];

      if (isLine(this._data.types[type])) {
        this._rgbColors[type] = hexToRgb(this._data.colors[type]);
        this._transitions[type] = {
          verticalRatioModifer: 0,
          oppacity: 1
        };
      }
    }

    this._container = container;
    this._checkboxContainer = null;
    this._state = {
      exclude: {}
    };
    this._onChangeCheckbox = this._onChangeCheckbox.bind(this);
    this._animationLoop = this._animationLoop.bind(this);

    container.appendChild(this._chart.canvas);
    container.appendChild(this._minimap.canvas);

    this._render();
    this._renderButtons();
  }

  _render() {
    const extremums = findExtremums(this._data, this._state.exclude);
    this._drawChart(extremums);
    this._drawMinimap(extremums);
  }

  _drawChart(extremums) {
    this._chart.context.lineWidth = 1;
    this._renderAdditionalInfo(this._chart);
    this._chart.context.lineWidth = 2;
    this._renderChart(this._chart, extremums);
    this._renderLabels(this._chart, extremums);
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

  _renderChart({ context, width, height }, extremums) {
    const { _data: data } = this;
    const verticalRatio = calculateVerticalRatio(extremums.max, height);
    const horisontalRatio = calculateHorisontalRatio(
      data.columns[0].length,
      width
    );

    // TODO paddings
    // const lowestDot = extremums.min * verticalRatio;
    // const highestDot = extremums.max * verticalRatio;
    // const paddings = (scaledPixelsHeight - (highestDot - lowestDot)) / 2;
    // const delta = 0; //lowestDot - paddings;

    if (VERBOSE) {
      console.log("Vertical ratio: " + verticalRatio);
      console.log("Horisontal ratio: " + horisontalRatio);
      console.log(extremums);
    }

    for (let column of data.columns) {
      const type = column[0];

      if (isLine(data.types[type])) {
        const verticalModifer = this._transitions[type].verticalRatioModifer;
        const verticalRatioFinal = verticalRatio + verticalModifer;

        context.strokeStyle = rgbToString(
          this._rgbColors[type],
          this._transitions[type].oppacity
        );

        context.beginPath();
        context.moveTo(0, height - column[1] * verticalRatioFinal);

        for (let i = 2; i < column.length; i++) {
          context.lineTo(
            i * horisontalRatio,
            height - column[i] * verticalRatioFinal
          );
        }

        context.stroke();
        context.restore();
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
    this._checkboxContainer.addEventListener("change", this._onChangeCheckbox);
    container.appendChild(this._checkboxContainer);
  }

  _onChangeCheckbox({ target }) {
    this._animations["_hideChart"] = this._hideChart(
      target.name,
      target.checked
    );
    const delta = this._findVerticalRatioDelta(target.name, target.checked);
    this._animations["_animateCharts"] = this._animateCharts(delta);
    this._animationLoop();
  }

  _findVerticalRatioDelta(type, value) {
    const oldExtremums = findExtremums(this._data, this._state.exclude);
    this._state.exclude[type] = !value;
    const newExtremums = findExtremums(this._data, this._state.exclude);
    const scaledPixelsHeight = this._chart.canvas.height / PIXEL_RATIO;
    const oldVerticalRatio = calculateVerticalRatio(
      oldExtremums.max,
      scaledPixelsHeight
    );
    const newVerticalRatio = calculateVerticalRatio(
      newExtremums.max,
      scaledPixelsHeight
    );
    const delta = newVerticalRatio - oldVerticalRatio;

    return delta;
  }

  _animateCharts(delta) {
    const scaleStep = delta / 33;

    for (let type in this._transitions) {
      this._transitions[type].verticalRatioModifer = -delta;
    }

    return () => {
      console.log("animate");
      for (let type in this._transitions) {
        this._transitions[type].verticalRatioModifer += scaleStep;

        if (
          (this._transitions[type].verticalRatioModifer >= 0 && delta > 0) ||
          (this._transitions[type].verticalRatioModifer <= 0 && delta < 0) ||
          scaleStep === 0
        ) {
          delete this._animations["_animateCharts"];
        }
      }
    };
  }

  _hideChart(type, value) {
    return () => {
      console.log("hide");
      const record = this._transitions[type];
      record.oppacity += value ? 0.06 : -0.06;

      if ((record.oppacity <= 0 && !value) || (record.oppacity >= 1 && value)) {
        delete this._animations["_hideChart"];
      }
    };
  }

  _animationLoop() {
    console.log("animation tick");
    if (Object.keys(this._animations).length) {
      for (let key in this._animations) {
        this._animations[key].call(this);
      }
      this._clear(this._chart.canvas);
      this._clear(this._minimap.canvas);
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

  for (let i = 0; i < data.length; i++) {
    const chartContainer = document.createElement("div");
    new Chart(chartContainer, data[i]);
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
