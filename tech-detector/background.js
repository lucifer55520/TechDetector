let detectedData = {};

// 🔑 API Keys
const VT_API_KEY = "d487da2f1d9b2f771cc7776b3eb66743ed1cca8fe919d5c4d6833d0ff35fd9ac";
const CHECKPHISH_API_KEY = "pol3lx6dtek9vesjf6l25hhbxkonm04lemnd43utnuwdwz7rk990tff80olx1wot";


// 🧠 Detect from headers
chrome.webRequest.onHeadersReceived.addListener(
  function (details) {
    if (!details.responseHeaders || details.tabId < 0) return;

    let backend = [];
    let security = [];
    let analytics = [];
    let cms = [];

    details.responseHeaders.forEach(header => {
      let name = header.name.toLowerCase();
      let value = (header.value || "").toLowerCase();

      // ⚙️ Backend
      if (name === "x-powered-by") {
        if (value.includes("php")) backend.push("PHP");
        if (value.includes("express")) backend.push("Node.js");
        if (value.includes("asp.net")) backend.push("ASP.NET");
      }

      if (name === "server") {
        if (value.includes("apache")) backend.push("Apache");
        if (value.includes("nginx")) backend.push("Nginx");
        if (value.includes("iis")) backend.push("Microsoft IIS");
        if (value.includes("gunicorn")) backend.push("Python");
      }

      // 🛡️ Security
      if (value.includes("cloudflare")) security.push("Cloudflare");
      if (value.includes("recaptcha")) security.push("reCAPTCHA");
      if (name === "strict-transport-security") security.push("HSTS");
      if (name === "content-security-policy") security.push("CSP");
      if (name === "x-frame-options") security.push("Clickjacking Protection");
      if (name === "x-xss-protection") security.push("XSS Protection");

      // 📊 Analytics
      if (value.includes("google-analytics")) analytics.push("Google Analytics");
      if (value.includes("googletagmanager")) analytics.push("Google Tag Manager");
      if (value.includes("facebook")) analytics.push("Facebook Pixel");
      if (value.includes("hotjar")) analytics.push("Hotjar");
      if (value.includes("mixpanel")) analytics.push("Mixpanel");

      // 🧩 CMS
      if (value.includes("wordpress") || value.includes("wp-")) cms.push("WordPress");
      if (value.includes("shopify")) cms.push("Shopify");
      if (value.includes("joomla")) cms.push("Joomla");
      if (value.includes("drupal")) cms.push("Drupal");
      if (value.includes("magento")) cms.push("Magento");
      if (value.includes("wix")) cms.push("Wix");
    });

    detectedData[details.tabId] = {
      frontend: [],
      backend: [...new Set(backend)],
      security: [...new Set(security)],
      analytics: [...new Set(analytics)],
      cms: [...new Set(cms)],
      trusted: "Checking..."
    };

    // 🔐 Run phishing detection
    if (details.url.startsWith("http")) {
      runPhishingCheck(details.url, details.tabId);
    }
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);


// 🔐 Phishing detection (VT + CheckPhish)
async function runPhishingCheck(url, tabId) {
  try {
    let vtScore = 0;
    let cpScore = 0;

    // 🔹 VirusTotal
    try {
      let vtRes = await fetch("https://www.virustotal.com/api/v3/urls", {
        method: "POST",
        headers: {
          "x-apikey": VT_API_KEY,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: "url=" + encodeURIComponent(url)
      });

      let vtData = await vtRes.json();
      vtScore = extractVTScore(vtData);
    } catch {}

    // 🔹 CheckPhish
    try {
      let cpRes = await fetch("https://api.checkphish.ai/v1/url", {
        method: "POST",
        headers: {
          "Authorization": CHECKPHISH_API_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ url: url })
      });

      let cpData = await cpRes.json();
      cpScore = extractCPScore(cpData);
    } catch {}

    let finalStatus = getTrustedStatus(vtScore, cpScore);

    if (detectedData[tabId]) {
      detectedData[tabId].trusted = finalStatus;
    }

  } catch {
    if (detectedData[tabId]) {
      detectedData[tabId].trusted = "Unrecognized ⚠️";
    }
  }
}


// 🧠 VirusTotal score
function extractVTScore(vtData) {
  try {
    let stats = vtData?.data?.attributes?.last_analysis_stats;
    let malicious = stats?.malicious || 0;
    let suspicious = stats?.suspicious || 0;
    return (malicious * 2) + suspicious;
  } catch {
    return 0;
  }
}


// 🧠 CheckPhish score
function extractCPScore(cpData) {
  try {
    if (cpData?.score) return cpData.score;
    if (cpData?.status === "phishing") return 80;
    if (cpData?.status === "suspicious") return 50;
    return 0;
  } catch {
    return 0;
  }
}


// 🎯 Final Trusted Logic
function getTrustedStatus(vtScore, cpScore) {
  let total = vtScore + cpScore;

  if (total > 80) return "Not Safe ❌";
  if (total > 40) return "Moderate Safe 🟡";
  if (total > 10) return "Neutral ⚪";
  if (total === 0) return "Fully Safe 🟢";

  return "Unrecognized ⚠️";
}


// 📡 Receive frontend + extra detections from content.js
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {

  if (req.action === "frontendDetected") {
    if (detectedData[sender.tab.id]) {
      detectedData[sender.tab.id].frontend = req.data.frontend || [];

      // Merge analytics + CMS from content.js
      detectedData[sender.tab.id].analytics.push(...(req.data.analytics || []));
      detectedData[sender.tab.id].cms.push(...(req.data.cms || []));
    }
  }

  // 📡 Send data to popup
  if (req.action === "getData") {
    sendResponse(detectedData[sender.tab.id] || {});
  }
});