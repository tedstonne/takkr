// Font map for CSS variable
const FONT_MAP = {
  caveat: "Caveat",
  "indie-flower": "Indie Flower",
  kalam: "Kalam",
  parisienne: "Parisienne",
  cookie: "Cookie",
  handlee: "Handlee",
  sofia: "Sofia",
  "gochi-hand": "Gochi Hand",
  "grand-hotel": "Grand Hotel",
};

// Set font CSS variable from body data attribute or cookie
const font = document.body.dataset.font || "caveat";
document.documentElement.style.setProperty(
  "--takkr-font",
  `"${FONT_MAP[font] || "Caveat"}"`,
);

// Note dialog component
window.noteDialog = () => ({
  open: false,

  init() {
    document.getElementById("add-note-btn")?.addEventListener("click", () => {
      this.show();
    });

    this.$refs.form?.addEventListener("htmx:afterRequest", (e) => {
      if (e.detail.successful) {
        this.close();
      }
    });
  },

  show() {
    this.open = true;
    this.$el.showModal();
    this.$nextTick(() => this.$refs.content?.focus());
  },

  close() {
    this.open = false;
    this.$el.close();
    this.$refs.form?.reset();
  },
});

// Zoom overlay controller
const zoom = {
  overlay: null,
  card: null,
  noteId: null,
  noteEl: null,
  color: null,
  isOpen: false,
  isFlipped: false,
  isDirty: false,

  init() {
    this.overlay = document.getElementById("zoom-overlay");
    this.card = document.getElementById("zoom-card");

    // Click backdrop to close
    this.overlay
      ?.querySelector(".zoom-backdrop")
      ?.addEventListener("click", () => this.close());

    // Delete button
    document
      .getElementById("zoom-delete-btn")
      ?.addEventListener("click", () => {
        if (this.noteId) {
          fetch(`/api/notes/${this.noteId}`, { method: "DELETE" });
          document.querySelector(`[data-id="${this.noteId}"]`)?.remove();
          this.close();
        }
      });

    // Escape to close
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.isOpen) {
        e.preventDefault();
        e.stopPropagation();
        this.close();
      }
    });
  },

  open(noteEl) {
    this.noteEl = noteEl;
    this.noteId = noteEl.dataset.id;
    this.color = Array.from(noteEl.classList)
      .find((c) => c.startsWith("takkr-") && c !== "takkr")
      ?.replace("takkr-", "");

    const title = noteEl.querySelector(".takkr-title")?.textContent || "";
    const description = noteEl.dataset.description || "";

    // Set front
    const zoomTitle = document.getElementById("zoom-title");
    zoomTitle.textContent = title;

    // Set back
    const backTitle = document.getElementById("zoom-back-title");
    backTitle.textContent = title;
    backTitle.dataset.placeholder = "Title...";

    const backDesc = document.getElementById("zoom-back-description");
    if (description) {
      backDesc.innerHTML = this.renderMarkdown(description);
    } else {
      backDesc.innerHTML =
        '<p class="text-black/30 text-sm italic">Click to add details...</p>';
    }
    backDesc.dataset.placeholder = "Add details, notes, links...";
    backDesc.dataset.rawContent = description;

    // Set colors
    const colorClass = `takkr-${this.color || "yellow"}`;
    this.card.className = `zoom-card ${colorClass}`;
    this.overlay
      .querySelector(".zoom-front")
      .classList.add(colorClass);
    this.overlay
      .querySelector(".zoom-back")
      .classList.add(colorClass);

    // Show and animate
    this.overlay.style.display = "flex";
    this.isOpen = true;
    this.isFlipped = false;
    this.isDirty = false;

    // Trigger reflow then add active class for animation
    this.overlay.offsetHeight;
    this.overlay.classList.add("active");

    // Auto-flip to back after zoom-in completes
    setTimeout(() => {
      this.flip();
    }, 350);
  },

  flip() {
    this.isFlipped = !this.isFlipped;
    this.overlay.classList.toggle("flipped", this.isFlipped);

    if (this.isFlipped) {
      // Enable editing on back side after flip
      setTimeout(() => {
        const backTitle = document.getElementById("zoom-back-title");
        const backDesc = document.getElementById("zoom-back-description");
        backTitle.contentEditable = "true";
        backDesc.contentEditable = "true";

        // Save on blur
        backTitle.addEventListener("blur", () => this.save(), { once: false });
        backDesc.addEventListener("blur", () => this.saveDescription(), {
          once: false,
        });

        // Clear placeholder content on focus for description
        backDesc.addEventListener("focus", () => {
          if (!backDesc.dataset.rawContent) {
            backDesc.innerHTML = "";
          }
        });
      }, 300);
    }
  },

  save() {
    if (!this.noteId) return;
    const backTitle = document.getElementById("zoom-back-title");
    const newTitle = backTitle.textContent.trim();
    if (!newTitle) return;

    // Update front title on the canvas card
    const noteEl = document.querySelector(`[data-id="${this.noteId}"]`);
    if (noteEl) {
      noteEl.querySelector(".takkr-title").textContent = newTitle;
    }

    // Update zoom front
    document.getElementById("zoom-title").textContent = newTitle;

    // Save to server
    fetch(`/api/notes/${this.noteId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `content=${encodeURIComponent(newTitle)}`,
    });
  },

  saveDescription() {
    if (!this.noteId) return;
    const backDesc = document.getElementById("zoom-back-description");
    const text = backDesc.innerText.trim();

    // Store raw content
    backDesc.dataset.rawContent = text;

    // Update data attribute on canvas card
    const noteEl = document.querySelector(`[data-id="${this.noteId}"]`);
    if (noteEl) {
      noteEl.dataset.description = text;
    }

    // Save to server
    fetch(`/api/notes/${this.noteId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `description=${encodeURIComponent(text)}`,
    });
  },

  renderMarkdown(text) {
    if (!text) return "";
    // Simple markdown: bold, italic, lists, links
    return text
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" class="underline">$1</a>')
      .replace(/^[-*] (.+)$/gm, "<li>$1</li>")
      .replace(/(<li>.*<\/li>)/s, "<ul class='list-disc pl-4'>$1</ul>")
      .replace(/\n/g, "<br>");
  },

  close() {
    if (!this.isOpen) return;

    // Disable editing
    const backTitle = document.getElementById("zoom-back-title");
    const backDesc = document.getElementById("zoom-back-description");
    backTitle.contentEditable = "false";
    backDesc.contentEditable = "false";

    // Save any pending edits
    this.save();
    this.saveDescription();

    // Reverse animation: unflip first
    if (this.isFlipped) {
      this.overlay.classList.remove("flipped");
      this.isFlipped = false;
    }

    // Then shrink
    setTimeout(() => {
      this.overlay.classList.remove("active");

      // Hide after animation
      setTimeout(() => {
        this.overlay.style.display = "none";
        // Clean color classes
        const front = this.overlay.querySelector(".zoom-front");
        const back = this.overlay.querySelector(".zoom-back");
        front.className = "zoom-front";
        back.className = "zoom-back";
        this.isOpen = false;
        this.noteId = null;
        this.noteEl = null;
      }, 350);
    }, 300);
  },
};

// Board canvas functionality
window.board = () => ({
  selected: null,
  dragging: null,
  dragOffset: { x: 0, y: 0 },
  dragMoved: false,

  init() {
    zoom.init();
    this.setupDragAndDrop();
    this.setupButtonHandlers();
    this.setupKeyboard();
  },

  setupButtonHandlers() {
    document.getElementById("help-btn")?.addEventListener("click", () => {
      document.getElementById("help-modal")?.showModal();
    });

    document.getElementById("members-btn")?.addEventListener("click", () => {
      document.getElementById("members-modal")?.showModal();
    });
  },

  setupKeyboard() {
    window.addEventListener("keydown", (e) => this.handleKey(e));
  },

  setupDragAndDrop() {
    const canvas = document.getElementById("canvas");

    const preventScroll = (e) => {
      if (this.dragging) {
        e.preventDefault();
        window.scrollTo(0, 0);
      }
    };

    // Pointer-based drag
    canvas.addEventListener("pointerdown", (e) => {
      const note = e.target.closest(".takkr");
      if (!note) return;
      if (e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT")
        return;

      e.preventDefault();
      this.dragging = note;
      this.dragMoved = false;
      note.classList.add("dragging");
      note.setPointerCapture(e.pointerId);

      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
      window.addEventListener("scroll", preventScroll, { passive: false });

      const rect = note.getBoundingClientRect();
      this.dragOffset = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };

      // Bring to front
      const maxZ = Math.max(
        ...Array.from(document.querySelectorAll(".takkr")).map(
          (n) => parseInt(n.style.zIndex, 10) || 1,
        ),
      );
      note.style.zIndex = maxZ + 1;
    });

    canvas.addEventListener("pointermove", (e) => {
      if (!this.dragging) return;
      e.preventDefault();
      this.dragMoved = true;

      const canvasRect = canvas.getBoundingClientRect();
      const noteWidth = this.dragging.offsetWidth;
      const noteHeight = this.dragging.offsetHeight;

      let x =
        e.clientX - canvasRect.left - this.dragOffset.x + canvas.scrollLeft;
      let y =
        e.clientY - canvasRect.top - this.dragOffset.y + canvas.scrollTop;

      x = Math.max(0, Math.min(x, canvas.scrollWidth - noteWidth));
      y = Math.max(0, Math.min(y, canvas.scrollHeight - noteHeight));

      this.dragging.style.left = `${x}px`;
      this.dragging.style.top = `${y}px`;
    });

    canvas.addEventListener("pointerup", (e) => {
      if (!this.dragging) return;
      const note = this.dragging;
      const moved = this.dragMoved;

      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
      window.removeEventListener("scroll", preventScroll);

      const x = parseInt(note.style.left, 10) || 0;
      const y = parseInt(note.style.top, 10) || 0;

      note.dataset.x = x;
      note.dataset.y = y;

      if (moved) {
        const noteId = note.dataset.id;
        fetch(`/api/notes/${noteId}?silent=1`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: `x=${x}&y=${y}`,
        });
      }

      note.classList.remove("dragging");
      this.dragging = null;

      // If not dragged, treat as click → zoom
      if (!moved) {
        zoom.open(note);
      }
    });

    canvas.addEventListener("pointercancel", () => {
      if (this.dragging) {
        document.body.style.overflow = "";
        document.documentElement.style.overflow = "";
        window.removeEventListener("scroll", preventScroll);
        this.dragging.classList.remove("dragging");
        this.dragging = null;
      }
    });
  },

  handleKey(e) {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
      if (e.key === "Escape") e.target.blur();
      return;
    }

    // Don't handle keys if contenteditable is focused
    if (e.target.contentEditable === "true") {
      if (e.key === "Escape") e.target.blur();
      return;
    }

    // Don't handle if zoom is open (it has its own escape handler)
    if (zoom.isOpen) return;

    const openDialog = document.querySelector("dialog[open]");
    if (openDialog) {
      if (e.key === "Escape") openDialog.close();
      return;
    }

    switch (e.key) {
      case "n":
        e.preventDefault();
        document.getElementById("add-note-dialog")?.showModal();
        break;

      case "?":
        e.preventDefault();
        document.getElementById("help-modal")?.showModal();
        break;

      case "Delete":
      case "Backspace":
        e.preventDefault();
        if (this.selected) {
          const noteId = this.selected.dataset.id;
          fetch(`/api/notes/${noteId}`, { method: "DELETE" });
          this.selected.remove();
          this.selected = null;
        }
        break;

      case "Escape":
        if (this.selected) {
          this.selected.classList.remove("selected");
          this.selected = null;
        }
        break;

      case "Tab":
        e.preventDefault();
        this.selectNext(e.shiftKey ? -1 : 1);
        break;

      case "Enter":
        e.preventDefault();
        if (this.selected) {
          zoom.open(this.selected);
        }
        break;

      case "ArrowUp":
        e.preventDefault();
        this.selectNearest("up");
        break;
      case "ArrowDown":
        e.preventDefault();
        this.selectNearest("down");
        break;
      case "ArrowLeft":
        e.preventDefault();
        this.selectNearest("left");
        break;
      case "ArrowRight":
        e.preventDefault();
        this.selectNearest("right");
        break;
    }
  },

  selectNext(direction) {
    const notes = Array.from(document.querySelectorAll(".takkr"));
    if (notes.length === 0) return;

    if (!this.selected) {
      this.select(notes[0]);
      return;
    }

    const currentIndex = notes.indexOf(this.selected);
    let nextIndex = currentIndex + direction;

    if (nextIndex < 0) nextIndex = notes.length - 1;
    if (nextIndex >= notes.length) nextIndex = 0;

    this.select(notes[nextIndex]);
  },

  selectNearest(direction) {
    const notes = Array.from(document.querySelectorAll(".takkr"));
    if (notes.length === 0) return;

    if (!this.selected) {
      this.select(notes[0]);
      return;
    }

    const current = {
      x: parseInt(this.selected.dataset.x, 10) || 0,
      y: parseInt(this.selected.dataset.y, 10) || 0,
    };

    let nearest = null;
    let minDistance = Number.POSITIVE_INFINITY;

    for (const note of notes) {
      if (note === this.selected) continue;

      const x = parseInt(note.dataset.x, 10) || 0;
      const y = parseInt(note.dataset.y, 10) || 0;

      let valid = false;
      switch (direction) {
        case "up":
          valid = y < current.y;
          break;
        case "down":
          valid = y > current.y;
          break;
        case "left":
          valid = x < current.x;
          break;
        case "right":
          valid = x > current.x;
          break;
      }

      if (valid) {
        const distance = Math.sqrt(
          (x - current.x) ** 2 + (y - current.y) ** 2,
        );
        if (distance < minDistance) {
          minDistance = distance;
          nearest = note;
        }
      }
    }

    if (nearest) this.select(nearest);
  },

  select(note) {
    if (this.selected) this.selected.classList.remove("selected");
    note.classList.add("selected");
    note.focus();
    this.selected = note;
    note.scrollIntoView({ behavior: "smooth", block: "nearest" });
  },
});
