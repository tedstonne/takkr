// Landing page — draggable feature notes, no persistence

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("landing-features");
  if (!container) return;

  const notes = Array.from(container.querySelectorAll(".landing-note"));
  const CARD_W = 240;
  const CARD_H = 200;

  // Organic layout — scatter notes in a loose grid with random offsets and rotations
  const cols = Math.max(2, Math.min(4, Math.floor(container.clientWidth / (CARD_W + 40))));
  const gapX = (container.clientWidth - cols * CARD_W) / (cols + 1);
  const gapY = 30;

  notes.forEach((note, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    // Base position in grid
    const baseX = gapX + col * (CARD_W + gapX);
    const baseY = row * (CARD_H + gapY);
    // Random offset for organic feel
    const ox = (Math.random() - 0.5) * 40;
    const oy = (Math.random() - 0.5) * 30;
    // Random rotation
    const rot = (Math.random() - 0.5) * 5; // -2.5 to +2.5 degrees

    const x = Math.max(0, Math.min(baseX + ox, container.clientWidth - CARD_W));
    const y = Math.max(0, baseY + oy);

    note.style.left = `${x}px`;
    note.style.top = `${y}px`;
    note.style.transform = `rotate(${rot}deg)`;
    note.dataset.rot = rot;
    note.dataset.x = x;
    note.dataset.y = y;
  });

  // Set container height to fit all notes
  const maxBottom = notes.reduce((max, n) => {
    return Math.max(max, parseFloat(n.style.top) + CARD_H + 40);
  }, 0);
  container.style.minHeight = `${maxBottom}px`;

  // Drag support (no save)
  let dragging = null;
  let dragOffset = { x: 0, y: 0 };
  let dragMoved = false;

  const onDown = (e) => {
    const note = e.target.closest(".landing-note");
    if (!note) return;
    dragging = note;
    dragMoved = false;

    const rect = note.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragOffset.x = clientX - rect.left;
    dragOffset.y = clientY - rect.top;

    note.classList.add("dragging");
    note.style.transform = "rotate(0deg) scale(1.05)";
    e.preventDefault();
  };

  const onMove = (e) => {
    if (!dragging) return;
    dragMoved = true;

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const containerRect = container.getBoundingClientRect();

    let x = clientX - containerRect.left - dragOffset.x;
    let y = clientY - containerRect.top - dragOffset.y;
    x = Math.max(0, Math.min(x, container.clientWidth - CARD_W));
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
  };

  container.addEventListener("mousedown", onDown);
  container.addEventListener("touchstart", onDown, { passive: false });
  window.addEventListener("mousemove", onMove);
  window.addEventListener("touchmove", onMove, { passive: false });
  window.addEventListener("mouseup", onUp);
  window.addEventListener("touchend", onUp);
});
