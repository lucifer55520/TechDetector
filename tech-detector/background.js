
const api = typeof browser !== "undefined" ? browser : chrome;

// ==============================
// 📦 STORAGE
// ==============================
let detectedData = new Map();
const lastScan = new Map();

// 🔑 API KEYS
const VT_API_KEY = "d487da2f1d9b2f771cc7776b3eb66743ed1cca8fe919d5c4d6833d0ff35fd9ac";
const CHECKPHISH_API_KEY = "pol3lx6dtek9vesjf6l25hhbxkonm04lemnd43utnuwdwz7rk990tff80olx1wot";

// ==============================
// 📦 INIT TAB DATA
// ==============================
function getTabData(tabId) {
  if (!tabId) {
    return {
      frontend: [],
      backend: [],
      security: [],
      analytics: [],
      cms: [],
      trusted: "Scanning..."
    };
  }

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
// 🌐 HEADER ANALYSIS
// ==============================
api.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (!details.responseHeaders || details.tabId < 0) return;

    const tabData = getTabData(details.tabId);
    if (!tabData) return;

    let backend = [];
    let security = [];
    let analytics = [];
    let cms = [];

    details.responseHeaders.forEach((h) => {
      const name = h.name.toLowerCase();
      const value = (h.value || "").toLowerCase();

      // Backend
      if (name === "x-powered-by") {
        if (value.includes("php")) backend.push("PHP");
        if (value.includes("express")) backend.push("Node.js");
        if (value.includes("asp.net")) backend.push("ASP.NET");
      }

      if (name === "server") {
        if (value.includes("apache")) backend.push("Apache");
        if (value.includes("nginx")) backend.push("Nginx");
        if (value.includes("iis")) backend.push("IIS");
      }

      // Security
      if (value.includes("cloudflare")) security.push("Cloudflare");
      if (name === "strict-transport-security") security.push("HSTS");
      if (name === "content-security-policy") security.push("CSP");

      // Analytics
      if (value.includes("google-analytics")) analytics.push("Google Analytics");

      // CMS
      if (value.includes("wordpress")) cms.push("WordPress");
      if (value.includes("shopify")) cms.push("Shopify");
    });

    tabData.backend = [...new Set(backend)];
    tabData.security = [...new Set(security)];
    tabData.analytics = [...new Set(analytics)];
    tabData.cms = [...new Set(cms)];
    tabData.trusted = "Checking...";

    detectedData.set(details.tabId, tabData);

    // Rate limit scanning (IMPORTANT)
    const now = Date.now();
    if (
      details.url &&
      details.url.startsWith("http") &&
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
// 🔐 PHISHING CHECK
// ==============================
async function runPhishingCheck(url, tabId) {
  let vtData = null;
  let cpData = null;

  // -------- VirusTotal --------
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
  } catch (e) {
    console.log("VT error:", e);
  }

  // -------- CheckPhish --------
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
  } catch (e) {
    console.log("CP error:", e);
  }

  // ==============================
  // 🧠 SIMPLE RULE ENGINE (NO AI)
  // ==============================

  const vtStats = vtData?.data?.attributes?.last_analysis_stats;
  const cpStatus = cpData?.status;

  let score = 0;

  // VirusTotal rules
  if (vtStats) {
    score -= (vtStats.malicious || 0) * 50;
    score -= (vtStats.suspicious || 0) * 20;
    score += (vtStats.harmless || 0) * 5;
  }

  // CheckPhish rules
  if (cpStatus === "phishing") score -= 80;
  else if (cpStatus === "suspicious") score -= 40;
  else if (cpStatus === "safe") score += 20;

  // Final classification
  let status = "";

  if (score <= -80) status = "❌ Not Safe";
  else if (score <= -30) status = "⚠️ Suspicious";
  else if (score <= 10) status = "❓ Unrecognized";
  else status = "🟢 Fully Safe";

  const tabData = getTabData(tabId);
  tabData.trusted = status;

  detectedData.set(tabId, tabData);
}

// ==============================
// 📡 MESSAGE HANDLER
// ==============================
api.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.action === "getData") {
    const tabId = sender?.tab?.id;
    sendResponse(getTabData(tabId));
  }

  if (req.action === "frontendDetected") {
    const tabData = getTabData(sender?.tab?.id);
    if (!tabData) return;

    tabData.frontend.push(...(req.data.frontend || []));
    tabData.analytics.push(...(req.data.analytics || []));
    tabData.cms.push(...(req.data.cms || []));

    detectedData.set(sender.tab.id, tabData);
  }
});