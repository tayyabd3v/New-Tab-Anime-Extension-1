const DEFAULT_SETTINGS = {
  name: "",
  engine: "google",
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

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
    chrome.storage.sync.set(settings);
  });
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.action === "closeOptions" && sender.tab?.id !== undefined) {
    chrome.tabs.remove(sender.tab.id);
  }
});
