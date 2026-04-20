document.addEventListener("DOMContentLoaded", async function () {

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) {
    document.getElementById("results").innerHTML = "No tab found";
    return;
  }

  function loadData() {
    chrome.runtime.sendMessage(
      { action: "getData", tabId: tab.id },   // ✅ IMPORTANT FIX
      function (data) {

        if (!data) {
          document.getElementById("results").innerHTML =
            "<div>Scanning...</div>";
          return;
        }

        renderUI(data);
      }
    );
  }

  loadData();

  // 🔁 auto refresh every 2 seconds (fix stuck UI)
  setInterval(loadData, 2000);
});


function renderUI(data) {

  document.getElementById("results").innerHTML = `
    <div>Frontend: ${data.frontend.join(", ") || "None"}</div>
    <div>Backend: ${data.backend.join(", ") || "None"}</div>
    <div>Security: ${data.security.join(", ") || "None"}</div>
    <div>CMS: ${data.cms.join(", ") || "None"}</div>
    <div><b>Status:</b> ${data.trusted}</div>
  `;
}