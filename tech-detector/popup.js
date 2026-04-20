document.addEventListener("DOMContentLoaded", function () {

  const resultsDiv = document.getElementById("results");

  // 🔄 Loading state (IMPROVED #1)
  resultsDiv.innerHTML =
    "<div class='item'>🔄 Scanning website...</div>";

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {

    if (!tabs || tabs.length === 0) {
      resultsDiv.innerHTML =
        "<div class='item'>❌ No active tab found</div>";
      return;
    }

    const tab = tabs[0];

    if (!tab?.id || !tab?.url) {
      resultsDiv.innerHTML =
        "<div class='item'>❌ Cannot access this page</div>";
      return;
    }

    if (
      tab.url.startsWith("chrome://") ||
      tab.url.startsWith("edge://") ||
      tab.url.startsWith("about:")
    ) {
      resultsDiv.innerHTML =
        "<div class='item'>⚠️ Cannot scan this page</div>";
      return;
    }

    // 📡 Get data from background.js
    chrome.runtime.sendMessage(
      { action: "getData" },
      function (data) {

        if (!data) {
          resultsDiv.innerHTML =
            "<div class='item'>⚠️ Scanning... please refresh page</div>";
          return;
        }

        renderUI(data);
      }
    );

  });

});


// ==============================
// 🎨 UI RENDER FUNCTION
// ==============================
function renderUI(data) {

  let html = "";

  function section(title, items) {

    html += `<div class="section">
      <div class="section-title">${title}</div>`;

    if (!items || items.length === 0) {
      html += `<div class="empty">None detected</div>`;
    } else {
      items.forEach(i => {
        html += `<div class="item">${i}</div>`;
      });
    }

    html += `</div>`;
  }

  // 📊 Sections (IMPROVED #2 safe access)
  section("Frontend", data?.frontend || []);
  section("Backend", data?.backend || []);
  section("Security", data?.security || []);
  section("Analytics", data?.analytics || []);
  section("CMS", data?.cms || []);

  // 🔐 Trusted section
  html += `
    <div class="section">
      <div class="section-title">Trusted</div>
      <div class="trusted" id="trusted">
        ${data?.trusted || "Scanning..."}
      </div>
    </div>
  `;

  document.getElementById("results").innerHTML = html;

  // 🎨 Color system (IMPROVED #3 safe handling)
  const el = document.getElementById("trusted");

  if (!el) return;

  const status = data?.trusted || "";

  if (status.includes("Not Safe")) {
    el.style.color = "red";
  } else if (status.includes("Moderate")) {
    el.style.color = "orange";
  } else if (status.includes("Fully Safe")) {
    el.style.color = "green";
  } else if (status.includes("Neutral")) {
    el.style.color = "gray";
  } else {
    el.style.color = "#94a3b8"; // soft neutral
  }
}