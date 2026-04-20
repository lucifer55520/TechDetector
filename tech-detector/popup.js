document.addEventListener("DOMContentLoaded", async () => {
  const resultsEl = document.getElementById("results");

  try {
    const tabs = await getActiveTab();

    if (!tabs || tabs.length === 0) {
      resultsEl.innerHTML = "<div class='item'>❌ No active tab found</div>";
      return;
    }

    const tab = tabs[0];
    const tabId = tab.id;

    if (!tabId) {
      resultsEl.innerHTML = "<div class='item'>❌ Cannot access tab</div>";
      return;
    }

    // 🚫 block system pages
    if (
      tab.url?.startsWith("chrome://") ||
      tab.url?.startsWith("edge://") ||
      tab.url?.startsWith("about:")
    ) {
      resultsEl.innerHTML = "<div class='item'>⚠️ Cannot scan this page</div>";
      return;
    }

    // 📡 request data from background
    chrome.runtime.sendMessage(
      { action: "getData", tabId },
      (data) => {
        if (!data) {
          resultsEl.innerHTML =
            "<div class='item'>⚠️ No data yet. Refresh page.</div>";
          return;
        }

        renderUI(data);
      }
    );

  } catch (err) {
    console.error(err);
    document.getElementById("results").innerHTML =
      "<div class='item'>❌ Error loading popup</div>";
  }
});


// ==============================
// GET ACTIVE TAB (PROMISE WRAPPER)
// ==============================
function getActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, resolve);
  });
}


// ==============================
// UI RENDER ENGINE
// ==============================
function renderUI(data) {
  const el = document.getElementById("results");

  let html = "";

  function section(title, items) {
    html += `<div class="section">
      <div class="section-title">${title}</div>`;

    if (!items || items.length === 0) {
      html += `<div class="empty">None detected</div>`;
    } else {
      items.forEach((i) => {
        html += `<div class="item">${i}</div>`;
      });
    }

    html += `</div>`;
  }

  section("Frontend", data.frontend);
  section("Backend", data.backend);
  section("Security", data.security);
  section("Analytics", data.analytics);
  section("CMS", data.cms);

  html += `
    <div class="section">
      <div class="section-title">Trusted Status</div>
      <div id="trusted" class="trusted">${data.trusted || "Scanning..."}</div>
    </div>
  `;

  el.innerHTML = html;

  // 🎨 COLOR SYSTEM
  const t = document.getElementById("trusted");
  if (!t) return;

  const status = (data.trusted || "").toLowerCase();

  if (status.includes("not safe")) {
    t.style.color = "red";
  } else if (status.includes("suspicious")) {
    t.style.color = "orange";
  } else if (status.includes("likely safe")) {
    t.style.color = "#ffb300";
  } else if (status.includes("fully safe")) {
    t.style.color = "green";
  } else {
    t.style.color = "gray";
  }
}