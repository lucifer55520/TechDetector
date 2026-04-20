const api = typeof browser !== "undefined" ? browser : chrome;

let detectedData = new Map();
const lastScan = new Map();

// 🔑 API KEYS
const VT_API_KEY = "YOUR_VIRUSTOTAL_KEY";
const CHECKPHISH_API_KEY = "YOUR_CHECKPHISH_KEY";

// ==============================
// TAB STORAGE
// ==============================
function getTabData(tabId) {
  if (!detectedData.has(tabId)) {
    detectedData.set(tabId, {
      frontend: [],
      backend: [],
      security: [],
      analytics: [],
      cms: [],
      trusted: "Scanning..."
    });
  }
  return detectedData.get(tabId);
}

// ==============================
// HEADER ANALYSIS
// ==============================
api.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (!details.tabId || details.tabId < 0) return;

    const tabData = getTabData(details.tabId);

    let backend = [];
    let security = [];
    let analytics = [];
    let cms = [];

    (details.responseHeaders || []).forEach((h) => {
      const name = h.name.toLowerCase();
      const value = (h.value || "").toLowerCase();

      if (name === "x-powered-by") {
        if (value.includes("php")) backend.push("PHP");
        if (value.includes("express")) backend.push("Node.js");
      }

      if (name === "server") {
        if (value.includes("nginx")) backend.push("Nginx");
        if (value.includes("apache")) backend.push("Apache");
      }

      if (value.includes("cloudflare")) security.push("Cloudflare");
      if (name === "strict-transport-security") security.push("HSTS");

      if (value.includes("google-analytics")) analytics.push("Google Analytics");

      if (value.includes("wordpress")) cms.push("WordPress");
      if (value.includes("shopify")) cms.push("Shopify");
    });

    tabData.backend = [...new Set(backend)];
    tabData.security = [...new Set(security)];
    tabData.analytics = [...new Set(analytics)];
    tabData.cms = [...new Set(cms)];
    tabData.trusted = "Checking...";

    detectedData.set(details.tabId, tabData);

    // rate limit
    const now = Date.now();
    if (
      details.url?.startsWith("http") &&
      (!lastScan.get(details.tabId) || now - lastScan.get(details.tabId) > 15000)
    ) {
      lastScan.set(details.tabId, now);
      runPhishingCheck(details.url, details.tabId);
    }
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);

// ==============================
// PHISHING CHECK
// ==============================
async function runPhishingCheck(url, tabId) {

  let vtData = null;
  let cpData = null;

  try {
    const vtRes = await fetch("https://www.virustotal.com/api/v3/urls", {
      method: "POST",
      headers: {
        "x-apikey": VT_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: "url=" + encodeURIComponent(url)
    });

    vtData = await vtRes.json();
  } catch {}

  try {
    const cpRes = await fetch("https://api.checkphish.ai/v1/url", {
      method: "POST",
      headers: {
        "Authorization": CHECKPHISH_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ url })
    });

    cpData = await cpRes.json();
  } catch {}

  const vtStats = vtData?.data?.attributes?.last_analysis_stats;
  const cpStatus = cpData?.status;

  let score = 0;

  if (vtStats) {
    score -= (vtStats.malicious || 0) * 50;
    score -= (vtStats.suspicious || 0) * 20;
    score += (vtStats.harmless || 0) * 5;
  }

  if (cpStatus === "phishing") score -= 80;
  else if (cpStatus === "suspicious") score -= 40;
  else if (cpStatus === "safe") score += 20;

  let status =
    score <= -80 ? "❌ Not Safe" :
    score <= -30 ? "⚠️ Suspicious" :
    score <= 10 ? "❓ Unrecognized" :
    "🟢 Fully Safe";

  const tabData = getTabData(tabId);
  tabData.trusted = status;

  detectedData.set(tabId, tabData);
}

// ==============================
// MESSAGE HANDLER (IMPORTANT FIX)
// ==============================
api.runtime.onMessage.addListener((req, sender, sendResponse) => {

  if (req.action === "getData") {
    const tabId = req.tabId;
    sendResponse(getTabData(tabId));
  }

  if (req.action === "frontendDetected") {
    const tabId = sender?.tab?.id;
    if (!tabId) return;

    const tabData = getTabData(tabId);

    tabData.frontend.push(...(req.data.frontend || []));
    tabData.analytics.push(...(req.data.analytics || []));
    tabData.cms.push(...(req.data.cms || []));

    detectedData.set(tabId, tabData);
  }

  return true;
});