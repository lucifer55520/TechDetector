function runFullDetection() {
  const results = {
    frontend:  [],
    backend:   [],
    security:  [],
    analytics: [],
    cms:       [],
    hosting:   [],
    libraries: []
  };

  const html    = document.documentElement.innerHTML.toLowerCase();
  const scripts = Array.from(document.scripts).map(s => s.src.toLowerCase()).join(" ");
  const url     = window.location.href.toLowerCase();
  const cookies = document.cookie.toLowerCase();

  // ── Frontend ────────────────────────────────────────────
  if (window.React     || html.includes("react"))    results.frontend.push("React");
  if (window.Vue       || html.includes("vue"))      results.frontend.push("Vue.js");
  if (window.angular   || html.includes("angular"))  results.frontend.push("Angular");
  if (html.includes("_next") || html.includes("next.js")) results.frontend.push("Next.js");
  if (html.includes("nuxt"))    results.frontend.push("Nuxt.js");
  if (html.includes("svelte"))  results.frontend.push("Svelte");
  if (html.includes("ember"))   results.frontend.push("Ember.js");
  if (html.includes("gatsby"))  results.frontend.push("Gatsby");
  if (html.includes("astro"))   results.frontend.push("Astro");
  if (html.includes("solid-js") || window.Solid) results.frontend.push("SolidJS");

  // ── Libraries ───────────────────────────────────────────
  if (window.jQuery     || html.includes("jquery"))      results.libraries.push("jQuery");
  if (html.includes("bootstrap"))    results.libraries.push("Bootstrap");
  if (html.includes("tailwind"))     results.libraries.push("Tailwind CSS");
  if (html.includes("fontawesome"))  results.libraries.push("Font Awesome");
  if (html.includes("swiper"))       results.libraries.push("Swiper.js");
  if (html.includes("lodash") || window._) results.libraries.push("Lodash");
  if (html.includes("axios"))        results.libraries.push("Axios");
  if (window.THREE || html.includes("three.js")) results.libraries.push("Three.js");
  if (window.gsap  || html.includes("gsap"))     results.libraries.push("GSAP");
  if (html.includes("animate.css"))  results.libraries.push("Animate.css");

  // ── Security ────────────────────────────────────────────
  if (html.includes("cloudflare")) results.security.push("Cloudflare");
  if (html.includes("recaptcha"))  results.security.push("reCAPTCHA");
  if (html.includes("hcaptcha"))   results.security.push("hCaptcha");
  if (html.includes("akamai"))     results.security.push("Akamai");
  if (html.includes("sucuri"))     results.security.push("Sucuri");
  if (html.includes("imperva"))    results.security.push("Imperva");
  if (html.includes("turnstile"))  results.security.push("Cloudflare Turnstile");

  // ── CMS ─────────────────────────────────────────────────
  if (html.includes("wp-content")  || html.includes("wordpress")) results.cms.push("WordPress");
  if (html.includes("shopify"))    results.cms.push("Shopify");
  if (html.includes("wix"))        results.cms.push("Wix");
  if (html.includes("joomla"))     results.cms.push("Joomla");
  if (html.includes("drupal"))     results.cms.push("Drupal");
  if (html.includes("magento"))    results.cms.push("Magento");
  if (html.includes("blogger"))    results.cms.push("Blogger");
  if (html.includes("squarespace"))results.cms.push("Squarespace");
  if (html.includes("ghost"))      results.cms.push("Ghost");
  if (html.includes("webflow"))    results.cms.push("Webflow");
  if (html.includes("contentful")) results.cms.push("Contentful");

  // ── Analytics ───────────────────────────────────────────
  if (html.includes("googletagmanager") || html.includes("google-analytics")) {
    results.analytics.push("Google Analytics");
  }
  if (html.includes("facebook.net"))  results.analytics.push("Facebook Pixel");
  if (html.includes("hotjar"))        results.analytics.push("Hotjar");
  if (html.includes("mixpanel"))      results.analytics.push("Mixpanel");
  if (html.includes("segment.com"))   results.analytics.push("Segment");
  if (html.includes("clarity.ms"))    results.analytics.push("Microsoft Clarity");
  if (html.includes("plausible"))     results.analytics.push("Plausible");
  if (html.includes("matomo"))        results.analytics.push("Matomo");
  if (html.includes("amplitude"))     results.analytics.push("Amplitude");

  // ── Backend (cookies + URL) ─────────────────────────────
  if (cookies.includes("phpsessid"))       results.backend.push("PHP");
  if (cookies.includes("laravel_session")) results.backend.push("Laravel");
  if (cookies.includes("csrftoken"))       results.backend.push("Django");
  if (cookies.includes("jsessionid"))      results.backend.push("Java (JSP)");
  if (cookies.includes("asp.net"))         results.backend.push("ASP.NET");
  if (url.includes(".php"))                results.backend.push("PHP");
  if (url.includes(".aspx"))               results.backend.push("ASP.NET");
  if (html.includes("rails"))             results.backend.push("Ruby on Rails");

  // ── Hosting (DOM signals) ───────────────────────────────
  if (html.includes("cloudfront"))  results.hosting.push("AWS CloudFront");
  if (html.includes("vercel"))      results.hosting.push("Vercel");
  if (html.includes("netlify"))     results.hosting.push("Netlify");
  if (html.includes("firebase"))    results.hosting.push("Firebase");
  if (html.includes("heroku"))      results.hosting.push("Heroku");
  if (html.includes("github.io"))   results.hosting.push("GitHub Pages");
  if (html.includes("fly.io"))      results.hosting.push("Fly.io");

  // ── Script src signals ──────────────────────────────────
  if (scripts.includes("react"))     results.frontend.push("React (script)");
  if (scripts.includes("vue"))       results.frontend.push("Vue (script)");
  if (scripts.includes("angular"))   results.frontend.push("Angular (script)");
  if (scripts.includes("analytics")) results.analytics.push("Analytics Script");

  // ── Meta generator tag ──────────────────────────────────
  const metaGen = document.querySelector('meta[name="generator"]');
  if (metaGen) {
    const c = metaGen.content.toLowerCase();
    if (c.includes("wordpress"))  results.cms.push("WordPress");
    if (c.includes("shopify"))    results.cms.push("Shopify");
    if (c.includes("wix"))        results.cms.push("Wix");
    if (c.includes("joomla"))     results.cms.push("Joomla");
    if (c.includes("drupal"))     results.cms.push("Drupal");
    if (c.includes("ghost"))      results.cms.push("Ghost");
    if (c.includes("webflow"))    results.cms.push("Webflow");
    if (c.includes("squarespace"))results.cms.push("Squarespace");
  }

  // ── Deduplicate all arrays ──────────────────────────────
  for (let key in results) {
    results[key] = [...new Set(results[key])];
  }

  return results;
}

// ── Send detected data to background.js ──────────────────
function sendDetection() {
  try {
    const data = runFullDetection();
    // chrome.runtime works in Firefox MV2 as a shim for browser.runtime
    chrome.runtime.sendMessage({ action: "frontendDetected", data });
  } catch (e) {
    console.error("[TechDetector] content.js error:", e);
  }
}

// Run after full page load
window.addEventListener("load", () => {
  setTimeout(sendDetection, 1000);
});

// Respond to on-demand requests from popup.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "detect") {
    sendResponse(runFullDetection());
  }
});