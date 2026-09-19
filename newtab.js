const WALLPAPERS = [
  "assets/wallpaper-1.svg",
  "assets/wallpaper-2.svg",
  "assets/wallpaper-3.svg"
];

const ENGINES = {
  google: { label: "Google", url: "https://www.google.com/search?q=" },
  duckduckgo: { label: "DuckDuckGo", url: "https://duckduckgo.com/?q=" },
  bing: { label: "Bing", url: "https://www.bing.com/search?q=" },
  youtube: { label: "YouTube", url: "https://www.youtube.com/results?search_query=" },
  brave: { label: "Brave", url: "https://search.brave.com/search?q=" }
};

const DEFAULTS = {
  name: "",
  engine: "google",
  visibility: {
    topbar: true,
    brand: true,
    controls: true,
    greeting: true,
    clock: true,
    date: true,
    search: true,
    shortcuts: true,
    focus: true,
    status: true,
    particles: true
  },
  wallpaper: 0,
  wallpaperMode: "shuffle",
  shortcuts: [
    { label: "YouTube", url: "https://www.youtube.com" },
    { label: "GitHub", url: "https://github.com" },
    { label: "Gmail", url: "https://mail.google.com" },
    { label: "Reddit", url: "https://www.reddit.com" },
    { label: "Twitter / X", url: "https://x.com" },
    { label: "Wikipedia", url: "https://www.wikipedia.org" }
  ]
};

const elements = {};
let settings = { ...DEFAULTS };
const FOCUS_LINES = [
  "Small steps still move the story forward.",
  "Make today a page worth remembering.",
  "Your next adventure starts with one click.",
  "Stay curious. Keep becoming.",
  "A calm mind makes room for great ideas."
];

function storageGet(defaults) {
  return new Promise((resolve) => chrome.storage.sync.get(defaults, resolve));
}

function localStorageGet(defaults) {
  return new Promise((resolve) => chrome.storage.local.get(defaults, resolve));
}

function chooseWallpaper() {
  const all = [...WALLPAPERS, ...(settings.customWallpapers || []).map((item) => item.url)];
  if (settings.wallpaperMode !== "shuffle") return Math.min(Number(settings.wallpaper) || 0, all.length - 1);
  return Math.floor(Math.random() * all.length);
}

function loadWallpaper() {
  const wallpaper = elements.wallpaper;
  const video = elements.liveWallpaper;
  const custom = settings.customWallpapers || [];
  const all = [...WALLPAPERS.map((url) => ({ url, type: "image" })), ...custom];
  const selected = all[chooseWallpaper()] || all[0];
  wallpaper.classList.remove("is-loaded");
  video.classList.remove("is-loaded");
  video.pause();
  video.removeAttribute("src");
  if (selected.type === "video") {
    video.src = selected.url;
    video.onloadeddata = () => video.classList.add("is-loaded");
    video.play().catch(() => {});
    return;
  }
  const path = selected.url;
  wallpaper.style.backgroundImage = `url("${path}")`;
  const image = new Image();
  image.onload = () => wallpaper.classList.add("is-loaded");
  image.src = path;
}

function refreshWallpaper() {
  if (settings.wallpaperMode === "fixed") {
    settings.wallpaperMode = "shuffle";
    loadWallpaper();
    window.setTimeout(() => {
      settings.wallpaperMode = "fixed";
      loadWallpaper();
    }, 80);
    return;
  }
  loadWallpaper();
}

function updateClock() {
  const now = new Date();
  elements.clock.textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
  elements.date.textContent = now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const hour = now.getHours();
  const period = hour < 5 ? "Good night" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : hour < 21 ? "Good evening" : "Good night";
  elements.greeting.textContent = settings.name ? `${period}, ${settings.name}` : period;
}

function getInitials(label) {
  return label.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "✦";
}

function getFaviconUrl(url) {
  try {
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(new URL(url).hostname)}&sz=64`;
  } catch {
    return "";
  }
}

function applyVisibility() {
  const visibility = { ...DEFAULTS.visibility, ...(settings.visibility || {}) };
  const selectors = {
    topbar: ".topbar",
    brand: ".brand-mark",
    controls: ".topbar-actions",
    greeting: "#greeting",
    clock: "#clock",
    date: "#date",
    search: ".search-shell",
    shortcuts: ".shortcuts-section",
    focus: ".focus-card",
    status: ".dashboard-rail",
    particles: "#particles"
  };
  Object.entries(selectors).forEach(([key, selector]) => {
    const element = document.querySelector(selector);
    if (element) element.hidden = !visibility[key];
  });
}

function renderShortcuts() {
  elements.shortcutsGrid.replaceChildren();
  const shortcuts = Array.isArray(settings.shortcuts) ? settings.shortcuts.slice(0, 8) : [];
  elements.shortcutCount.textContent = `${shortcuts.length} / 8`;
  if (!shortcuts.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Add your favorite places from settings.";
    elements.shortcutsGrid.append(empty);
    return;
  }
  shortcuts.forEach((shortcut) => {
    const link = document.createElement("a");
    link.className = "shortcut";
    link.href = shortcut.url;
    link.title = shortcut.label;
    const icon = document.createElement("span");
    icon.className = "shortcut-icon";
    icon.textContent = getInitials(shortcut.label);
    const favicon = document.createElement("img");
    favicon.className = "shortcut-favicon";
    favicon.alt = "";
    favicon.src = getFaviconUrl(shortcut.url);
    favicon.addEventListener("error", () => favicon.remove(), { once: true });
    favicon.addEventListener("load", () => icon.replaceChildren(favicon), { once: true });
    const label = document.createElement("span");
    label.className = "shortcut-label";
    label.textContent = shortcut.label;
    link.append(icon, label);
    elements.shortcutsGrid.append(link);
  });
}

function renderEngineMenu() {
  elements.engineMenu.replaceChildren();
  Object.entries(ENGINES).forEach(([key, engine]) => {
    const option = document.createElement("button");
    option.type = "button";
    option.textContent = engine.label;
    option.setAttribute("role", "menuitem");
    option.setAttribute("aria-current", key === settings.engine ? "true" : "false");
    option.addEventListener("click", () => {
      settings.engine = key;
      chrome.storage.sync.set({ engine: key });
      elements.engineLabel.textContent = engine.label;
      elements.engineMenu.hidden = true;
      renderEngineMenu();
      elements.searchInput.focus();
    });
    elements.engineMenu.append(option);
  });
  elements.engineLabel.textContent = ENGINES[settings.engine]?.label || ENGINES.google.label;
}

function setupSearch() {
  elements.searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = elements.searchInput.value.trim();
    if (!query) return;
    const engine = ENGINES[settings.engine] || ENGINES.google;
    window.location.href = engine.url + encodeURIComponent(query);
  });
  elements.engineButton.addEventListener("click", () => {
    elements.engineMenu.hidden = !elements.engineMenu.hidden;
  });
  document.addEventListener("click", (event) => {
    if (!elements.searchShell.contains(event.target)) elements.engineMenu.hidden = true;
  });
}

function startParticles() {
  const canvas = elements.particles;
  const context = canvas.getContext("2d");
  const particles = [];
  const resize = () => {
    const scale = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * scale;
    canvas.height = window.innerHeight * scale;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    context.setTransform(scale, 0, 0, scale, 0, 0);
  };
  const seed = () => {
    particles.length = 0;
    const count = Math.min(55, Math.max(22, Math.floor(window.innerWidth / 25)));
    for (let index = 0; index < count; index += 1) {
      particles.push({ x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight, radius: Math.random() * 1.8 + .4, speed: Math.random() * .25 + .08, alpha: Math.random() * .45 + .1 });
    }
  };
  const animate = () => {
    context.clearRect(0, 0, window.innerWidth, window.innerHeight);
    particles.forEach((particle) => {
      particle.y -= particle.speed;
      if (particle.y < -5) particle.y = window.innerHeight + 5;
      context.beginPath();
      context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      context.fillStyle = `rgba(255, 220, 239, ${particle.alpha})`;
      context.fill();
    });
    window.requestAnimationFrame(animate);
  };
  resize();
  seed();
  window.addEventListener("resize", () => { resize(); seed(); });
  window.requestAnimationFrame(animate);
}

async function init() {
  Object.assign(elements, {
    wallpaper: document.querySelector("#wallpaper"),
    liveWallpaper: document.querySelector("#liveWallpaper"),
    particles: document.querySelector("#particles"),
    clock: document.querySelector("#clock"),
    date: document.querySelector("#date"),
    greeting: document.querySelector("#greeting"),
    searchForm: document.querySelector("#searchForm"),
    searchShell: document.querySelector(".search-shell"),
    searchInput: document.querySelector("#searchInput"),
    engineButton: document.querySelector("#engineButton"),
    engineLabel: document.querySelector("#engineLabel"),
    engineMenu: document.querySelector("#engineMenu"),
    shortcutsGrid: document.querySelector("#shortcutsGrid"),
    shortcutCount: document.querySelector("#shortcutCount"),
    settingsButton: document.querySelector("#settingsButton"),
    refreshWallpaper: document.querySelector("#refreshWallpaper"),
    focusQuote: document.querySelector("#focusQuote")
  });
  settings = { ...DEFAULTS, ...(await storageGet(DEFAULTS)), ...(await localStorageGet({ customWallpapers: [] })) };
  settings.visibility = { ...DEFAULTS.visibility, ...(settings.visibility || {}) };
  applyVisibility();
  elements.settingsButton.addEventListener("click", () => chrome.runtime.openOptionsPage());
  elements.refreshWallpaper.addEventListener("click", refreshWallpaper);
  elements.focusQuote.textContent = FOCUS_LINES[new Date().getDate() % FOCUS_LINES.length];
  loadWallpaper();
  updateClock();
  window.setInterval(updateClock, 1000);
  renderEngineMenu();
  renderShortcuts();
  setupSearch();
  startParticles();
}

document.addEventListener("DOMContentLoaded", init);
