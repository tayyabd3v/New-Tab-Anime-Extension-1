const WALLPAPERS = [
  "assets/wallpaper-1.svg",
  "assets/wallpaper-2.svg",
  "assets/wallpaper-3.svg"
];

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
const MEDIA_LIMIT = 50 * 1024 * 1024;

let settings = { ...DEFAULTS };
const elements = {};

function storageGet(defaults) {
  return new Promise((resolve) => chrome.storage.sync.get(defaults, resolve));
}

function storageSet(values) {
  return new Promise((resolve) => chrome.storage.sync.set(values, resolve));
}

function localStorageGet(defaults) {
  return new Promise((resolve) => chrome.storage.local.get(defaults, resolve));
}

function localStorageSet(values) {
  return new Promise((resolve) => chrome.storage.local.set(values, resolve));
}

function loadBackgroundMedia() {
  const wallpaper = document.querySelector("#settingsWallpaper");
  const video = document.querySelector("#settingsLiveWallpaper");
  const all = [...WALLPAPERS.map((url) => ({ url, type: "image" })), ...(settings.customWallpapers || [])];
  const selected = all[Math.min(Number(settings.wallpaper) || 0, all.length - 1)] || all[0];
  video.pause();
  video.removeAttribute("src");
  video.classList.remove("is-loaded");
  wallpaper.classList.remove("is-loaded");
  if (selected.type === "video") {
    video.src = selected.url;
    video.onloadeddata = () => video.classList.add("is-loaded");
    video.play().catch(() => {});
    return;
  }
  wallpaper.style.backgroundImage = `url("${selected.url}")`;
  const image = new Image();
  image.onload = () => wallpaper.classList.add("is-loaded");
  image.src = selected.url;
}

function createInput(className, type, value, placeholder) {
  const input = document.createElement("input");
  input.className = className;
  input.type = type;
  input.value = value;
  input.placeholder = placeholder;
  input.maxLength = type === "text" ? 80 : 400;
  return input;
}

function renderWallpapers() {
  elements.wallpaperGrid.replaceChildren();
  WALLPAPERS.forEach((path, index) => {
    const choice = document.createElement("button");
    choice.type = "button";
    choice.className = "wallpaper-choice";
    choice.style.backgroundImage = `url("${path}")`;
    choice.setAttribute("aria-label", `Wallpaper ${index + 1}`);
    if (Number(settings.wallpaper) === index) choice.classList.add("selected");
    const label = document.createElement("span");
    label.textContent = `Scene 0${index + 1}`;
    choice.append(label);
    choice.addEventListener("click", () => {
      settings.wallpaper = index;
      renderWallpapers();
      loadBackgroundMedia();
      saveSettings(false);
    });
    elements.wallpaperGrid.append(choice);
  });
}

function renderCustomWallpapers() {
  elements.customWallpapers.replaceChildren();
  (settings.customWallpapers || []).forEach((item, index) => {
    const choice = document.createElement("button");
    choice.type = "button";
    choice.className = "custom-wallpaper";
    if (Number(settings.wallpaper) === WALLPAPERS.length + index) choice.classList.add("selected");
    const preview = item.type === "video" ? document.createElement("video") : document.createElement("img");
    preview.className = "custom-wallpaper-preview";
    preview.src = item.url;
    preview.muted = true;
    preview.autoplay = item.type === "video";
    preview.loop = item.type === "video";
    preview.alt = "";
    const label = document.createElement("span");
    label.className = "custom-wallpaper-label";
    label.textContent = `${item.type === "video" ? "Live · " : ""}${item.name}`;
    const remove = document.createElement("span");
    remove.className = "delete-wallpaper";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `Delete ${item.name}`);
    remove.addEventListener("click", async (event) => {
      event.stopPropagation();
      settings.customWallpapers.splice(index, 1);
      if (Number(settings.wallpaper) >= WALLPAPERS.length + settings.customWallpapers.length) settings.wallpaper = 0;
      await localStorageSet({ customWallpapers: settings.customWallpapers });
      renderCustomWallpapers();
      renderWallpapers();
      loadBackgroundMedia();
    });
    choice.addEventListener("click", () => {
      settings.wallpaper = WALLPAPERS.length + index;
      renderCustomWallpapers();
      loadBackgroundMedia();
      saveSettings(false);
    });
    choice.append(preview, label, remove);
    elements.customWallpapers.append(choice);
  });
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function renderLinks() {
  elements.linksList.replaceChildren();
  settings.shortcuts.forEach((shortcut, index) => {
    const row = document.createElement("div");
    row.className = "link-row";
    row.dataset.index = String(index);
    const label = createInput("text-input", "text", shortcut.label, "Label");
    const url = createInput("text-input", "url", shortcut.url, "https://example.com");
    const remove = document.createElement("button");
    remove.className = "remove-link";
    remove.type = "button";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `Remove ${shortcut.label || "shortcut"}`);
    label.addEventListener("input", () => { settings.shortcuts[index].label = label.value; });
    url.addEventListener("input", () => { settings.shortcuts[index].url = url.value; });
    remove.addEventListener("click", () => {
      settings.shortcuts.splice(index, 1);
      renderLinks();
      saveSettings(false);
    });
    row.append(label, url, remove);
    elements.linksList.append(row);
  });
}

function normalizeShortcuts() {
  return settings.shortcuts.filter((shortcut) => {
    try {
      return shortcut.label.trim() && new URL(shortcut.url).protocol.startsWith("http");
    } catch {
      return false;
    }
  }).slice(0, 8).map((shortcut) => ({ label: shortcut.label.trim(), url: shortcut.url.trim() }));
}

async function saveSettings(showMessage = true) {
  settings.name = elements.name.value.trim();
  settings.engine = elements.engine.value;
  settings.wallpaperMode = elements.wallpaperMode.value;
  settings.shortcuts = normalizeShortcuts();
  const { customWallpapers, ...syncedSettings } = settings;
  await storageSet(syncedSettings);
  if (showMessage) {
    elements.savedMessage.textContent = "Saved. Your dashboard is ready.";
    window.setTimeout(() => { elements.savedMessage.textContent = ""; }, 2600);
  }
}

function resetDefaults() {
  settings = structuredClone(DEFAULTS);
  elements.name.value = settings.name;
  elements.engine.value = settings.engine;
  elements.wallpaperMode.value = settings.wallpaperMode;
  setVisibilityInputs();
  renderWallpapers();
  settings.customWallpapers = [];
  localStorageSet({ customWallpapers: [] });
  renderCustomWallpapers();
  loadBackgroundMedia();
  loadBackgroundMedia();
  renderLinks();
  saveSettings();
}

function setVisibilityInputs() {
  const visibility = { ...DEFAULTS.visibility, ...(settings.visibility || {}) };
  document.querySelectorAll("[data-visibility]").forEach((input) => {
    input.checked = visibility[input.dataset.visibility] !== false;
  });
}

function readVisibilityInputs() {
  const visibility = {};
  document.querySelectorAll("[data-visibility]").forEach((input) => {
    visibility[input.dataset.visibility] = input.checked;
  });
  return visibility;
}

async function init() {
  Object.assign(elements, {
    form: document.querySelector("#settingsForm"),
    name: document.querySelector("#name"),
    engine: document.querySelector("#engine"),
    wallpaperGrid: document.querySelector("#wallpaperGrid"),
    customWallpapers: document.querySelector("#customWallpapers"),
    wallpaperUpload: document.querySelector("#wallpaperUpload"),
    settingsWallpaper: document.querySelector("#settingsWallpaper"),
    settingsLiveWallpaper: document.querySelector("#settingsLiveWallpaper"),
    closeSettings: document.querySelector("#closeSettings"),
    wallpaperMode: document.querySelector("#wallpaperMode"),
    linksList: document.querySelector("#linksList"),
    addLink: document.querySelector("#addLink"),
    resetButton: document.querySelector("#resetButton"),
    savedMessage: document.querySelector("#savedMessage")
  });
  settings = { ...DEFAULTS, ...(await storageGet(DEFAULTS)), ...(await localStorageGet({ customWallpapers: [] })) };
  settings.visibility = { ...DEFAULTS.visibility, ...(settings.visibility || {}) };
  settings.shortcuts = Array.isArray(settings.shortcuts) ? settings.shortcuts : [];
  settings.customWallpapers = Array.isArray(settings.customWallpapers) ? settings.customWallpapers : [];
  elements.name.value = settings.name || "";
  elements.engine.value = settings.engine || DEFAULTS.engine;
  elements.wallpaperMode.value = settings.wallpaperMode || DEFAULTS.wallpaperMode;
  setVisibilityInputs();
  renderWallpapers();
  renderCustomWallpapers();
  renderLinks();
  elements.form.addEventListener("submit", (event) => { event.preventDefault(); settings.visibility = readVisibilityInputs(); saveSettings(); });
  document.querySelectorAll("[data-visibility]").forEach((input) => input.addEventListener("change", () => { settings.visibility = readVisibilityInputs(); saveSettings(false); }));
  elements.addLink.addEventListener("click", () => {
    if (settings.shortcuts.length >= 8) return;
    settings.shortcuts.push({ label: "", url: "https://" });
    renderLinks();
    const rows = elements.linksList.querySelectorAll(".link-row");
    rows[rows.length - 1]?.querySelector("input")?.focus();
  });
  elements.wallpaperUpload.addEventListener("change", async () => {
    const [file] = elements.wallpaperUpload.files;
    if (!file) return;
    if (file.size > MEDIA_LIMIT) {
      elements.savedMessage.textContent = "That file is larger than 50 MB.";
      elements.wallpaperUpload.value = "";
      return;
    }
    const type = file.type.startsWith("video/") ? "video" : "image";
    const url = await readFile(file);
    settings.customWallpapers.push({ name: file.name, type, url });
    await localStorageSet({ customWallpapers: settings.customWallpapers });
    settings.wallpaper = WALLPAPERS.length + settings.customWallpapers.length - 1;
    renderCustomWallpapers();
    renderWallpapers();
    loadBackgroundMedia();
    elements.wallpaperUpload.value = "";
    elements.savedMessage.textContent = "Wallpaper added.";
    window.setTimeout(() => { elements.savedMessage.textContent = ""; }, 2600);
  });
  elements.resetButton.addEventListener("click", resetDefaults);
  elements.closeSettings.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "closeOptions" }, () => {
      if (chrome.runtime.lastError) window.close();
    });
  });
  elements.engine.addEventListener("change", () => saveSettings(false));
  elements.wallpaperMode.addEventListener("change", () => saveSettings(false));
}

document.addEventListener("DOMContentLoaded", init);
