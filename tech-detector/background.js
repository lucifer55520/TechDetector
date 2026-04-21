// Unified API â€” works in both Firefox (browser.*) and Chrome (chrome.*)
const api = typeof browser !== "undefined" ? browser : chrome;

// ðŸ”‘ YOUR API KEYS
// VirusTotal  â†’ free key at: https://www.virustotal.com/gui/my-apikey
// CheckPhish  â†’ free key at: https://checkphish.ai
const VT_API_KEY         = "YOUR_VIRUSTOTAL_KEY";   // leave "" to skip
const CHECKPHISH_API_KEY = "YOUR_CHECKPHISH_KEY";   // leave "" to skip

// ============================================================
// TAB DATA STORE
// ============================================================
const tabStore = new Map();  // tabId â†’ data object
const lastScan = new Map();  // tabId â†’ timestamp (rate-limit)

function getTabData(tabId) {
  if (!tabStore.has(tabId)) {
    tabStore.set(tabId, {
      frontend:  [],
      backend:   [],
      security:  [],
      analytics: [],
      cms:       [],
      hosting:   [],
      libraries: [],
      trusted:   "Scanning...",
      url:       ""
    });
  }
  return tabStore.get(tabId);
}

function dedupeTabData(data) {
  ["frontend","backend","security","analytics","cms","hosting","libraries"]
    .forEach(f => { data[f] = [...new Set(data[f])]; });
}

// ============================================================
// RESPONSE HEADER ANALYSIS
// Firefox MV2: webRequest + "responseHeaders" works natively
// ============================================================
api.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (!details.tabId || details.tabId < 0) return;

    const data = getTabData(details.tabId);
    data.url = details.url;

    (details.responseHeaders || []).forEach((h) => {
      const name  = h.name.toLowerCase();
      const value = (h.value || "").toLowerCase();

      // Backend
      if (name === "x-powered-by") {
        if (value.includes("php"))     data.backend.push("PHP");
        if (value.includes("express")) data.backend.push("Node.js (Express)");
        if (value.includes("asp.net")) data.backend.push("ASP.NET");
        if (value.includes("ruby"))    data.backend.push("Ruby on Rails");
        if (value.includes("django"))  data.backend.push("Django");
      }
      if (name === "server") {
        if (value.includes("nginx"))   data.backend.push("Nginx");
        if (value.includes("apache"))  data.backend.push("Apache");
        if (value.includes("iis"))     data.backend.push("IIS");
        if (value.includes("caddy"))   data.backend.push("Caddy");
        if (value.includes("litespeed")) data.backend.push("LiteSpeed");
      }

      // Security
      if (value.includes("cloudflare"))               data.security.push("Cloudflare");
      if (name === "strict-transport-security")        data.security.push("HSTS");
      if (name === "content-security-policy")          data.security.push("CSP");
      if (name === "x-frame-options")                  data.security.push("Clickjack Protection");
      if (name === "x-content-type-options")           data.security.push("MIME Sniffing Protection");
      if (name === "permissions-policy")               data.security.push("Permissions Policy");
      if (value.includes("sucuri"))                    data.security.push("Sucuri");
      if (value.includes("imperva") || value.includes("incapsula")) data.security.push("Imperva");

      // CMS
      if (value.includes("wordpress")) data.cms.push("WordPress");
      if (value.includes("shopify"))   data.cms.push("Shopify");
      if (value.includes("drupal"))    data.cms.push("Drupal");

      // Hosting
      if (value.includes("vercel"))     data.hosting.push("Vercel");
      if (value.includes("netlify"))    data.hosting.push("Netlify");
      if (value.includes("cloudfront")) data.hosting.push("AWS CloudFront");
      if (value.includes("fastly"))     data.hosting.push("Fastly");
      if (value.includes("fly.io"))     data.hosting.push("Fly.io");
    });

    dedupeTabData(data);
    tabStore.set(details.tabId, data);

    // Rate-limit: phishing check at most once every 15s per tab
    const now  = Date.now();
    const last = lastScan.get(details.tabId) || 0;
    if (details.url?.startsWith("http") && (now - last) > 15000) {
      lastScan.set(details.tabId, now);
      runPhishingCheck(details.url, details.tabId);
    }
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);

// ============================================================
// PHISHING CHECK
// 1. VirusTotal API (if key set)
// 2. CheckPhish API (if key set)
// 3. Heuristic fallback (always available)
// ============================================================
async function runPhishingCheck(url, tabId) {
  const data = getTabData(tabId);
  data.trusted = "Checking...";

  let vtMalicious  = 0;
  let vtSuspicious = 0;
  let vtHarmless   = 0;
  let cpVerdict    = null;
  let anyApiWorked = false;

  // â”€â”€ 1. VirusTotal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (VT_API_KEY && VT_API_KEY !== "YOUR_VIRUSTOTAL_KEY") {
    try {
      // Submit URL for scanning
      const submitRes = await fetch("https://www.virustotal.com/api/v3/urls", {
        method: "POST",
        headers: {
          "x-apikey": VT_API_KEY,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: "url=" + encodeURIComponent(url)
      });

      if (submitRes.ok) {
        const submitJson = await submitRes.json();
        const analysisId = submitJson?.data?.id;

        if (analysisId) {
          // Wait for VT to process
          await sleep(2500);

          const reportRes = await fetch(
            `https://www.virustotal.com/api/v3/analyses/${analysisId}`,
            { headers: { "x-apikey": VT_API_KEY } }
          );

          if (reportRes.ok) {
            const reportJson = await reportRes.json();
            const stats = reportJson?.data?.attributes?.stats;
            if (stats) {
              vtMalicious  = stats.malicious  || 0;
              vtSuspicious = stats.suspicious || 0;
              vtHarmless   = stats.harmless   || 0;
              anyApiWorked = true;
            }
          }
        }
      }
    } catch (e) {
      console.warn("[TechDetector] VirusTotal error:", e.message);
    }
  }

  // â”€â”€ 2. CheckPhish â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (CHECKPHISH_API_KEY && CHECKPHISH_API_KEY !== "YOUR_CHECKPHISH_KEY") {
    try {
      // Submit scan
      const submitRes = await fetch("https://api.checkphish.ai/v1/url/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: CHECKPHISH_API_KEY,
          urlInfo: { url }
        })
      });

      if (submitRes.ok) {
        const submitJson = await submitRes.json();
        const jobID = submitJson?.jobID;

        if (jobID) {
          // Poll for result (up to 3 attempts, 3s apart)
          for (let i = 0; i < 3; i++) {
            await sleep(3000);

            const statusRes = await fetch("https://api.checkphish.ai/v1/url/status", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                apiKey: CHECKPHISH_API_KEY,
                jobID,
                insights: true
              })
            });

            if (statusRes.ok) {
              const statusJson = await statusRes.json();
              if (statusJson?.status === "DONE") {
                const d = (statusJson?.disposition || "").toLowerCase();
                cpVerdict    = d.includes("phish") ? "phishing"
                             : d.includes("sus")   ? "suspicious"
                             : "clean";
                anyApiWorked = true;
                break;
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn("[TechDetector] CheckPhish error:", e.message);
    }
  }

  // â”€â”€ 3. Score â†’ verdict â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let verdict;

  if (anyApiWorked) {
    let score = 0;
    score -= vtMalicious  * 50;
    score -= vtSuspicious * 20;
    score += vtHarmless   *  2;
    if (cpVerdict === "phishing")   score -= 80;
    else if (cpVerdict === "suspicious") score -= 40;
    else if (cpVerdict === "clean") score += 20;

    if      (score <= -80) verdict = "âŒ Not Safe";
    else if (score <= -30) verdict = "âš ï¸ Suspicious";
    else if (score <=  10) verdict = "â“ Unrecognized";
    else                   verdict = "âœ… Fully Safe";

  } else {
    // â”€â”€ 4. Heuristic fallback â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    verdict = heuristicCheck(url);
  }

  data.trusted = verdict;
  tabStore.set(tabId, data);
}

// ============================================================
// HEURISTIC PHISHING CHECK  (no API key needed)
// ============================================================
function heuristicCheck(url) {
  try {
    const parsed   = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const fullUrl  = url.toLowerCase();
    let   risk     = 0;

    // Risky TLDs
    const riskyTLDs = [".xyz",".top",".click",".tk",".ml",".ga",".cf",".gq",
                       ".pw",".zip",".review",".country",".kim",".science",
                       ".work",".party",".gdn",".racing",".date",".faith"];
    if (riskyTLDs.some(t => hostname.endsWith(t))) risk += 30;

    // IP address as hostname
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) risk += 50;

    // Too many subdomains
    if (hostname.split(".").length > 4) risk += 20;

    // Very long hostname
    if (hostname.length > 50) risk += 20;

    // Brand keywords in wrong place (e.g. paypal.fakesite.com)
    const brands = ["paypal","amazon","google","facebook","apple","microsoft",
                    "netflix","instagram","whatsapp","bank","secure","login",
                    "account","verify","update","confirm","ebay","wellsfargo"];
    const nonApex = fullUrl.replace(parsed.hostname, "");
    if (brands.some(b => nonApex.includes(b))) risk += 25;

    // Free hosting + brand combo
    const freeHosts = ["blogspot","weebly","wixsite","000webhostapp",
                       "firebaseapp","glitch.me","netlify.app","vercel.app"];
    if (freeHosts.some(h => hostname.includes(h))) risk += 15;

    // Unusual chars
    if (hostname.includes("@") || hostname.includes("%")) risk += 40;

    // No HTTPS
    if (parsed.protocol !== "https:") risk += 20;

    // Phishing keywords in path
    const phishKw = ["login","signin","verify","secure","account",
                     "update","confirm","banking","password","credential"];
    if (phishKw.some(k => parsed.pathname.includes(k))) risk += 15;

    if      (risk >= 70) return "âŒ Not Safe (Heuristic)";
    else if (risk >= 40) return "âš ï¸ Suspicious (Heuristic)";
    else if (risk >= 20) return "â“ Unrecognized (Heuristic)";
    else                 return "âœ… Likely Safe (Heuristic)";

  } catch {
    return "â“ Could Not Check";
  }
}

// ============================================================
// MESSAGE HANDLER
// Firefox: browser.runtime.onMessage supports Promises natively
// ============================================================
api.runtime.onMessage.addListener((req, sender, sendResponse) => {

  // popup.js â†’ request full data for a tab
  if (req.action === "getData") {
    const data = getTabData(req.tabId);
    sendResponse(data);
    return true;   // keep channel open for async
  }

  // content.js â†’ merge DOM-detected tech into tab store
  if (req.action === "frontendDetected") {
    const tabId = sender?.tab?.id;
    if (!tabId) return true;

    const data   = getTabData(tabId);
    const fields = ["frontend","backend","security","analytics","cms","hosting","libraries"];

    fields.forEach(f => {
      if (req.data?.[f]?.length) data[f].push(...req.data[f]);
    });

    dedupeTabData(data);
    tabStore.set(tabId, data);

    // Trigger phishing check if not yet started
    const tabUrl = sender?.tab?.url;
    if (tabUrl && data.trusted === "Scanning...") {
      const now  = Date.now();
      const last = lastScan.get(tabId) || 0;
      if ((now - last) > 15000) {
        lastScan.set(tabId, now);
        runPhishingCheck(tabUrl, tabId);
      }
    }

    return true;
  }

  return true;
});

// ============================================================
// CLEANUP â€” remove stale data when tab is closed
// ============================================================
api.tabs.onRemoved.addListener((tabId) => {
  tabStore.delete(tabId);
  lastScan.delete(tabId);
});

// ============================================================
// UTILS
// ============================================================
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}