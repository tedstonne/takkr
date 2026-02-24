// Note dialog component
window.noteDialog = () => ({
  open: false,

  init() {
    // Listen for add-note button click
    document.getElementById("add-note-btn")?.addEventListener("click", () => {
      this.show();
    });

    // Close on htmx success
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

// Board canvas functionality
window.board = () => ({
  selected: null,
  dragging: null,
  dragOffset: { x: 0, y: 0 },

  init() {
    this.setupDragAndDrop();
    this.setupButtonHandlers();
    this.setupKeyboard();
  },

  setupButtonHandlers() {
    // Help button
    document.getElementById("help-btn")?.addEventListener("click", () => {
      document.getElementById("help-modal")?.showModal();
    });

    // Members button
    document.getElementById("members-btn")?.addEventListener("click", () => {
      document.getElementById("members-modal")?.showModal();
    });
  },

  setupKeyboard() {
    window.addEventListener("keydown", (e) => this.handleKey(e));
  },

  setupDragAndDrop() {
    const canvas = document.getElementById("canvas");

    // Prevent any scroll during drag
    const preventScroll = (e) => {
      if (this.dragging) {
        e.preventDefault();
        window.scrollTo(0, 0);
      }
    };

    // Pointer-based drag (works for mouse and touch)
    canvas.addEventListener("pointerdown", (e) => {
      const note = e.target.closest(".takkr");
      if (!note) return;

      // Don't start drag if clicking on textarea (editing)
      if (e.target.tagName === "TEXTAREA") return;

      e.preventDefault();
      this.dragging = note;
      note.classList.add("dragging");
      note.setPointerCapture(e.pointerId);

      // Prevent page scrolling during drag
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

      const canvasRect = canvas.getBoundingClientRect();
      const noteWidth = this.dragging.offsetWidth;
      const noteHeight = this.dragging.offsetHeight;

      // Calculate position relative to canvas
      let x =
        e.clientX - canvasRect.left - this.dragOffset.x + canvas.scrollLeft;
      let y = e.clientY - canvasRect.top - this.dragOffset.y + canvas.scrollTop;

      // Constrain within canvas bounds
      x = Math.max(0, Math.min(x, canvas.scrollWidth - noteWidth));
      y = Math.max(0, Math.min(y, canvas.scrollHeight - noteHeight));

      this.dragging.style.left = `${x}px`;
      this.dragging.style.top = `${y}px`;
    });

    canvas.addEventListener("pointerup", () => {
      if (!this.dragging) return;

      // Re-enable page scrolling
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
      window.removeEventListener("scroll", preventScroll);

      const x = parseInt(this.dragging.style.left, 10) || 0;
      const y = parseInt(this.dragging.style.top, 10) || 0;

      this.dragging.dataset.x = x;
      this.dragging.dataset.y = y;

      // Save position to server (skip broadcast to avoid SSE issues)
      const noteId = this.dragging.dataset.id;
      fetch(`/api/notes/${noteId}?silent=1`, {
        method: "PUT",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `x=${x}&y=${y}`,
      });

      this.dragging.classList.remove("dragging");
      this.dragging = null;
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

    // Click to select
    canvas.addEventListener("click", (e) => {
      const note = e.target.closest(".takkr");

      if (this.selected) {
        this.selected.classList.remove("selected");
      }

      if (note) {
        note.classList.add("selected");
        note.focus();
        this.selected = note;
      } else {
        this.selected = null;
      }
    });

    // Double click to edit
    canvas.addEventListener("dblclick", (e) => {
      const note = e.target.closest(".takkr");
      if (note) this.edit(note);
    });
  },

  handleKey(e) {
    // Don't handle if in input/textarea
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
      if (e.key === "Escape") {
        e.target.blur();
      }
      return;
    }

    // Don't handle if dialog is open
    const openDialog = document.querySelector("dialog[open]");
    if (openDialog) {
      if (e.key === "Escape") {
        openDialog.close();
      }
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

      case " ":
        e.preventDefault();
        if (this.selected) {
          this.selected.classList.toggle("flipped");
        }
        break;

      case "Enter":
        e.preventDefault();
        if (this.selected) {
          this.edit(this.selected);
        }
        break;

      case "Delete":
      case "Backspace":
        e.preventDefault();
        if (this.selected) {
          this.delete(this.selected);
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

  edit(note) {
    const front = note.querySelector(".takkr-front p");
    const content = front.textContent;

    note.classList.add("editing");
    front.innerHTML = `<textarea>${content}</textarea>`;

    const textarea = front.querySelector("textarea");
    textarea.focus();
    textarea.select();

    const save = () => {
      const newContent = textarea.value.trim();
      if (newContent && newContent !== content) {
        fetch(`/api/notes/${note.dataset.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `content=${encodeURIComponent(newContent)}`,
        });
      }
      front.innerHTML = `<p>${newContent || content}</p>`;
      note.classList.remove("editing");
    };

    textarea.addEventListener("blur", save);
    textarea.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        front.innerHTML = `<p>${content}</p>`;
        note.classList.remove("editing");
      } else if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        save();
      }
    });
  },

  delete(note) {
    const noteId = note.dataset.id;

    fetch(`/api/notes/${noteId}`, { method: "DELETE" });

    note.remove();

    if (this.selected === note) {
      this.selected = null;
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

      // Check direction
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
        const distance = Math.sqrt((x - current.x) ** 2 + (y - current.y) ** 2);
        if (distance < minDistance) {
          minDistance = distance;
          nearest = note;
        }
      }
    }

    if (nearest) {
      this.select(nearest);
    }
  },

  select(note) {
    if (this.selected) {
      this.selected.classList.remove("selected");
    }
    note.classList.add("selected");
    note.focus();
    this.selected = note;

    // Scroll into view if needed
    note.scrollIntoView({ behavior: "smooth", block: "nearest" });
  },
});
