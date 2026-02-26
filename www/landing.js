// Landing page — draggable feature notes, no persistence

document.addEventListener("DOMContentLoaded", () => {
  const CARD_W = 240;
  const CARD_H = 180;

  // Layout notes: cluster related ones (grp-*) with slight corner overlap,
  // space clusters apart so text stays ~90% visible
  function layoutBoard(container) {
    const notes = Array.from(container.querySelectorAll(".landing-note"));
    if (!notes.length) return;

    const cw = container.clientWidth;

    // Group notes by grp-* tag (read from data attributes or DOM)
    // We encode the group in a data attr set server-side
    const groups = new Map(); // groupKey -> [note, ...]
    const ungrouped = [];
    notes.forEach((note) => {
      const grp = note.dataset.grp;
      if (grp) {
        if (!groups.has(grp)) groups.set(grp, []);
        groups.get(grp).push(note);
      } else {
        ungrouped.push(note);
      }
    });

    // Within a cluster: fan out so each card is fully readable,
    // just a sliver/corner of the previous card tucked behind
    const OVERLAP_X = CARD_W * 0.85;
    const OVERLAP_Y = CARD_H * 0.25;

    // Lay out clusters in a flowing grid
    const clusterList = [...groups.values(), ...ungrouped.map(n => [n])];
    const CLUSTER_GAP_X = 40;
    const CLUSTER_GAP_Y = 30;

    let cursorX = 20;
    let cursorY = 0;
    let rowHeight = 0;
    let zIdx = 1;

    clusterList.forEach((cluster) => {
      // Cluster bounding box
      const clusterW = CARD_W + (cluster.length - 1) * OVERLAP_X;
      const clusterH = CARD_H + (cluster.length - 1) * OVERLAP_Y;

      // Wrap to next row if needed
      if (cursorX + clusterW > cw - 20 && cursorX > 20) {
        cursorX = 20;
        cursorY += rowHeight + CLUSTER_GAP_Y;
        rowHeight = 0;
      }

      // Place each note within the cluster with slight offset + jitter
      cluster.forEach((note, j) => {
        const baseX = cursorX + j * OVERLAP_X;
        const baseY = cursorY + j * OVERLAP_Y;
        const ox = (Math.random() - 0.5) * 16;
        const oy = (Math.random() - 0.5) * 12;
        const rot = (Math.random() - 0.5) * 8; // ±4 degrees

        const x = Math.max(0, Math.min(baseX + ox, cw - CARD_W));
        const y = Math.max(0, baseY + oy);

        note.style.left = `${x}px`;
        note.style.top = `${y}px`;
        note.style.transform = `rotate(${rot}deg)`;
        note.style.zIndex = `${zIdx++}`;
        note.dataset.rot = rot;
      });

      rowHeight = Math.max(rowHeight, clusterH);
      cursorX += clusterW + CLUSTER_GAP_X;
    });

    const maxBottom = notes.reduce((max, n) =>
      Math.max(max, parseFloat(n.style.top) + CARD_H + 30), 0);
    container.style.minHeight = `${maxBottom}px`;
  }

  // Layout all boards
  document.querySelectorAll(".landing-board").forEach(layoutBoard);

  // Drag support (no save) — works across all boards
  let dragging = null;
  let dragContainer = null;
  let dragOffset = { x: 0, y: 0 };

  const onDown = (e) => {
    const note = e.target.closest(".landing-note");
    if (!note) return;
    dragging = note;
    dragContainer = note.closest(".landing-board");

    const rect = note.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    dragOffset.x = cx - rect.left;
    dragOffset.y = cy - rect.top;

    note.classList.add("dragging");
    note.style.transform = "rotate(0deg) scale(1.05)";
    e.preventDefault();
  };

  const onMove = (e) => {
    if (!dragging || !dragContainer) return;
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    const cr = dragContainer.getBoundingClientRect();

    let x = cx - cr.left - dragOffset.x;
    let y = cy - cr.top - dragOffset.y;
    x = Math.max(0, Math.min(x, dragContainer.clientWidth - CARD_W));
    y = Math.max(0, y);

    dragging.style.left = `${x}px`;
    dragging.style.top = `${y}px`;
    e.preventDefault();
  };

  const onUp = () => {
    if (!dragging) return;
    const rot = dragging.dataset.rot || 0;
    dragging.classList.remove("dragging");
    dragging.style.transform = `rotate(${rot}deg)`;
    dragging = null;
    dragContainer = null;
  };

  document.querySelectorAll(".landing-board").forEach((board) => {
    board.addEventListener("mousedown", onDown);
    board.addEventListener("touchstart", onDown, { passive: false });
  });
  window.addEventListener("mousemove", onMove);
  window.addEventListener("touchmove", onMove, { passive: false });
  window.addEventListener("mouseup", onUp);
  window.addEventListener("touchend", onUp);

  // ── Theme Carousel ──
  const THEMES = [
    { bg: "grid",       font: "Caveat",       label: "Classic" },
    { bg: "cork",       font: "Indie Flower",  label: "Cork Board" },
    { bg: "chalkboard", font: "Kalam",         label: "Chalkboard" },
    { bg: "blueprint",  font: "Gochi Hand",    label: "Blueprint" },
    { bg: "lined",      font: "Handlee",       label: "Notebook" },
    { bg: "canvas",     font: "Sofia",         label: "Canvas" },
  ];

  const board = document.getElementById("carousel-board");
  const prev = document.getElementById("carousel-prev");
  const next = document.getElementById("carousel-next");
  const dots = document.getElementById("carousel-dots");

  if (board && prev && next && dots) {
    let current = 0;

    // Build dots
    THEMES.forEach((t, i) => {
      const dot = document.createElement("button");
      dot.className = "w-2 h-2 rounded-full transition-all duration-300";
      dot.setAttribute("aria-label", t.label);
      dot.addEventListener("click", () => goTo(i));
      dots.appendChild(dot);
    });

    function reshuffleCarousel() {
      const notes = Array.from(board.querySelectorAll(".carousel-note"));
      if (!notes.length) return;
      const cw = board.clientWidth;
      // Spread notes out nicely — no clustering for the carousel demo
      const cols = Math.max(2, Math.min(3, Math.floor(cw / (CARD_W + 40))));
      const totalW = cols * CARD_W;
      const gapX = (cw - totalW) / (cols + 1);
      const gapY = 20;
      notes.forEach((note, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const baseX = gapX + col * (CARD_W + gapX);
        const baseY = row * (CARD_H + gapY);
        const ox = (Math.random() - 0.5) * 50;
        const oy = (Math.random() - 0.5) * 30;
        const rot = (Math.random() - 0.5) * 8;
        const x = Math.max(8, Math.min(baseX + ox, cw - CARD_W - 8));
        const y = Math.max(8, baseY + oy);
        note.style.transition = "left 0.5s ease, top 0.5s ease, transform 0.5s ease";
        note.style.left = `${x}px`;
        note.style.top = `${y}px`;
        note.style.transform = `rotate(${rot}deg)`;
        note.style.zIndex = `${i + 1}`;
        note.dataset.rot = rot;
      });
      const maxBottom = notes.reduce((max, n) =>
        Math.max(max, parseFloat(n.style.top) + CARD_H + 20), 0);
      board.style.minHeight = `${Math.max(340, maxBottom)}px`;
    }

    function goTo(idx) {
      current = ((idx % THEMES.length) + THEMES.length) % THEMES.length;
      const theme = THEMES[current];
      board.setAttribute("data-background", theme.bg);
      // Apply font to all carousel notes
      board.querySelectorAll(".carousel-note").forEach(n => {
        n.style.setProperty("--takkr-font", `"${theme.font}"`);
      });
      // Update dots
      Array.from(dots.children).forEach((d, i) => {
        d.className = i === current
          ? "w-3 h-3 rounded-full bg-slate-800 transition-all duration-300"
          : "w-2 h-2 rounded-full bg-slate-300 transition-all duration-300";
      });
      // Reshuffle positions for liveliness
      reshuffleCarousel();
    }

    prev.addEventListener("click", () => goTo(current - 1));
    next.addEventListener("click", () => goTo(current + 1));

    // Initialize
    goTo(0);
  }
});
