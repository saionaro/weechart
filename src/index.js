import { Chart } from "./Chart";

let appElement;

function onFetchData(data) {
  const fragment = document.createDocumentFragment();
  const h = 350;
  let w = document.documentElement.clientWidth * 0.8;

  w = w > 400 ? 400 : w;

  for (let i = 0; i < data.length; i++) {
    const chartContainer = document.createElement("div");
    chartContainer.className = "chart";
    new Chart(chartContainer, data[i], { w, h });
    fragment.appendChild(chartContainer);
  }

  appElement.querySelector(".app__charts").appendChild(fragment);
}

function fetchData(url) {
  return fetch(url)
    .then(data => data.json())
    .catch(console.log);
}

function bootUp() {
  const urls = [];

  appElement = document.querySelector(".app");

  for (let i = 1; i <= 5; i++) {
    urls.push(`./data/${i}/overview.json`);
  }

  Promise.all(urls.map(fetchData)).then(onFetchData);
}

document.addEventListener("DOMContentLoaded", bootUp);
