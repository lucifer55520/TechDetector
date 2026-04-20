let detectedData = new Map();

// 🔑 API KEYS
const VT_API_KEY = "d487da2f1d9b2f771cc7776b3eb66743ed1cca8fe919d5c4d6833d0ff35fd9ac";
const CHECKPHISH_API_KEY = "pol3lx6dtek9vesjf6l25hhbxkonm04lemnd43utnuwdwz7rk990tff80olx1wot";

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

  // 🧠 AI ENGINE
  const vtStats = vtData?.data?.attributes?.last_analysis_stats;
  const cpStatus = cpData?.status;

  const signals = buildSignals(url, { hsts: true });

  let score = 0;

  if (vtStats) {
    score += (vtStats.malicious || 0) * -12;
    score += (vtStats.suspicious || 0) * -6;
    score += (vtStats.harmless || 0) * 2;
  } else {
    score -= 8;
  }

  if (cpStatus === "phishing") score -= 60;
  else if (cpStatus === "suspicious") score -= 25;
  else if (cpStatus === "safe") score += 15;
  else score -= 5;

  if (signals.hasHTTPS) score += 5;
  if (signals.hasHSTS) score += 5;
  if (signals.isPopularDomain) score += 10;
  if (signals.isShortDomain) score -= 3;

  const confidence = Math.min(100, Math.abs(score));

  let status = "";

  if (score <= -60) status = `❌ Not Safe (AI ${confidence}%)`;
  else if (score <= -20) status = `⚠️ Suspicious (AI ${confidence}%)`;
  else if (score <= 10) status = `❓ Unrecognised (AI ${confidence}%)`;
  else if (score <= 40) status = `🟡 Likely Safe (AI ${confidence}%)`;
  else status = `🟢 Fully Safe (AI ${confidence}%)`;

  const tabData = getTabData(tabId);
  tabData.trusted = status;
  detectedData.set(tabId, tabData);
}



function buildSignals(url, headers = {}) {
  const domain = new URL(url).hostname;

  return {
    hasHTTPS: url.startsWith("https"),
    isShortDomain: domain.length < 8,
    isPopularDomain: [
      "google.com",
      "github.com",
      "microsoft.com",
      "wikipedia.org",
      "openai.com"
    ].includes(domain),
    hasHSTS: headers.hsts || false
  };
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
