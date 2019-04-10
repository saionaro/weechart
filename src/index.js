"use strict";

var _this = void 0;

var DATA_ENDPOINT = "./chart_data.json";
var HIDDEN_CLASS = "visually-hidden";
var DATA_TYPE_LINE = "line";
var ACTIVE_ARROW_CLASS = "chart__minimap-dragger-arrow--active";
var LINES_COUNT = 6;
var SCALE_RATE = 1;
var MINIMAP_HEIGHT = 50;
var MINIMAL_DRAG_WIDTH = 40;
var ANIMATION_STEPS = 16;
var DATES_PLACE = 65;
var DATE_MARGIN = 32;
var HEX_REGEX = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i;

var PIXEL_RATIO = (function() {
  var ctx = document.createElement("canvas").getContext("2d");
  var dpr = devicePixelRatio || 1;
  var bsr =
    ctx.webkitBackingStorePixelRatio ||
    ctx.mozBackingStorePixelRatio ||
    ctx.msBackingStorePixelRatio ||
    ctx.oBackingStorePixelRatio ||
    ctx.backingStorePixelRatio ||
    1;
  return dpr / bsr;
})();

var shortcuts = {
  months: "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" "),
  weekdays: "Sun Mon Tue Wed Thu Fri Sat".split(" ")
};
var appElement;
var listenerOpts = { passive: true };
var _$TelegramCharts = {
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
    var mouseupConsumers = _$TelegramCharts.mouseupConsumers;

    for (var i = 0; i < mouseupConsumers.length; i++) {
      mouseupConsumers[i](event);
    }
  },
  onTouchMove: function(event) {
    var touchmoveConsumers = _$TelegramCharts.touchmoveConsumers;

    for (var i = 0; i < touchmoveConsumers.length; i++) {
      touchmoveConsumers[i](event);
    }
  },
  onMouseMove: function(event) {
    var mousemoveConsumers = _$TelegramCharts.mousemoveConsumers;

    for (var i = 0; i < mousemoveConsumers.length; i++) {
      mousemoveConsumers[i](event);
    }
  },
  activateDragEvents: function() {
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

var canvasTypesEnum = {
  Minimap: "minimap",
  MinimapBackground: "minimap-background",
  Chart: "chart",
  Float: "float"
};

var chartTypesList = [canvasTypesEnum.Minimap, canvasTypesEnum.Chart];

var colors = {
  ChartSeparator: {
    day: {
      r: 235,
      g: 240,
      b: 243
    },
    night: {
      r: 39,
      g: 53,
      b: 69
    }
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
    day: {
      r: 175,
      g: 181,
      b: 187
    },
    night: {
      r: 80,
      g: 103,
      b: 121
    }
  },
  MinimapBackground: {
    day: "rgba(240, 247, 252, 0.6)",
    night: "rgba(29, 42, 57, 0.8)"
  }
};

var CheckedIcon =
  '<svg class="checked-icon" height="20" width="20" viewBox="0 0 40 40"> <polyline class="checked-icon__done" points="12,21 18,27 30,14" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" stroke="white" fill="none" /> </svg>';

function hexToRgb(hex) {
  var result = HEX_REGEX.exec(hex);
  if (!result) return null;

  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  };
}

function rgbToString(rgb, alpha) {
  if (alpha === void 0) {
    alpha = 1;
  }

  return "rgba(" + rgb.r + ", " + rgb.g + ", " + rgb.b + ", " + alpha + ")";
}

function calculateVerticalRatio(maxValue, height) {
  if (maxValue > height) {
    return height / maxValue;
  } else {
    var scaledHeight = SCALE_RATE * height;

    if (maxValue < scaledHeight) {
      return scaledHeight / maxValue;
    } else return 1;
  }
}

function getCursorXPosition(canvas, event) {
  return event.clientX - canvas.getBoundingClientRect().left;
}

function setTransform(style, value) {
  style.transform = "translateX(" + value + "px)";
}

function createHiDPICanvas(w, h) {
  var canvas = document.createElement("canvas");
  canvas.width = w * PIXEL_RATIO;
  canvas.height = h * PIXEL_RATIO;
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
  var context = canvas.getContext("2d");
  context.lineJoin = "round";
  context.setTransform(PIXEL_RATIO, 0, 0, PIXEL_RATIO, 0, 0);
  context.font = "lighter 13px Helvetica, Arial";
  return canvas;
}

function fuzzyAdd(sum, number) {
  var result = sum + number;
  if (sum > 0) return result < 0 ? 0 : result;
  return result > 0 ? 0 : result;
}

function throttle(func, ms) {
  var isThrottled = false;
  var savedArgs = null;

  return function wrapper() {
    var args = arguments;
    if (isThrottled) {
      savedArgs = args;
      return;
    }
    func.apply(_this, args);
    isThrottled = true;

    setTimeout(function() {
      isThrottled = false;

      if (savedArgs) {
        wrapper.apply(void 0, savedArgs);
        savedArgs = null;
      }
    }, ms);
  };
}

var cachedDates = {};

function toDateString(timestamp) {
  if (!cachedDates[timestamp]) {
    var date = new Date(timestamp);
    cachedDates[timestamp] =
      shortcuts.months[date.getMonth()] + " " + date.getDate();
  }

  return cachedDates[timestamp];
}

function short(number) {
  var res = number;

  if (number > 1000000) {
    return (number / 1000000).toFixed(1) + "M";
  }
  if (number > 1000) {
    return (number / 1000).toFixed(1) + "K";
  }
  return res;
}

var cachedWeekdays = {};

function toWeekday(timestamp) {
  if (!cachedWeekdays[timestamp]) {
    var date = new Date(timestamp);
    cachedWeekdays[timestamp] = "" + shortcuts.weekdays[date.getDay()];
  }

  return cachedWeekdays[timestamp];
}

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
  var dragger = document.createElement("div");
  var arrowLeft = document.createElement("div");
  var arrowRight = document.createElement("div");
  dragger.className = "chart__minimap-dragger hide-selection";
  dragger.style.height = MINIMAP_HEIGHT + "px";
  dragger.style.width = width + "px";
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
  var sections = "";

  for (var type in data.names) {
    sections +=
      '<li class="floating-window__section" style="color: ' +
      rgbToString(colors[type]) +
      '"><span class="floating-window__count ' +
      getLabelClass(type) +
      '"></span><span class="floating-window__label">' +
      data.names[type] +
      "</span></li>";
  }

  var floatingWindow = document.createElement("div");
  floatingWindow.className = "floating-window " + HIDDEN_CLASS;
  floatingWindow.innerHTML =
    '<p class="floating-window__date"></p><ul class="floating-window__sections">' +
    sections +
    "</ul>";
  return floatingWindow;
}

function getColor(color) {
  return colors[color][_$TelegramCharts.modeSwitcherData.mode];
}

function createExtremumStore() {
  return {
    prev: {
      min: 0,
      max: 0
    },
    current: {
      min: 0,
      max: 0
    }
  };
}

var Chart = (function() {
  function Chart(container, data, params) {
    var w = params.w;
    var h = params.h;
    this._data = data;
    this._lines = [];
    this._dates = null;
    var dotsCount = data.columns[0].length - 1;

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
    this._chart = createCanvasObject(canvasTypesEnum.Chart, w, h);
    this._chart.height -= DATE_MARGIN;
    this._yAxisAnimationShift = (this._chart.height / LINES_COUNT) * 3;
    this._chart.canvas.className = "chart__chart-canvas hide-selection";
    this._chart.context = this._chart.canvas.getContext("2d");
    this._float = createCanvasObject(canvasTypesEnum.Float, w, h);
    this._float.height -= DATE_MARGIN;
    this._float.canvas.className = "chart__float-canvas hide-selection";
    this._float.context = this._float.canvas.getContext("2d");
    this._minimap = createCanvasObject(
      canvasTypesEnum.Minimap,
      w,
      MINIMAP_HEIGHT
    );
    this._minimapBackground = createCanvasObject(
      canvasTypesEnum.MinimapBackground,
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
    var pixelsForDot = w / this._dataCount;
    var startScale = 1;

    if (pixelsForDot < 35) {
      startScale = 35 / pixelsForDot;

      var _dragWidth = w / startScale;

      if (_dragWidth < MINIMAL_DRAG_WIDTH) {
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

    this._transitions[canvasTypesEnum.Minimap] = {
      yRatioModifer: 0,
      xRatioModifer: 1
    };

    this._transitions[canvasTypesEnum.Chart] = {
      yRatioModifer: 0,
      xRatioModifer: startScale
    };

    for (var j = 0; j < data.columns.length; j++) {
      var column = data.columns[j];
      var type = column[0];

      if (this._data.types[type] === DATA_TYPE_LINE) {
        this._rgbColors[type] = hexToRgb(this._data.colors[type]);
        this._transitions.chartsOpacity[type] = 1;

        var _data = column.slice(1);

        if (this._overflow) {
          _data = _data.slice(-this._dataCount);
        }

        this._lines.push({
          type: column[0],
          data: _data
        });

        this._visibleCount++;
      } else {
        var dates = column.slice(1);

        if (this._overflow) {
          dates = dates.slice(-this._dataCount);
        }

        this._dates = dates;
      }
    }

    this._container = container;
    this._checkboxContainer = null;
    var dragWidth = w / startScale;
    var viewShift = w - dragWidth;
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
    var fragment = document.createDocumentFragment();
    var wrapper = document.createElement("div");
    var floatingWindow = this._state.floatingWindow;
    var drag = this._state.drag;
    var dragger = drag.dragger;
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

    for (var j = 0; j < this._lines.length; j++) {
      floatingWindow.labels[
        this._lines[j].type
      ] = floatingWindow.elem.querySelector(
        "." + getLabelClass(this._lines[j].type)
      );
    }

    setTransform(dragger.style, viewShift);
    this._transitions.xShift = viewShift / this._minimap.width;
    wrapper.className = "chart__minimap-wrapper";
    wrapper.style.width = w + "px";
    wrapper.appendChild(this._minimap.canvas);
    wrapper.appendChild(this._minimapBackground.canvas);
    wrapper.appendChild(dragger);
    fragment.appendChild(this._chart.canvas);
    fragment.appendChild(this._float.canvas);
    fragment.appendChild(this._state.floatingWindow.elem);
    fragment.appendChild(wrapper);

    this._container.appendChild(fragment);

    this._container.style.width = w + "px";
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

    var hiddenDates = this._getHiddenDates(this._dataCount, w);

    this._hiddenDates = {
      prev: hiddenDates,
      current: hiddenDates
    };

    this._findAllExtremums();
    this._render();
    this._drawMinimap();
    this._renderButtons();
  }

  Chart.prototype._floatMoveTouchAdapter = function(event) {
    var touch = event.changedTouches[0];

    this._floatMouseMove(touch);
  };

  Chart.prototype._floatMouseMove = function(event) {
    var active = this._state.drag.active;
    if (active || !this._visibleCount) return;

    var scale = this._chartXParams.scale;
    var shift = this._chartXParams.shift;
    var cursorX = getCursorXPosition(this._float.canvas, event);
    var selected = Math.round((cursorX - shift) / scale);

    this._drawFloatingLine(selected, selected * scale + shift);
  };

  Chart.prototype._drawFloatingLine = function(index, x) {
    var canvas = this._float.canvas;
    var context = this._float.context;
    var height = this._float.height;
    var width = this._float.width;
    var chartsOpacity = this._transitions.chartsOpacity;

    this._clear(canvas);

    context.beginPath();
    context.lineWidth = 1;
    context.strokeStyle = getColor("FloatingLine");
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();

    var yScale = this._getYParams(this._chart);

    var data = {
      date: 0,
      x: x,
      toLeft: width / 2 < x,
      values: {}
    };

    for (var i = 0; i < this._lines.length; i++) {
      var column = this._lines[i];

      if (chartsOpacity[column.type]) {
        var y = height - column.data[index] * yScale;
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
  };

  Chart.prototype._updateFloatingWindow = function(params) {
    var x = params.x;
    var date = params.date;
    var toLeft = params.toLeft;
    var values = params.values;
    var elem = this._state.floatingWindow.elem;
    var dateElem = this._state.floatingWindow.dateElem;
    var labels = this._state.floatingWindow.labels;
    elem.classList.remove(HIDDEN_CLASS);
    dateElem.innerHTML = toWeekday(date) + ", " + toDateString(date);

    for (var type in values) {
      labels[type].innerHTML = short(values[type]);
    }

    var shift;

    if (toLeft) {
      shift = x - elem.offsetWidth - 15;
    } else {
      shift = x + 15;
    }

    setTransform(elem.style, shift);
  };

  Chart.prototype._hideFloatingWindowLabel = function(type, hide) {
    var labels = this._state.floatingWindow.labels;
    labels[type].parentNode.classList.toggle(
      "floating-window__section--hidden",
      hide
    );
  };

  Chart.prototype._floatMouseLeave = function _floatMouseLeave() {
    var _this2 = this;

    setTimeout(function() {
      _this2._clear(_this2._float.canvas);

      _this2._state.floatingWindow.elem.classList.add(HIDDEN_CLASS);
    }, 100);
  };

  Chart.prototype._findAllExtremums = function() {
    var window = this._chartXParams.window;

    this._findExtremums(this._localExtremums, window);
    this._findExtremums(this._globalExtremums);
  };

  Chart.prototype._findExtremums = function(store, range) {
    var max = -Infinity;
    var min = Infinity;
    var from = 1;
    var to = this._dataCount;

    if (range) {
      from = range[0] + 1;
      to = range[1] + 1;
    }

    for (var j = 0; j < this._lines.length; j++) {
      var column = this._lines[j];

      if (!this._state.exclude[column.type]) {
        for (var i = from; i < to; i++) {
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
  };

  Chart.prototype._startDragTouchAdapter = function(event) {
    this._floatMouseLeave();

    this._startDrag({
      which: 1,
      target: event.target
    });
  };

  Chart.prototype._startDrag = function(event) {
    if (event.which !== 1 || !event.target) return;

    var drag = this._state.drag;
    var classList = event.target.classList;
    var className = "chart__minimap-dragger--dragging";

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
  };

  Chart.prototype._moveDragTouchAdapter = function(event) {
    var touch = event.changedTouches[0];
    var drag = this._state.drag;
    var savedX = drag.savedTouchX;
    var currentX = touch.clientX;
    var speed = 0;

    if (savedX) {
      speed = currentX - savedX;
    }

    drag.savedTouchX = currentX;
    drag.touchEventAdapterData.movementX = speed;

    this._moveDrag(drag.touchEventAdapterData);
  };

  Chart.prototype._moveDrag = function(event) {
    var movementX = event.movementX;
    var drag = this._state.drag;

    if (!drag.active || !movementX) return;

    this._forceRenderDates = true;

    if (drag.resize) {
      return this._handleResize(movementX);
    }

    var maxPadding = this._minimap.width - drag.width;
    var sum = drag.marginLeft + movementX;
    var val = sum < 0 ? 0 : sum > maxPadding ? maxPadding : sum;
    setTransform(drag.dragger.style, val);
    drag.marginLeft = val;
    this._transitions.xShift = val / this._minimap.width;

    this._storeXParams(this._chartXParams, this._chart);
    this._checkYScaleChange();
  };

  Chart.prototype._handleResize = function(delta) {
    var drag = this._state.drag;

    if (drag.leftArrow) {
      if (
        drag.width - delta < MINIMAL_DRAG_WIDTH ||
        drag.marginLeft + delta < 0
      ) {
        return;
      }

      var newVal = drag.marginLeft + delta;
      var newShift = newVal / this._minimap.width;
      drag.marginLeft = newVal;
      setTransform(drag.dragger.style, newVal);
      this._transitions.xShift = newShift;
      return this._changeDragWidth(-delta);
    }

    var maxPadding = this._minimap.width - drag.width;

    if (
      drag.width + delta < MINIMAL_DRAG_WIDTH ||
      drag.marginLeft + delta > maxPadding
    ) {
      return;
    }

    this._changeDragWidth(delta);
  };

  Chart.prototype._changeDragWidth = function(delta) {
    var record = this._transitions[canvasTypesEnum.Chart];
    var drag = this._state.drag;
    var changedWidth = drag.width + delta;
    var deltaRatio = drag.width / changedWidth;
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
  };

  Chart.prototype._checkHiddenDatesChange = function() {
    var dates = this._hiddenDates;
    var hiddenDates = this._getHiddenDates(this._dataCount, this._chart.width);

    if (hiddenDates._$count !== dates.current._$count) {
      dates.prev = dates.current;
      dates.current = hiddenDates;

      this._pushAnimation(
        this._animateDates(dates.prev._$count < dates.current._$count)
      );
    }
  };

  Chart.prototype._checkYScaleChange = function() {
    var extrPrev = this._localExtremums.prev;
    var extrCurr = this._localExtremums.current;

    this._findAllExtremums();

    if (extrPrev.max !== extrCurr.max) {
      this._pushAnimation(this._animateVertical(this._findYDeltas()));
      this._pushAnimation(this._animateYAxis(extrPrev.max < extrCurr.max));
    }
  };

  Chart.prototype._endDrag = function() {
    var drag = this._state.drag;
    drag.active = false;
    drag.leftArrow = false;
    drag.resize = false;
    drag.savedTouchX = 0;
    drag.dragger.classList.remove("chart__minimap-dragger--resizing");
    drag.dragger.classList.remove("chart__minimap-dragger--dragging");
    drag.leftElem.classList.remove(ACTIVE_ARROW_CLASS);
    drag.rightElem.classList.remove(ACTIVE_ARROW_CLASS);
  };

  Chart.prototype._shouldRenderMinimap = function() {
    var opacityInProcess = false;

    for (var i = 0; i < this._lines.length; i++) {
      var column = this._lines[i];
      var val = this._transitions.chartsOpacity[column.type];

      if (val > 0 && val < 1) {
        opacityInProcess = true;
        break;
      }
    }

    return (
      opacityInProcess ||
      !!this._transitions[canvasTypesEnum.Minimap].yRatioModifer ||
      this._minimapCleaned
    );
  };

  Chart.prototype._shouldRenderDates = function() {
    if (this._transitions.datesOpacity !== 1) {
      return true;
    }

    return this._forceRenderDates || this._datesCleaned;
  };

  Chart.prototype._cleanUp = function() {
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
  };

  Chart.prototype._clearChart = function() {
    this._chart.context.clearRect(0, 0, this._chart.width, this._chart.height);
  };

  Chart.prototype._clearDates = function() {
    this._chart.context.clearRect(
      0,
      this._chart.height,
      this._chart.width,
      this._chart.height + DATE_MARGIN
    );
  };

  Chart.prototype._clear = function(canvas) {
    var context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
  };

  Chart.prototype._render = function() {
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
  };

  Chart.prototype._drawChart = function() {
    this._chart.context.lineWidth = 1;
    this._renderLines(this._chart);
    this._chart.context.lineWidth = 2.5;
    this._renderChart(this._chart, this._chartXParams);
    this._renderYValues();
  };

  Chart.prototype._drawMinimap = function() {
    this._renderChart(this._minimap, this._minimapXParams);
  };

  Chart.prototype._drawMinimapBackground = function() {
    var context = this._minimapBackground.context;
    var drag = this._state.drag;
    context.fillStyle = getColor("MinimapBackground");
    context.fillRect(0, 0, drag.marginLeft + 8, this._minimapBackground.height);
    context.fillRect(
      drag.marginLeft + drag.width - 8,
      0,
      this._minimapBackground.width,
      this._minimapBackground.height
    );
  };

  Chart.prototype._renderLines = function(chart) {
    var context = chart.context;
    var width = chart.width;
    var height = chart.height;
    var current = this._localExtremums.current;
    var yAxis = this._transitions.yAxis;
    var stepSize = height / LINES_COUNT;
    var color = getColor("ChartSeparator");

    context.beginPath();

    if (current.max !== -Infinity) {
      for (var i = 1; i < LINES_COUNT; i++) {
        var shift = height - i * stepSize;
        var y = shift + yAxis.shift;

        if (y <= height) {
          context.strokeStyle = rgbToString(color, yAxis.opacity);
          context.moveTo(0, y);
          context.lineTo(width, y);
        }

        if (yAxis.opacity < 1) {
          context.strokeStyle = rgbToString(color, 1 - yAxis.opacity);
          var yCoord = y + this._yAxisAnimationShift * (yAxis.toDown ? 1 : -1);

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
  };

  Chart.prototype._renderDates = function() {
    var context = this._chart.context;
    var height = this._chart.height;
    var scale = this._chartXParams.scale;
    var shift = this._chartXParams.shift;
    var window = this._chartXParams.window;
    var hiddenDates = this._hiddenDates;
    var datesOpacity = this._transitions.datesOpacity;

    for (var i = window[0]; i < window[1]; i++) {
      var x = i * scale + shift;
      var isLast = i === this._dataCount - 1;
      var hide = hiddenDates.current[i] && !hiddenDates.prev[i];
      var show = !hiddenDates.current[i] && hiddenDates.prev[i];
      var isTransition = show || hide;
      var opacity = 1;
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
  };

  Chart.prototype._renderYValues = function() {
    var context = this._chart.context;
    var height = this._chart.height;
    var current = this._localExtremums.current;
    var prev = this._localExtremums.prev;
    var yAxis = this._transitions.yAxis;
    var stepSize = height / LINES_COUNT;
    var color = getColor("ChartText");
    var maxHeight = height - 6;

    context.lineWidth = 1;

    if (current.max !== -Infinity) {
      context.textAlign = "left";

      for (var i = 1; i < LINES_COUNT; i++) {
        var yShift = maxHeight - i * stepSize;
        var y = yShift + yAxis.shift;
        var part = i / LINES_COUNT;

        if (y < maxHeight) {
          context.fillStyle = rgbToString(color, yAxis.opacity);
          context.fillText(short(Math.round(current.max * part)), 0, y);
        }

        if (yAxis.opacity < 1) {
          var yCoord = y + this._yAxisAnimationShift * (yAxis.toDown ? 1 : -1);

          if (yCoord < maxHeight) {
            context.fillStyle = rgbToString(color, 1 - yAxis.opacity);
            context.fillText(short(Math.round(prev.max * part)), 0, yCoord);
          }
        }
      }

      context.fillStyle = rgbToString(color, 1);
      context.fillText(0, 0, maxHeight);
    }
  };

  Chart.prototype._storeXParams = function(store, data) {
    var type = data.type;
    var xShift = this._transitions.xShift;
    var record = this._transitions[type];
    var count = this._dataCount;
    var countM1 = count - 1;
    var scale = (data.width / countM1) * record.xRatioModifer;

    store.scale = scale;
    store.shift = -(countM1 * scale * xShift);
    store.window[0] = 0;
    store.window[1] = count;

    if (type === canvasTypesEnum.Chart) {
      var start = Math.round(-store.shift / store.scale) - 1;
      var end = Math.round((data.width - store.shift) / store.scale) + 2;
      store.window[0] = start < 0 ? 0 : start;
      store.window[1] = end > count ? count : end;
    }
  };

  Chart.prototype._getYParams = function(data) {
    var usedExtremums =
      data.type === canvasTypesEnum.Chart
        ? this._localExtremums
        : this._globalExtremums;
    return (
      calculateVerticalRatio(usedExtremums.current.max, data.height) +
      this._transitions[data.type].yRatioModifer
    );
  };

  Chart.prototype._getHiddenDates = function(total, width) {
    var window = this._chartXParams.window;
    var toHide = {};
    var count = window[1] - window[0];
    var iter = 1;
    var hiddenCount = 0;

    while (count * DATES_PLACE > width) {
      for (var i = total - 1 - iter; i >= 0; i -= 2 * iter) {
        if (!toHide[i]) {
          hiddenCount++;
        }
        toHide[i] = true;
      }

      var localCount = 0;

      for (var i = window[0]; i < window[1]; i++) {
        localCount += toHide[i] ? 0 : 1;
      }

      count = localCount;
      iter++;
    }

    toHide._$count = hiddenCount;
    return toHide;
  };

  Chart.prototype._renderChart = function(params, data) {
    var context = params.context;
    var chartsOpacity = this._transitions.chartsOpacity;
    var isChart = params.type === canvasTypesEnum.Chart;
    var yScale = this._getYParams(params);

    for (var j = 0; j < this._lines.length; j++) {
      var column = this._lines[j];
      var type = column.type;
      var opacity = chartsOpacity[type];

      if (opacity !== 0) {
        context.beginPath();
        context.strokeStyle = rgbToString(this._rgbColors[type], opacity);

        for (var i = data.window[0]; i < data.window[1]; i++) {
          var x = i * data.scale + (isChart ? data.shift : 0);
          var y = params.height - column.data[i] * yScale;
          context.lineTo(x, y);
        }

        context.stroke();
      }
    }
  };

  Chart.prototype._renderButtons = function() {
    var items = "";
    var data = this._data;
    var container = this._container;

    for (var i = 0; i < this._lines.length; i++) {
      var column = this._lines[i];
      var type = column.type;
      var color = rgbToString(this._rgbColors[type]);

      items +=
        '<li class="charts-selector__item hide-selection"><label class="checkbox" style="color: ' +
        color +
        "; border-color: " +
        color +
        '"><input type="checkbox" class="checkbox__input ' +
        HIDDEN_CLASS +
        '" name="' +
        type +
        '" checked><div class="checkbox__wrapper" style="background-color:' +
        color +
        '">' +
        CheckedIcon +
        '<span class="checkbox__title">' +
        data.names[type] +
        "</span></div></label></li>";
    }

    var tempContainer = document.createElement("div");
    tempContainer.innerHTML = '<ul class="charts-selector">' + items + "</ul>";
    this._checkboxContainer = tempContainer.children[0];

    this._checkboxContainer.addEventListener(
      "change",
      this._onChangeCheckbox,
      listenerOpts
    );

    container.appendChild(this._checkboxContainer);
  };

  Chart.prototype._onChangeCheckbox = function(event) {
    var target = event.target;
    var extremums = this._localExtremums;
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
  };

  Chart.prototype._pushAnimation = function(animation) {
    if (!this._animations[animation.tag]) {
      this._activeAnimations++;
    }

    this._animations[animation.tag] = animation.hook;
  };

  Chart.prototype._findYDeltas = function() {
    var glob = this._globalExtremums;
    var local = this._localExtremums;
    var deltas = {};

    for (
      var i = 0, _chartTypesList = chartTypesList;
      i < _chartTypesList.length;
      i++
    ) {
      var canvasType = _chartTypesList[i];
      var height = this["_" + canvasType].height;
      var isChart = canvasType === canvasTypesEnum.Chart;
      var extrOld = isChart ? local.prev : glob.prev;
      var extrNew = isChart ? local.current : glob.current;
      deltas[canvasType] =
        calculateVerticalRatio(extrNew.max, height) -
        calculateVerticalRatio(extrOld.max, height);
    }

    return deltas;
  };

  Chart.prototype._animateVertical = function(deltas) {
    var _this3 = this;

    var tag = "_animateVertical";
    var steps = {};

    for (
      var i = 0, _chartTypesList2 = chartTypesList;
      i < _chartTypesList2.length;
      i++
    ) {
      var canvasType = _chartTypesList2[i];
      steps[canvasType] = deltas[canvasType] / ANIMATION_STEPS;
      this._transitions[canvasType].yRatioModifer = -deltas[canvasType];
    }

    return {
      hook: function hook() {
        var finishedAnimations = 0;

        for (
          var i = 0, _chartTypesList3 = chartTypesList;
          i < _chartTypesList3.length;
          i++
        ) {
          var canvasType = _chartTypesList3[i];
          var record = _this3._transitions[canvasType];
          var yModifer = record.yRatioModifer;

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
          delete _this3._animations[tag];
          _this3._activeAnimations--;
        }
      },
      tag: tag
    };
  };

  Chart.prototype._animateHorisontal = function(oldVal, newVal) {
    var _this4 = this;

    var tag = "_animateHorisontal";
    var step = (newVal - oldVal) / ANIMATION_STEPS;
    var record = this._transitions[canvasTypesEnum.Chart];
    record.xRatioModifer = newVal;

    return {
      hook: function hook() {
        record.xRatioModifer += step;

        if (
          (step < 0 && record.xRatioModifer <= newVal) ||
          (step > 0 && record.xRatioModifer >= newVal) ||
          step === 0
        ) {
          record.xRatioModifer = newVal;
          delete _this4._animations[tag];
          _this4._activeAnimations--;
        }
      },
      tag: tag
    };
  };

  Chart.prototype._animateHideChart = function(type, value) {
    var _this5 = this;
    var tag = "_animateHideChart";

    return {
      hook: function hook() {
        var record = _this5._transitions.chartsOpacity;
        record[type] += value ? 0.08 : -0.08;

        if ((record[type] <= 0 && !value) || (record[type] >= 1 && value)) {
          record[type] = value ? 1 : 0;
          delete _this5._animations[tag];
          _this5._activeAnimations--;
        }
      },
      tag: tag
    };
  };

  Chart.prototype._animateDates = function(hide) {
    var _this6 = this;

    var tag = "_animateHideChart";
    var record = this._transitions;
    record.datesOpacity = hide ? 1 : 0;

    return {
      hook: function hook() {
        record.datesOpacity += hide ? -0.06 : 0.06;

        if (
          (record.datesOpacity <= 0 && hide) ||
          (record.datesOpacity >= 1 && !hide)
        ) {
          record.datesOpacity = hide ? 0 : 1;
          delete _this6._animations[tag];
          _this6._activeAnimations--;
        }
      },
      tag: tag
    };
  };

  Chart.prototype._animateYAxis = function(toDown) {
    var _this7 = this;
    var tag = "_animateYAxis";
    var yAxis = this._transitions.yAxis;
    yAxis.toDown = toDown;
    yAxis.opacity = 0;
    yAxis.shift = this._yAxisAnimationShift * (toDown ? -1 : 1);

    return {
      hook: function hook() {
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
          delete _this7._animations[tag];
          _this7._activeAnimations--;
        }
      },
      tag: tag
    };
  };

  Chart.prototype._animationLoop = function() {
    this._cleanUp();

    if (this._activeAnimations || this._state.drag.active) {
      for (var key in this._animations) {
        this._animations[key]();
      }

      this._render();

      requestAnimationFrame(this._animationLoop);
    } else {
      this._render();
    }
  };

  return Chart;
})();

function onFetchData(data) {
  var fragment = document.createDocumentFragment();
  var w = document.documentElement.clientWidth * 0.8;
  var h = 350;

  w = w > 350 ? 350 : w;

  for (var i = 0; i < data.length; i++) {
    var chartContainer = document.createElement("div");
    chartContainer.className = "chart";
    new Chart(chartContainer, data[i], {
      w: w,
      h: h
    });
    fragment.appendChild(chartContainer);
  }

  appElement.querySelector(".app__charts").appendChild(fragment);
  _$TelegramCharts.modeSwitcherData.element.className = "button mode-switcher";
}

function fetchData() {
  return fetch(DATA_ENDPOINT)
    .then(function(data) {
      return data.json();
    })
    .catch(console.log);
}

function switchMode() {
  var data = _$TelegramCharts.modeSwitcherData;
  var modes = _$TelegramCharts.modes;
  var isNight = data.mode === modes.Night;
  var newMode = isNight ? modes.Day : modes.Night;
  data.mode = newMode;
  data.element.innerHTML = data.captions[newMode];
  appElement.classList = isNight ? "app" : "app app--night";

  for (var i = 0; i < data.updateHooks.length; i++) {
    data.updateHooks[i]();
  }
}

function bootUp() {
  var switcherData = _$TelegramCharts.modeSwitcherData;
  appElement = document.querySelector(".app");
  fetchData().then(onFetchData);
  switcherData.element = appElement.querySelector(".mode-switcher");
  switcherData.element.addEventListener("click", switchMode, listenerOpts);
}

document.addEventListener("DOMContentLoaded", bootUp);
