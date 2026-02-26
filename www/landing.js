// Landing page — draggable feature notes, no persistence

document.addEventListener("DOMContentLoaded", () => {
  const CARD_W = 240;
  const CARD_H = 180;

  // Layout notes organically inside a container
  function layoutBoard(container) {
    const notes = Array.from(container.querySelectorAll(".landing-note"));
    if (!notes.length) return;

    const cw = container.clientWidth;
    const cols = Math.max(2, Math.min(4, Math.floor(cw / (CARD_W + 30))));
    const totalW = cols * CARD_W;
    const gapX = (cw - totalW) / (cols + 1);
    const gapY = 25;

    notes.forEach((note, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const baseX = gapX + col * (CARD_W + gapX);
      const baseY = row * (CARD_H + gapY);
      // Random jitter
      const ox = (Math.random() - 0.5) * 50;
      const oy = (Math.random() - 0.5) * 35;
      const rot = (Math.random() - 0.5) * 7; // ±3.5 degrees

      const x = Math.max(0, Math.min(baseX + ox, cw - CARD_W));
      const y = Math.max(0, baseY + oy);

      note.style.left = `${x}px`;
      note.style.top = `${y}px`;
      note.style.transform = `rotate(${rot}deg)`;
      note.dataset.rot = rot;
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
});
