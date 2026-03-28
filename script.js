// Globals
const M = 45; // Board size

let score = 0;
let mistakes = 0;

let selected = null; // The currently selected button, if any.

const wordlist = []; // Actually, a list of (word, category) pairs
let resetHoldTimer = null;

let lastGroup = null;
let lastItem = null;

let enableSortPriority = false;

// Functions
function clearPinZone() {
  const pinZone = document.getElementById("pin-zone");
  pinZone.innerHTML = "";

  const label = document.createElement("span");
  label.className = "pin-label";
  label.textContent = "selected:";
  pinZone.appendChild(label);

  // Remove dimming from any pinned originals
  document.querySelectorAll(".pinned-original").forEach((el) => {
    el.classList.remove("pinned-original");
  });
}

function createEmptyPin() {
  const pinZone = document.getElementById("pin-zone");
  const emptyButton = document.createElement("button");
  emptyButton.className = "bigbut hidden";
  pinZone.appendChild(emptyButton);
}

function deselect() {
  if (selected) {
    selected.classList.remove("selected");
    clearPinZone();
    createEmptyPin();
    selected = null;
  }
}

function pinSelected(button) {
  const pinZone = document.getElementById("pin-zone");
  clearPinZone();

  // Create a visual clone for the pin zone
  const clone = button.cloneNode(true);
  clone.classList.add("selected");
  clone.classList.remove("pinned-original");

  // Clone click delegates to original
  clone.onclick = (e) => {
    e.stopPropagation();
    button.click();
  };

  // Add label and clone to pin zone
  // const label = document.createElement("span");
  // label.className = "pin-label";
  // label.textContent = "selected:";
  // pinZone.appendChild(label);
  pinZone.appendChild(clone);

  // Dim the original
  button.classList.add("pinned-original");
}

function wireButton(button) {
  button.addEventListener("mouseenter", () => {
    if (!button.cluster || button.cluster.length <= 1) {
      return;
    }
    if (button.hoverTimer) {
      clearTimeout(button.hoverTimer);
    }
    button.hoverTimer = setTimeout(() => {
      button.classList.add("expanded");
      const wrapper = button.closest(".cluster-item") || button.closest("td.tile-cell");
      if (wrapper) wrapper.classList.add("expanded");
    }, 500);
  });
  button.addEventListener("mouseleave", () => {
    if (button.hoverTimer) {
      clearTimeout(button.hoverTimer);
    }
    button.classList.remove("expanded");
    const wrapper = button.closest(".cluster-item") || button.closest("td.tile-cell");
    if (wrapper) wrapper.classList.remove("expanded");
  });
  button.onclick = function () {
    let didMatch = false;
    if (selected == button) {
      deselect();
      return;
    }
    button.classList.add("selected");

    if (button.closest(".cluster-item")) {
      lastGroup = button;
    }

    if (!selected) {
      selected = button;
      pinSelected(button);
      if (!button.closest(".cluster-item")) {
        lastItem = button;
      }
      return;
    }

    if (button.category == selected.category) {
      const firstbut = button;
      const secondbut = selected;

      // Deselect and clear pin zone
      clearPinZone();
      createEmptyPin();
      selected.classList.remove("selected");
      button.classList.remove("selected");
      selected = null;
      lastItem = null;
      didMatch = performMatch(firstbut, secondbut);
    } else {
      mistakes = mistakes + 1;
      document.getElementById("mistakes").textContent = mistakes;
      bumpStat("mistakes");

      // Immediately deselect and clear pin zone
      clearPinZone();
      createEmptyPin();
      selected.classList.remove("selected");
      button.classList.remove("selected");

      // Shake both
      button.classList.add("shake");
      selected.classList.add("shake");

      button.addEventListener(
        "animationend",
        () => {
          button.classList.remove("shake");
        },
        { once: true },
      );

      old_selected = selected;
      old_selected.addEventListener(
        "animationend",
        () => {
          old_selected.classList.remove("shake");
        },
        { once: true },
      );

      selected = null;
    }
    if (!didMatch) {
      saveState();
    }
    if (score >= 1980) {
      window.alert("You win!!");
      startFireworks();
    }
  };
}

function buildClusterSummary(cluster) {
  if (cluster.length == 2) {
    return `${cluster[0]}; ${cluster[1]}`;
  }
  return `<span class="cluster-count">[${cluster.length}]</span> ${cluster[0]}, ${cluster[1]}, ... `;
}

function updateButtonSearch(button) {
  const cluster = button.cluster || [];
  const text = cluster.length === 1 ? cluster[0].toLowerCase() : "";
  button.dataset.search = text;
  const wrapper = button.closest(".cluster-item");
  if (wrapper) {
    wrapper.dataset.search = text;
  }
}

function updateGlowClass(button) {
  const cluster = button.cluster || [];
  const len = cluster.length;
  button.classList.remove(
    "glow-mild",
    "glow-medium",
    "glow-strong",
    "glow-intense",
  );
  if (len >= 35) {
    button.classList.add("glow-intense");
  } else if (len >= 25) {
    button.classList.add("glow-strong");
  } else if (len >= 15) {
    button.classList.add("glow-medium");
  } else if (len >= 5) {
    button.classList.add("glow-mild");
  }
}

function setButtonLabel(button) {
  const cluster = button.cluster || [];
  if (cluster.length <= 1) {
    button.textContent = cluster[0] || "";
    button.title = "";
    updateButtonSearch(button);
    updateGlowClass(button);
    return;
  }
  const summary = buildClusterSummary(cluster);
  const full = cluster.join(", ");
  button.innerHTML = `<div class="cluster-summary">${summary}</div><div class="cluster-full">${full}</div>`;
  updateButtonSearch(button);
  updateGlowClass(button);
}

function moveClusterToPriority(button) {
  if (!button || !button.cluster || button.cluster.length < 2) {
    return;
  }
  const list = document.getElementById("priority-lane");
  if (!list) {
    return;
  }
  let wrapper = button.closest(".cluster-item");
  if (!wrapper) {
    const td = button.closest("td");
    if (td) {
      td.remove();
    }

    wrapper = document.createElement("div");
    wrapper.className = "cluster-item";
    wrapper.appendChild(button);
    list.appendChild(wrapper);
  }
  list.querySelectorAll(".cluster-item.recent").forEach((item) => {
    item.classList.remove("recent");
  });
  wrapper.classList.add("recent");
  //wrapper.scrollIntoView({ behavior: "smooth", block: "nearest" });
  if (enableSortPriority) {
    sortPriorityLane();
  }
  updateButtonSearch(button);
}

function removeButton(button) {
  if (!button) {
    return;
  }
  const wrapper = button.closest(".cluster-item");
  if (wrapper) {
    wrapper.remove();
    return;
  }
  const td = button.closest("td");
  if (td) {
    td.remove();
  }
}

function createClusterButton(category, cluster) {
  const button = document.createElement("button");
  button.className = "bigbut";
  button.category = category;
  button.cluster = cluster;
  setButtonLabel(button);
  wireButton(button);
  return button;
}

function bumpStat(id) {
  const el = document.getElementById(id);
  if (!el) {
    return;
  }
  el.classList.remove("score-pop");
  void el.offsetWidth;
  el.classList.add("score-pop");
}

function clearSearch() {
  const input = document.getElementById("filter-input");
  if (!input) {
    return;
  }
  input.value = "";
}

function sortPriorityLane() {
  const list = document.getElementById("priority-lane");
  if (!list) {
    return;
  }
  const items = Array.from(list.children);
  if (items.length <= 1) {
    return;
  }
  const firstRects = new Map(
    items.map((item) => [item, item.getBoundingClientRect()]),
  );
  const sorted = items.slice().sort((a, b) => {
    const aBtn = a.querySelector("button.bigbut");
    const bBtn = b.querySelector("button.bigbut");
    const aLen = aBtn && aBtn.cluster ? aBtn.cluster.length : 0;
    const bLen = bBtn && bBtn.cluster ? bBtn.cluster.length : 0;
    if (bLen !== aLen) {
      return bLen - aLen;
    }
    return items.indexOf(a) - items.indexOf(b);
  });
  sorted.forEach((item) => list.appendChild(item));
  sorted.forEach((item) => {
    const first = firstRects.get(item);
    const last = item.getBoundingClientRect();
    if (!first) {
      return;
    }
    const dx = first.left - last.left;
    const dy = first.top - last.top;
    if (dx || dy) {
      item.animate(
        [
          { transform: `translate(${dx}px, ${dy}px)` },
          { transform: "translate(0, 0)" },
        ],
        {
          duration: 180,
          easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
        },
      );
    }
  });
}

function performMatch(firstbut, secondbut) {
  if (!firstbut || !secondbut) {
    return false;
  }
  if (!firstbut.category || !secondbut.category) {
    return false;
  }
  if (firstbut.category !== secondbut.category) {
    return false;
  }
  score = score + 1;
  firstbut.cluster = firstbut.cluster.concat(secondbut.cluster);
  setButtonLabel(firstbut);
  firstbut.classList.add("match-burst");
  firstbut.addEventListener(
    "animationend",
    () => {
      firstbut.classList.remove("match-burst");
    },
    { once: true },
  );
  if (firstbut.cluster.length == 45) {
    finishCategory(firstbut);
	lastGroup = null;
  } else {
    moveClusterToPriority(firstbut);
    lastGroup = firstbut;
    clearSearch();
    applyFilter();
  }
  document.getElementById("score").textContent = score;
  bumpStat("score");
  removeButton(secondbut);
  saveState();
  return true;
}

function shuffleBoard() {
  const table = document.getElementById("the_table");
  if (!table) {
    return;
  }
  const cells = [];
  const buttons = [];
  for (let i = 0, row; (row = table.rows[i]); i++) {
    for (let j = 0, col; (col = row.cells[j]); j++) {
      const button = col.firstElementChild;
      if (!button) {
        continue;
      }
      cells.push(col);
      buttons.push(button);
    }
  }
  if (buttons.length === 0) {
    return;
  }
  shuffleArray(buttons);
  for (let i = 0; i < cells.length; i++) {
    cells[i].innerHTML = "";
    cells[i].appendChild(buttons[i]);
  }
  const boardWrapper = document.getElementById("board-wrapper");
  if (boardWrapper) {
    boardWrapper.classList.remove("shuffle-flash");
    void boardWrapper.offsetWidth;
    boardWrapper.classList.add("shuffle-flash");
  }
  applyFilter();
  saveState();
}

function resetGame() {
  localStorage.clear();
  score = 0;
  mistakes = 0;
  selected = null;
  lastGroup = null;
  clearPinZone();
  createEmptyPin();
  document.getElementById("score").textContent = score;
  document.getElementById("mistakes").textContent = mistakes;
  const input = document.getElementById("filter-input");
  input.value = "";
  input.blur();
  const matchedList = document.getElementById("priority-lane");
  matchedList.innerHTML = "";
  const board = document.getElementById("board");
  board.innerHTML = "";
  setUpBoard();
  putWordsInBoard();
  saveState();
  applyFilter();
  const boardWrapper = document.getElementById("board-wrapper");
  if (boardWrapper) {
    boardWrapper.classList.remove("shuffle-flash");
    void boardWrapper.offsetWidth;
    boardWrapper.classList.add("shuffle-flash");
  }
}

function showResetIndicator(state) {
  const indicator = document.getElementById("reset-indicator");
  const label = document.getElementById("reset-label");
  if (!indicator) {
    return;
  }
  if (label) {
    if (state === "done") {
      label.textContent = "reset complete!";
    } else if (state === "hold") {
      label.textContent = "hold to reset";
    } else {
      label.textContent = "hold to reset";
    }
  }
  indicator.classList.toggle("active", state === "hold" || state === "done");
  indicator.classList.toggle("holding", state === "hold");
  indicator.classList.toggle("done", state === "done");
  if (state === "done") {
    setTimeout(() => {
      indicator.classList.remove("active", "holding", "done");
    }, 700);
  }
  if (state === "cancel") {
    indicator.classList.remove("active", "holding", "done");
  }
}

function shouldIgnoreHotkeys(target) {
  if (!target) {
    return false;
  }
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable
  );
}

function stringToLightColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  const h = Math.abs(hash) % 360;
  const s = 70;
  const l = 80 + (Math.abs(hash) % 10);

  const lDev = l / 100;
  const a = (s * Math.min(lDev, 1 - lDev)) / 100;

  const f = (n) => {
    const k = (n + h / 30) % 12;
    const color = lDev - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };

  return `#${f(0)}${f(8)}${f(4)}`;
}

function getRandomHexColor() {
  return "#" + Math.floor(Math.random() * 16777215).toString(16);
}

function finishCategory(b) {
  b.innerHTML = "<b>" + b.category + "</b>";
  b.disabled = true;
  b.classList.add("completed");
  b.style.background = stringToLightColor(b.category);
  moveClusterToPriority(b);
  clearSearch();
  applyFilter();
}

function checkCategories() {
  const wordDict = new Map();
  // Check that each category has 45 entries.
  for (const [key, value] of Object.entries(cats)) {
    if (value.length < 45) {
      alert(`Entry for ${key} has length ${value.length}`);
    }
    for (let i = 0; i < 45; i++) {
      wordlist.push([value[i], key]);
      if (wordDict.has(value[i])) {
        alert(`Duplicate word ${value[i]}`);
      } else {
        wordDict.set(value[i], true);
      }
    }
  }
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function saveState() {
  localStorage.clear();

  localStorage.setItem("hasState", "1");
  localStorage.setItem("score", score + "");
  localStorage.setItem("mistakes", mistakes + "");
  const panelButtons = Array.from(
    document.querySelectorAll("#priority-lane button.bigbut"),
  );
  const panelClusters = panelButtons
    .filter((button) => button && button.category && button.cluster)
    .map((button) => ({
      category: button.category,
      cluster: button.cluster,
    }));
  localStorage.setItem("panelClusters", JSON.stringify(panelClusters));

  var t = document.getElementById("the_table");
  for (let i = 0; i < t.rows.length; i++) {
    let row = t.rows[i];
    for (let j = 0; j < row.cells.length; j++) {
      let cell = row.cells[j];
      let button = cell.firstChild;
      if (!button || !button.category || !button.cluster) {
        continue;
      }
      localStorage.setItem(`${i}_${j}_category`, button.category);
      localStorage.setItem(`${i}_${j}_cluster`, JSON.stringify(button.cluster));
      localStorage.setItem(`${i}_${j}_innerHTML`, button.innerHTML);
      localStorage.setItem(`${i}_${j}_title`, button.title);
    }
  }
}

function putWordsInBoard() {
  shuffleArray(wordlist);
  document.getElementById("priority-lane").innerHTML = "";
  var currentWordIndex = 0;
  var table = document.getElementById("the_table");
  for (let i = 0, row; (row = table.rows[i]); i++) {
    for (let j = 0, col; (col = row.cells[j]); j++) {
      var button = col.firstElementChild;
      // button.pos = currentWordIndex;
      button.textContent = wordlist[currentWordIndex][0];
      button.category = wordlist[currentWordIndex][1];
      button.cluster = [button.textContent];
      setButtonLabel(button);
      currentWordIndex += 1;
    }
  }
  applyFilter();
}

function applyFilter() {
  const input = document.getElementById("filter-input");
  const query = input.value.trim().toLowerCase();
  const table = document.getElementById("the_table");
  if (table) {
    for (let i = 0, row; (row = table.rows[i]); i++) {
      for (let j = 0, col; (col = row.cells[j]); j++) {
        const button = col.firstElementChild;
        if (!button || button.textContent === "") {
          col.classList.remove("is-hidden");
          continue;
        }
        if (query === "") {
          col.classList.remove("is-hidden");
          continue;
        }
        const hay = button.dataset.search || "";
        col.classList.toggle("is-hidden", !hay.includes(query));
      }
    }
  }

  const priorityLane = document.getElementById("priority-lane");
  if (priorityLane) {
    const items = priorityLane.querySelectorAll(".cluster-item");
    items.forEach((item) => {
      if (query === "") {
        item.classList.remove("is-hidden");
        return;
      }
      const hay = item.dataset.search || "";
      item.classList.toggle("is-hidden", !hay.includes(query));
    });
  }
}

function startFireworks() {
  const canvas = document.getElementById("fireworks");
  const ctx = canvas.getContext("2d");
  let w, h;
  let particles = [];
  let fireworks = [];

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  window.addEventListener("resize", resize);
  resize();

  class Firework {
    constructor() {
      this.x = Math.random() * w;
      this.y = h;
      this.tx = Math.random() * w;
      this.ty = Math.random() * (h / 2);
      this.color = `hsl(${Math.random() * 360}, 100%, 50%)`;
      this.speed = 2 + Math.random() * 2;
      this.angle = Math.atan2(this.ty - this.y, this.tx - this.x);
      this.vx = Math.cos(this.angle) * this.speed;
      this.vy = Math.sin(this.angle) * this.speed;
      this.exploded = false;
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;
      if (this.vy < 0 && this.y < this.ty) {
        this.explode();
      } else if (this.vy > 0 && this.y > this.ty) {
        // Should technically not happen with simple upward movement
        this.explode();
      }
    }

    explode() {
      this.exploded = true;
      for (let i = 0; i < 50; i++) {
        particles.push(new Particle(this.x, this.y, this.color));
      }
    }

    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.fill();
    }
  }

  class Particle {
    constructor(x, y, color) {
      this.x = x;
      this.y = y;
      this.color = color;
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.alpha = 1;
      this.decay = Math.random() * 0.015 + 0.005;
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.vy += 0.05; // gravity
      this.alpha -= this.decay;
    }

    draw() {
      ctx.save();
      ctx.globalAlpha = this.alpha;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.fill();
      ctx.restore();
    }
  }

  function loop() {
    // Clear with a trail effect
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "lighter";

    // Launch new firework randomly
    if (Math.random() < 0.05) {
      fireworks.push(new Firework());
    }

    // Update and draw fireworks
    for (let i = fireworks.length - 1; i >= 0; i--) {
      fireworks[i].update();
      fireworks[i].draw();
      if (fireworks[i].exploded) {
        fireworks.splice(i, 1);
      }
    }

    // Update and draw particles
    for (let i = particles.length - 1; i >= 0; i--) {
      particles[i].update();
      particles[i].draw();
      if (particles[i].alpha <= 0) {
        particles.splice(i, 1);
      }
    }

    requestAnimationFrame(loop);
  }

  loop();
}

function setUpBoard() {
  // Just sets up the dom elements; does not put words in them.
  var b = document.getElementById("board");
  const table = document.createElement("table");
  table.id = "the_table";
  for (let i = 0; i < M; i++) {
    const tr = document.createElement("tr");
    tr.classList.add(".row");
    for (let j = 0; j < M; j++) {
      const td = document.createElement("td");
      td.className = "tile-cell";
      const button = document.createElement("button");
      button.className = "bigbut";
      wireButton(button);
      td.appendChild(button);
      tr.appendChild(td);
    }
    table.appendChild(tr);
  }

  document.getElementById("board").appendChild(table);
}

function loadState() {
  const hasState = localStorage.getItem("hasState");
  if (!hasState) {
    putWordsInBoard();
    return;
  }
  score = Number(localStorage.getItem("score") || 0);
  document.getElementById("score").textContent = score;

  mistakes = Number(localStorage.getItem("mistakes") || 0);
  document.getElementById("mistakes").textContent = mistakes;

  const matchedList = document.getElementById("priority-lane");
  matchedList.innerHTML = "";
  const storedPanel = localStorage.getItem("panelClusters");
  if (storedPanel) {
    try {
      const parsed = JSON.parse(storedPanel) || [];
      parsed.forEach((block) => {
        if (!block || !block.category || !Array.isArray(block.cluster)) {
          return;
        }
        const button = createClusterButton(block.category, block.cluster);
        if (block.cluster.length == 45) {
		  button.innerHTML = "<b>" + button.category + "</b>";
          button.disabled = true;
          button.classList.add("completed");
          button.style.background = stringToLightColor(block.category);
        }
        const wrapper = document.createElement("div");
        wrapper.className = "cluster-item";
        wrapper.appendChild(button);
        matchedList.appendChild(wrapper);
        updateButtonSearch(button);
      });
    } catch (e) {
      matchedList.innerHTML = "";
    }
  }

  var table = document.getElementById("the_table");
  var cells_to_remove = [];
  var panel_moves = [];
  for (let i = 0, row; (row = table.rows[i]); i++) {
    for (let j = 0, col; (col = row.cells[j]); j++) {
      var button = col.firstElementChild;
      // button.pos = currentWordIndex;
      const storedCluster = localStorage.getItem(`${i}_${j}_cluster`);
      if (storedCluster == null) {
        cells_to_remove.push(col);
        continue;
      }
      button.category = localStorage.getItem(`${i}_${j}_category`);
      button.cluster = JSON.parse(storedCluster);
      if (!button.category || !Array.isArray(button.cluster)) {
        cells_to_remove.push(col);
        continue;
      }
      setButtonLabel(button);
      if (button.cluster.length > 1) {
        panel_moves.push(button);
      }
    }
  }
  for (let i = 0; i < cells_to_remove.length; i++) {
    cells_to_remove[i].remove();
  }
  for (let i = 0; i < panel_moves.length; i++) {
    moveClusterToPriority(panel_moves[i]);
  }
  if (enableSortPriority) {
    sortPriorityLane();
  }
}

checkCategories();
setUpBoard();
loadState();
document.getElementById("filter-input").addEventListener("input", applyFilter);
applyFilter();

// Buttons and Keyboard Shortcuts
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    clearSearch(event);
    return;
  }
  if (event.key === "Home") {
    scrollToTop(event);
    return;
  }
  if (shouldIgnoreHotkeys(event.target)) {
    return;
  }
  if (event.key === "/") {
    focusSearch(event);
    return;
  }
  if (event.key === "1") {
    selectLastGroup(event);
    return;
  }
  if (event.key === "2") {
    selectLastItem(event);
    return;
  }
  if (event.key === "s" || event.key === "S") {
    shuffleBoard();
    return;
  }
  if (event.key === "r" || event.key === "R") {
    holdReset(event);
    return;
  }
});

document.addEventListener("keyup", (event) => {
  if (event.key === "r" || event.key === "R") {
    releaseReset();
  }
});

const resetBtn = document.getElementById("reset-btn");
resetBtn.addEventListener("mousedown", holdReset);
resetBtn.addEventListener("mouseup", releaseReset);

function holdReset(event) {
  if (resetHoldTimer || event.repeat) {
    return;
  }
  showResetIndicator("hold");
  resetHoldTimer = setTimeout(() => {
    resetHoldTimer = null;
    resetGame();
    showResetIndicator("done");
  }, 1000);
}

function releaseReset(event) {
  if (resetHoldTimer) {
    clearTimeout(resetHoldTimer);
    resetHoldTimer = null;
    showResetIndicator("cancel");
  }
}

const shuffleBtn = document.getElementById("shuffle-btn");
shuffleBtn.onclick = shuffleBoard;

const searchBtn = document.getElementById("search-btn");
searchBtn.onclick = focusSearch;

function focusSearch(event) {
  event.preventDefault();
  const input = document.getElementById("filter-input");
  input.focus();
  input.select();
}

const clearBtn = document.getElementById("clear-btn");
clearBtn.onclick = clearSearch;

function clearSearch(event) {
  deselect();
  const input = document.getElementById("filter-input");
  input.value = "";
  input.blur();
  applyFilter();
}

const scrollBtn = document.getElementById("scroll-btn");
scrollBtn.onclick = scrollToTop;

function scrollToTop(event) {
  event.preventDefault();
  const wrapper = document.getElementById("board-wrapper");
  wrapper.scrollTo(0, 0);
}

const lastGroupBtn = document.getElementById("last-group-btn");
lastGroupBtn.onclick = selectLastGroup;

function selectLastGroup(event) {
  if (lastGroup) {
    if (selected) {
      selected.classList.remove("selected");
    }
    selected = lastGroup;
    lastGroup.classList.add("selected");
    pinSelected(selected);
  }
}

const lastItemBtn = document.getElementById("last-item-btn");
lastItemBtn.onclick = selectLastItem;

function selectLastItem(event) {
  if (lastItem) {
    if (selected) {
      selected.classList.remove("selected");
    }
    selected = lastItem;
    lastItem.classList.add("selected");
    pinSelected(selected);
  }
}

const toggleSortBtn = document.getElementById("toggle-sort-btn");
toggleSortBtn.onclick = () => {
  enableSortPriority = !enableSortPriority;
  if (enableSortPriority) {
    sortPriorityLane();
  }
}
