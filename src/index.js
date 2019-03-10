const HEIGHT = 400;
const WIDTH = 1200;
const MAX_WIDTH = 1200;
const MAX_HEIGHT = 390;

const types = {
  Line: "line",
  Date: "x"
};

let canvas;
let context2d;
let chartSet;
const target = 4;

const exclude = {};

const fetchData = () =>
  fetch("./chart_data.json")
    .then(data => data.json())
    .catch(console.log);

const findExtremums = chartData => {
  let max = -Infinity;
  let min = Infinity;

  for (let column of chartData.columns) {
    const type = column[0];

    if (chartData.types[type] === types.Line && !exclude[type]) {
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

const calculateVerticalRatio = maxValue =>
  maxValue > MAX_HEIGHT ? MAX_HEIGHT / maxValue : 1;

const calculateHorisontalRatio = count => MAX_WIDTH / count;

const clear = () => context2d.clearRect(0, 0, canvas.width, canvas.height);

const drawChart = chartData => {
  // console.log(chartData);
  context2d.lineWidth = 2;

  const extremums = findExtremums(chartData);
  const verticalRatio = calculateVerticalRatio(extremums.max);
  const horisontalRatio = calculateHorisontalRatio(chartData.columns[0].length);

  const lowestDot = extremums.min * verticalRatio;
  const highestDot = extremums.max * verticalRatio;

  const paddings = (MAX_HEIGHT - (highestDot - lowestDot)) / 2;

  const delta = lowestDot - paddings;

  // debugger;

  // const horisontalShift =

  console.log("Vertical ratio: " + verticalRatio);
  console.log("Horisontal ratio: " + horisontalRatio);

  for (let column of chartData.columns) {
    const type = column[0];

    if (chartData.types[type] === types.Line && !exclude[type]) {
      context2d.strokeStyle = chartData.colors[type];

      context2d.beginPath();
      context2d.moveTo(0, delta + HEIGHT - column[1] * verticalRatio);

      for (let i = 2; i < column.length; i++) {
        context2d.lineTo(
          i * horisontalRatio,
          delta + HEIGHT - column[i] * verticalRatio
        );
      }

      context2d.stroke();
      context2d.restore();
      context2d.closePath();
    }
  }
};

const renderButtons = chartData => {
  let items = "";

  for (let type in chartData.types) {
    if (chartData.types[type] === types.Line) {
      items += `<li class="charts-selector__item">
        <label class="checkbox">
          <input type="checkbox" class="checkbox__input visually-hidden" name="${type}" checked>
          <span class="checkbox__title">${chartData.names[type]}</span>
        </label>
      </li>`;
    }
  }

  const tempContainer = document.createElement("div");
  tempContainer.innerHTML = `<ul class="charts-selector">${items}</ul>`;

  const li = tempContainer.children[0];

  li.addEventListener("change", e => {
    exclude[e.target.name] = !e.target.checked;
    clear();
    drawChart(chartSet[target]);
  });

  document.body.appendChild(li);
};

const onFetchData = data => {
  chartSet = data;
  renderButtons(data[target]);
  drawChart(chartSet[target]);
};

const bootUp = () => {
  canvas = document.querySelector(".app__canvas");
  context2d = canvas.getContext("2d");
  fetchData().then(onFetchData);
};

document.addEventListener("DOMContentLoaded", bootUp);
