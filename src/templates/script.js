// ─── Filter Toggles ───
document.addEventListener("DOMContentLoaded", function () {
  const STORAGE_KEY = "cline-exporter-filters";

  // Default visibility: true = shown, false = hidden
  var DEFAULTS = {
    thinking: true,
    browser: true,
    tools: true,
    mcp: true,
    progress: false,
    commands: false,
    api: false,
  };

  function loadFilters() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return Object.assign({}, DEFAULTS, JSON.parse(stored));
      }
    } catch (e) {
      // Ignore storage errors (e.g. file:// in some browsers)
    }
    return Object.assign({}, DEFAULTS);
  }

  function saveFilters(filters) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
    } catch (e) {
      // Ignore
    }
  }

  function applyFilters(filters) {
    var body = document.body;
    var keys = Object.keys(filters);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (filters[key]) {
        body.classList.remove("hide-" + key);
      } else {
        body.classList.add("hide-" + key);
      }
    }
  }

  var filters = loadFilters();
  applyFilters(filters);

  // Wire up checkboxes
  var checkboxes = document.querySelectorAll(".filter-toggle input");
  for (var i = 0; i < checkboxes.length; i++) {
    (function (cb) {
      var key = cb.getAttribute("data-filter");
      if (!key) return;

      // Set initial checkbox state
      cb.checked = filters[key] !== false;

      cb.addEventListener("change", function () {
        filters[key] = cb.checked;
        applyFilters(filters);
        saveFilters(filters);
      });
    })(checkboxes[i]);
  }
});

// ─── Copy to Clipboard ───
document.addEventListener("click", function (e) {
  var btn = e.target.closest ? e.target.closest(".copy-btn") : null;
  if (!btn) return;

  var code = btn.getAttribute("data-code");
  if (!code) return;

  if (navigator.clipboard) {
    navigator.clipboard
      .writeText(code)
      .then(function () {
        var original = btn.textContent;
        btn.textContent = "Copied!";
        setTimeout(function () {
          btn.textContent = original;
        }, 2000);
      })
      .catch(function () {
        fallbackCopy(btn, code);
      });
  } else {
    fallbackCopy(btn, code);
  }
});

function fallbackCopy(btn, code) {
  var textarea = document.createElement("textarea");
  textarea.value = code;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand("copy");
    var original = btn.textContent;
    btn.textContent = "Copied!";
    setTimeout(function () {
      btn.textContent = original;
    }, 2000);
  } catch (e) {
    btn.textContent = "Failed";
    setTimeout(function () {
      btn.textContent = "Copy";
    }, 2000);
  }
  document.body.removeChild(textarea);
}
