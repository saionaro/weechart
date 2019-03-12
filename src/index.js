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

    this._chartCanvas = createHiDPICanvas(1000, 400);
    this._chartContext = this._chartCanvas.getContext("2d");
    this._minimapCanvas = createHiDPICanvas(1000, 50);
    this._minimapContext = this._minimapCanvas.getContext("2d");

    this._container = container;
    this._checkboxContainer = null;
    this._state = {
      exclude: {}
    };
    this._onChangeCheckbox = this._onChangeCheckbox.bind(this);

    container.appendChild(this._chartCanvas);
    container.appendChild(this._minimapCanvas);

    this._render();
    this._renderButtons();
  }

  _render() {
    const extremums = findExtremums(this._data, this._state.exclude);

    this._chartContext.lineWidth = 1;
    this._renderAdditionalInfo(this._chartCanvas, extremums);
    this._chartContext.lineWidth = 2;
    this._renderChart(this._chartCanvas, extremums);
    this._renderLabels(this._chartCanvas, extremums);

    this._minimapContext.fillStyle = colors.MinimapBackground;
    this._minimapContext.fillRect(
      0,
      0,
      this._minimapCanvas.width,
      this._minimapCanvas.height
    );
    this._renderChart(this._minimapCanvas, extremums);
  }

  _clear(canvas) {
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
  }

  _renderAdditionalInfo(canvas, extremums) {
    const context = canvas.getContext("2d");
    const scaledPixelsWidth = canvas.width / PIXEL_RATIO;
    const scaledPixelsHeight = canvas.height / PIXEL_RATIO;
    const stepSize = scaledPixelsHeight / LINES_COUNT;

    context.beginPath();
    context.strokeStyle = colors.ChartSeparator;

    for (let i = 0; i < LINES_COUNT; i++) {
      const shift = scaledPixelsHeight - i * stepSize;
      context.moveTo(0, shift);
      context.lineTo(scaledPixelsWidth, shift);
    }

    context.stroke();
    context.restore();
    context.closePath();
  }

  _renderLabels(canvas, extremums) {
    const scaledPixelsHeight = canvas.height / PIXEL_RATIO;
    const stepSize = scaledPixelsHeight / LINES_COUNT;
    const context = canvas.getContext("2d");

    context.lineWidth = 1;
    context.fillStyle = colors.ChartText;

    if (extremums.max !== -Infinity) {
      for (let i = 0; i < LINES_COUNT; i++) {
        const shift = scaledPixelsHeight - i * stepSize;

        context.fillText(
          Math.round(extremums.max * (i / LINES_COUNT)),
          0,
          shift - 6
        );
      }
    }
  }

  _renderChart(canvas, extremums) {
    const { _data: data } = this;
    const context = canvas.getContext("2d");

    const scaledPixelsWidth = canvas.width / PIXEL_RATIO;
    const scaledPixelsHeight = canvas.height / PIXEL_RATIO;

    const verticalRatio = calculateVerticalRatio(
      extremums.max,
      scaledPixelsHeight
    );
    const horisontalRatio = calculateHorisontalRatio(
      data.columns[0].length,
      scaledPixelsWidth
    );

    const lowestDot = extremums.min * verticalRatio;
    const highestDot = extremums.max * verticalRatio;
    const paddings = (scaledPixelsHeight - (highestDot - lowestDot)) / 2;
    const delta = lowestDot - paddings;

    if (VERBOSE) {
      console.log("Vertical ratio: " + verticalRatio);
      console.log("Horisontal ratio: " + horisontalRatio);
      console.log(extremums);
    }

    for (let column of data.columns) {
      const type = column[0];

      if (isLine(data.types[type]) && !this._state.exclude[type]) {
        context.strokeStyle = data.colors[type];

        context.beginPath();
        context.moveTo(
          0,
          delta + scaledPixelsHeight - column[1] * verticalRatio
        );

        for (let i = 2; i < column.length; i++) {
          context.lineTo(
            i * horisontalRatio,
            delta + scaledPixelsHeight - column[i] * verticalRatio
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
          <label class="checkbox" style="color: ${data.colors[type]}">
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

  _renderMinimap() {}

  _onChangeCheckbox(event) {
    this._state.exclude[event.target.name] = !event.target.checked;
    this._clear(this._chartCanvas);
    this._clear(this._minimapCanvas);
    this._render();
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
