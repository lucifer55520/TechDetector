document.addEventListener("DOMContentLoaded", function () {

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {

    if (!tabs || tabs.length === 0) {
      document.getElementById("results").innerHTML =
        "<div class='item'>❌ No active tab found</div>";
      return;
    }

    const tab = tabs[0];

    if (!tab.id || !tab.url) {
      document.getElementById("results").innerHTML =
        "<div class='item'>❌ Cannot access this page</div>";
      return;
    }

    if (tab.url.startsWith("chrome://") || tab.url.startsWith("edge://")) {
      document.getElementById("results").innerHTML =
        "<div class='item'>⚠️ Cannot scan this page</div>";
      return;
    }

    // 📡 Get data from background.js
    chrome.runtime.sendMessage(
      { action: "getData" },
      function (data) {

        if (!data) {
          document.getElementById("results").innerHTML =
            "<div class='item'>⚠️ Scanning... please refresh page</div>";
          return;
        }

        renderUI(data);
      }
    );

  });

});

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

  section("Frontend", data.frontend);
  section("Backend", data.backend);
  section("Security", data.security);
  section("Analytics", data.analytics);
  section("CMS", data.cms);

  html += `
    <div class="section">
      <div class="section-title">Trusted</div>
      <div class="trusted" id="trusted">${data.trusted || "Scanning..."}</div>
    </div>
  `;

  document.getElementById("results").innerHTML = html;

  // 🎨 Color system
  const el = document.getElementById("trusted");

  if (!el) return;

  const status = data.trusted || "";

  if (status.includes("Not Safe")) {
    el.style.color = "red";
  } else if (status.includes("Moderate")) {
    el.style.color = "orange";
  } else if (status.includes("Fully Safe")) {
    el.style.color = "green";
  } else {
    el.style.color = "gray";
  }
}