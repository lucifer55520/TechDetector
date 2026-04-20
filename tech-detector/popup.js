document.addEventListener("DOMContentLoaded", async function () {

  const results = document.getElementById("results");

  // Get active tab safely
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) {
    results.innerHTML = "<div>❌ No active tab found</div>";
    return;
  }

  if (!tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("edge://")) {
    results.innerHTML = "<div>⚠️ Cannot scan this page</div>";
    return;
  }

  // 🔁 Function to request data from background
  function fetchData() {
    chrome.runtime.sendMessage(
      {
        action: "getData",
        tabId: tab.id   // ✅ IMPORTANT FIX
      },
      function (data) {

        if (!data) {
          results.innerHTML = "<div>⏳ Scanning website...</div>";
          return;
        }

        renderUI(data);
      }
    );
  }

  // 🚀 First load
  fetchData();

  // 🔁 Auto refresh (fixes stuck popup problem)
  const interval = setInterval(fetchData, 2000);

  // Optional: stop refresh when popup closes
  window.addEventListener("beforeunload", () => {
    clearInterval(interval);
  });

});


// ==============================
// 🎨 UI RENDER FUNCTION
// ==============================
function renderUI(data) {

  const results = document.getElementById("results");

  function section(title, items) {
    let html = `<div class="section">
      <div class="section-title">${title}</div>`;

    if (!items || items.length === 0) {
      html += `<div class="empty">None detected</div>`;
    } else {
      items.forEach(i => {
        html += `<div class="item">${i}</div>`;
      });
    }

    html += `</div>`;
    return html;
  }

  let html = "";

  html += section("Frontend", data.frontend);
  html += section("Backend", data.backend);
  html += section("Security", data.security);
  html += section("Analytics", data.analytics);
  html += section("CMS", data.cms);

  // 🔐 Trusted status
  html += `
    <div class="section">
      <div class="section-title">Trusted Status</div>
      <div id="trusted-status" class="trusted">
        ${data.trusted || "Scanning..."}
      </div>
    </div>
  `;

  results.innerHTML = html;

  // 🎨 Color system
  const el = document.getElementById("trusted-status");

  if (!el) return;

  const status = (data.trusted || "").toLowerCase();

  if (status.includes("not safe")) {
    el.style.color = "red";
  } 
  else if (status.includes("moderate")) {
    el.style.color = "orange";
  } 
  else if (status.includes("fully safe")) {
    el.style.color = "green";
  } 
  else if (status.includes("suspicious")) {
    el.style.color = "yellow";
  } 
  else {
    el.style.color = "gray";
  }
}