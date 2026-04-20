let detectedData = new Map();

// 🔑 API KEYS
const VT_API_KEY = "YOUR_VIRUSTOTAL_KEY";
const CHECKPHISH_API_KEY = "YOUR_CHECKPHISH_KEY";


// ==============================
// 📦 CREATE / GET TAB DATA
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
// 🌐 HEADER DETECTION
// ==============================
chrome.webRequest.onHeadersReceived.addListener(
  function (details) {

    if (!details.responseHeaders || details.tabId < 0) return;

    const tabData = getTabData(details.tabId);

    let backend = [];
    let security = [];
    let analytics = [];
    let cms = [];

    details.responseHeaders.forEach(header => {

      const name = header.name.toLowerCase();
      const value = (header.value || "").toLowerCase();

      // Backend detection
      if (name === "x-powered-by") {
        if (value.includes("php")) backend.push("PHP");
        if (value.includes("express")) backend.push("Node.js");
        if (value.includes("asp.net")) backend.push("ASP.NET");
      }

      if (name === "server") {
        if (value.includes("apache")) backend.push("Apache");
        if (value.includes("nginx")) backend.push("Nginx");
        if (value.includes("iis")) backend.push("IIS");
        if (value.includes("gunicorn")) backend.push("Python");
      }

      // Security
      if (value.includes("cloudflare")) security.push("Cloudflare");
      if (name === "strict-transport-security") security.push("HSTS");
      if (name === "content-security-policy") security.push("CSP");

      // Analytics
      if (value.includes("google-analytics")) analytics.push("Google Analytics");
      if (value.includes("googletagmanager")) analytics.push("Google Tag Manager");

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

    // Run phishing scan only for real URLs
    if (details.url && details.url.startsWith("http")) {
      runPhishingCheck(details.url, details.tabId);
    }
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);


// ==============================
// 🔐 PHISHING CHECK ENGINE
// ==============================
async function runPhishingCheck(url, tabId) {

  let vtScore = 0;
  let cpScore = 0;

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

    const vtData = await vtRes.json();
    vtScore = extractVTScore(vtData);

  } catch {}

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

    const cpData = await cpRes.json();
    cpScore = extractCPScore(cpData);

  } catch {}

  // Final result
  const status = getFinalStatus(vtScore, cpScore);

  const tabData = getTabData(tabId);
  tabData.trusted = status;

  detectedData.set(tabId, tabData);
}


// ==============================
// 🧠 VIRUSTOTAL SCORING
// ==============================
function extractVTScore(data) {
  const stats = data?.data?.attributes?.last_analysis_stats;

  if (!stats) return 5;

  return (stats.malicious || 0) * 10 +
         (stats.suspicious || 0) * 3;
}


// ==============================
// 🧠 CHECKPHISH SCORING
// ==============================
function extractCPScore(data) {

  if (!data) return 5;

  if (data.status === "phishing") return 50;
  if (data.status === "suspicious") return 20;
  if (data.status === "safe") return -10;

  return 10;
}


// ==============================
// 🎯 FINAL RANKING SYSTEM
// ==============================
function getFinalStatus(vtScore, cpScore) {

  const score = vtScore + cpScore;

  if (score >= 80) return "❌ Not Safe";
  if (score >= 40) return "🟡 Moderate Safe";
  if (score >= 10) return "⚪ Neutral";
  if (score > 0) return "❓ Unrecognised";

  return "🟢 Fully Safe";
}


// ==============================
// 📡 SEND DATA TO POPUP
// ==============================
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {

  if (req.action === "getData") {
    const tabId = sender?.tab?.id;
    sendResponse(getTabData(tabId));
  }

  if (req.action === "frontendDetected") {
    const tabData = getTabData(sender.tab.id);

    tabData.frontend.push(...(req.data.frontend || []));
    tabData.analytics.push(...(req.data.analytics || []));
    tabData.cms.push(...(req.data.cms || []));

    detectedData.set(sender.tab.id, tabData);
  }

  return true;
});