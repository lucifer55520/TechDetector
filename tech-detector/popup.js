const api = typeof browser !== "undefined" ? browser : chrome;

document.addEventListener("DOMContentLoaded", async () => {
  const resultsEl = document.getElementById("results");

  try {
    // browser.tabs.query returns a Promise in Firefox
    const tabs = await api.tabs.query({ active: true, currentWindow: true });

    if (!tabs || tabs.length === 0) {
      resultsEl.innerHTML = errorMsg("No active tab found");
      return;
    }

    const tab = tabs[0];

    // Block browser system pages
    if (
      !tab.url ||
      tab.url.startsWith("about:") ||
      tab.url.startsWith("moz-extension://") ||
      tab.url.startsWith("chrome://") ||
      tab.url.startsWith("chrome-extension://") ||
      tab.url.startsWith("edge://")
    ) {
      resultsEl.innerHTML = errorMsg("⚠️ Cannot scan this page");
      return;
    }

    // Request data from background.js
    // Firefox: browser.runtime.sendMessage returns a Promise
    const data = await api.runtime.sendMessage({ action: "getData", tabId: tab.id });

    if (!data) {
      resultsEl.innerHTML = `
        <div class="empty-state">
          <div class="spinner"></div>
          <p>No data yet — please refresh the page</p>
        </div>`;
      return;
    }

    renderUI(data);

  } catch (err) {
    console.error("[TechDetector popup]", err);
    resultsEl.innerHTML = errorMsg("Unexpected error — try refreshing");
  }
});

// ============================================================
// HELPERS
// ============================================================
function errorMsg(msg) {
  return `<div class="item error-item">❌ ${msg}</div>`;
}

// ============================================================
// RENDER
// ============================================================
function renderUI(data) {
  const el = document.getElementById("results");

  // ── Section builder ────────────────────────────────────
  function section(title, emoji, items) {
    if (!items || items.length === 0) return "";

    const itemsHTML = items.map(i =>
      `<div class="item">
         <span class="item-dot"></span>
         <span class="text">${escapeHTML(i)}</span>
       </div>`
    ).join("");

    return `
      <div class="section">
        <div class="section-title">${emoji} ${title}</div>
        <div class="card">${itemsHTML}</div>
      </div>`;
  }

  // ── Phishing banner ────────────────────────────────────
  const trusted = data.trusted || "Scanning...";
  const status  = trusted.toLowerCase();

  let bannerClass = "banner-unknown";
  let bannerIcon  = "🔍";

  if (status.includes("not safe")) {
    bannerClass = "banner-danger";   bannerIcon = "🚨";
  } else if (status.includes("suspicious")) {
    bannerClass = "banner-warn";     bannerIcon = "⚠️";
  } else if (status.includes("fully safe")) {
    bannerClass = "banner-safe";     bannerIcon = "✅";
  } else if (status.includes("likely safe")) {
    bannerClass = "banner-likely";   bannerIcon = "🟡";
  } else if (status.includes("unrecognized")) {
    bannerClass = "banner-unknown";  bannerIcon = "❓";
  } else if (status.includes("checking") || status.includes("scanning")) {
    bannerClass = "banner-scanning"; bannerIcon = "⏳";
  }

  const phishingBanner = `
    <div class="section">
      <div class="section-title">🛡️ Phishing Status</div>
      <div class="trusted ${bannerClass}">
        <span class="trust-icon">${bannerIcon}</span>
        <span class="trust-text">${escapeHTML(trusted)}</span>
      </div>
    </div>`;

  // ── Tech sections ──────────────────────────────────────
  const sectionsHTML = [
    section("Frontend",  "🖥️",  data.frontend),
    section("Backend",   "⚙️",  data.backend),
    section("CMS",       "📝",  data.cms),
    section("Libraries", "📦",  data.libraries),
    section("Analytics", "📊",  data.analytics),
    section("Security",  "🔒",  data.security),
    section("Hosting",   "☁️",  data.hosting),
  ].filter(Boolean).join("");

  el.innerHTML = phishingBanner + (sectionsHTML || `
    <div class="empty-state" style="padding:16px 8px">
      <div style="font-size:28px;margin-bottom:6px">🔎</div>
      <div style="color:#64748b;font-size:12px;text-align:center">
        No technologies detected yet.<br>Try refreshing the page.
      </div>
    </div>`
  );
}

// Basic XSS guard for rendered strings
function escapeHTML(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}