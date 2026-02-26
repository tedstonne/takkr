// Landing page — read-only board with zoom/pan only

const ZOOM_LEVELS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];
let zoomLevel = 1;
let zoomIndicatorTimer = null;

function applyZoom(oldZoom, cx, cy) {
  const canvas = document.getElementById("canvas");
  const notes = document.getElementById("notes");
  if (!canvas || !notes) return;

  notes.style.transform = `scale(${zoomLevel})`;
  notes.style.transformOrigin = "0 0";

  if (cx != null && oldZoom !== zoomLevel) {
    const rect = canvas.getBoundingClientRect();
    const px = (canvas.scrollLeft + cx - rect.left) / oldZoom;
    const py = (canvas.scrollTop + cy - rect.top) / oldZoom;
    canvas.scrollLeft = px * zoomLevel - (cx - rect.left);
    canvas.scrollTop = py * zoomLevel - (cy - rect.top);
  }

  showZoomIndicator();
}

function zoomIn(e) {
  const old = zoomLevel;
  const idx = ZOOM_LEVELS.indexOf(zoomLevel);
  if (idx < ZOOM_LEVELS.length - 1) zoomLevel = ZOOM_LEVELS[idx + 1];
  else if (idx === -1) zoomLevel = ZOOM_LEVELS.find(z => z > old) || ZOOM_LEVELS[ZOOM_LEVELS.length - 1];
  applyZoom(old, e ? e.clientX : window.innerWidth / 2, e ? e.clientY : window.innerHeight / 2);
}

function zoomOut(e) {
  const old = zoomLevel;
  const idx = ZOOM_LEVELS.indexOf(zoomLevel);
  if (idx > 0) zoomLevel = ZOOM_LEVELS[idx - 1];
  else if (idx === -1) zoomLevel = [...ZOOM_LEVELS].reverse().find(z => z < old) || ZOOM_LEVELS[0];
  applyZoom(old, e ? e.clientX : window.innerWidth / 2, e ? e.clientY : window.innerHeight / 2);
}

function zoomReset() {
  const old = zoomLevel;
  zoomLevel = 1;
  applyZoom(old, window.innerWidth / 2, window.innerHeight / 2);
}

function showZoomIndicator() {
  const el = document.getElementById("zoom-indicator");
  if (!el) return;
  el.textContent = `${Math.round(zoomLevel * 100)}%`;
  el.style.opacity = "1";
  clearTimeout(zoomIndicatorTimer);
  zoomIndicatorTimer = setTimeout(() => { el.style.opacity = "0"; }, 2000);
}

// Init
document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("canvas");

  // Center the view so all content is visible
  if (canvas) {
    const vw = canvas.clientWidth;
    const vh = canvas.clientHeight;
    // Content spans roughly x:40-1400, y:60-940
    // On mobile (< 768), zoom out to fit; on desktop, just scroll to origin
    if (vw < 768) {
      zoomLevel = Math.min(vw / 1500, vh / 1000, 0.5);
      const notes = document.getElementById("notes");
      if (notes) {
        notes.style.transform = `scale(${zoomLevel})`;
        notes.style.transformOrigin = "0 0";
      }
      canvas.scrollLeft = 0;
      canvas.scrollTop = 0;
    } else {
      canvas.scrollLeft = 0;
      canvas.scrollTop = 0;
    }
  }

  // Pinch-to-zoom
  canvas?.addEventListener("wheel", (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      if (e.deltaY < 0) zoomIn(e);
      else zoomOut(e);
    }
  }, { passive: false });

  // Keyboard shortcuts
  window.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && (e.key === "=" || e.key === "+")) {
      e.preventDefault(); zoomIn(); return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "-") {
      e.preventDefault(); zoomOut(); return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "0") {
      e.preventDefault(); zoomReset(); return;
    }
    // Without modifier too
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    if (e.key === "+" || e.key === "=") { e.preventDefault(); zoomIn(); }
    if (e.key === "-") { e.preventDefault(); zoomOut(); }
  });
});
