document.addEventListener("DOMContentLoaded", function () {

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {

    if (!tabs || tabs.length === 0) {
      document.getElementById("results").innerHTML =
        "<div class='item'>❌ No active tab found</div>";
      return;
    }

    let tab = tabs[0];

    if (!tab.id) {
      document.getElementById("results").innerHTML =
        "<div class='item'>❌ Cannot access this page</div>";
      return;
    }

    if (tab.url.startsWith("chrome://") || tab.url.startsWith("edge://")) {
      document.getElementById("results").innerHTML =
        "<div class='item'>⚠️ Cannot run on this page</div>";
      return;
    }

    // 🔹 Get data from content.js
    chrome.tabs.sendMessage(tab.id, { action: "detect" }, function (contentRes) {

      // 🔹 Get data from background.js (Trusted + merged data)
      chrome.runtime.sendMessage({ action: "getData" }, function (bgRes) {

        if (!contentRes && !bgRes) {
          document.getElementById("results").innerHTML =
            "<div class='item'>⚠️ Refresh the page and try again</div>";
          return;
        }

        let html = "";

        function createSection(title, items) {
          html += `<div class="section">
                    <div class="section-title">${title}</div>`;

          if (!items || items.length === 0) {
            html += `<div class="empty">None detected</div>`;
          } else {
            items.forEach(item => {
              html += `<div class="item">${item}</div>`;
            });
          }

          html += `</div>`;
        }

        // ✅ Use combined data (prefer background if available)
        let data = {
          frontend: bgRes?.frontend || contentRes?.frontend || [],
          backend: bgRes?.backend || contentRes?.backend || [],
          security: bgRes?.security || contentRes?.security || [],
          analytics: bgRes?.analytics || contentRes?.analytics || [],
          cms: bgRes?.cms || contentRes?.cms || [],
          trusted: bgRes?.trusted || "Unrecognized ⚠️"
        };

        // 📊 Sections
        createSection("Frontend", data.frontend);
        createSection("Backend", data.backend);
        createSection("Security", data.security);
        createSection("Analytics", data.analytics);
        createSection("CMS", data.cms);

        // 🔐 Trusted Section (special styling)
        html += `<div class="section">
                  <div class="section-title">Trusted</div>
                  <div class="trusted" id="trusted-status">${data.trusted}</div>
                 </div>`;

        document.getElementById("results").innerHTML = html;

        // 🎨 Color styling for Trusted
        let el = document.getElementById("trusted-status");
        let status = data.trusted;

        if (status.includes("Not Safe")) {
          el.style.color = "red";
        } else if (status.includes("Moderate")) {
          el.style.color = "orange";
        } else if (status.includes("Fully Safe")) {
          el.style.color = "green";
        } else {
          el.style.color = "gray";
        }

      });
    });

  });

});