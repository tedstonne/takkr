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

// Helper: format file size
function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

// Helper: format date
function formatDate(dateStr) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch (_) {
    return dateStr;
  }
}

// Color map for the color picker
const COLOR_MAP = {
  yellow: "bg-takkr-yellow",
  pink: "bg-takkr-pink",
  green: "bg-takkr-green",
  blue: "bg-takkr-blue",
  orange: "bg-takkr-orange",
};

// Zoom overlay controller
const zoom = {
  overlay: null,
  card: null,
  noteId: null,
  noteEl: null,
  color: null,
  isOpen: false,
  isFlipped: false,
  checklist: [],
  tags: [],
  attachments: [],

  init() {
    this.overlay = document.getElementById("zoom-overlay");
    this.card = document.getElementById("zoom-card");

    // Click backdrop to close
    this.overlay?.querySelector(".zoom-backdrop")?.addEventListener("click", () => this.close());

    // Close button (X)
    document.getElementById("zoom-close-btn")?.addEventListener("click", () => this.close());

    // Delete button
    document.getElementById("zoom-delete-btn")?.addEventListener("click", () => {
      if (this.noteId) {
        fetch(`/api/notes/${this.noteId}`, { method: "DELETE" });
        document.querySelector(`[data-id="${this.noteId}"]`)?.remove();
        this.close();
      }
    });

    // Color picker
    document.getElementById("zoom-back-colors")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-color]");
      if (!btn) return;
      const newColor = btn.dataset.color;
      this.changeColor(newColor);
    });

    // Checklist add
    document.getElementById("zoom-checklist-add-btn")?.addEventListener("click", () => this.addChecklistItem());
    document.getElementById("zoom-checklist-input")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); this.addChecklistItem(); }
    });

    // Tag input
    document.getElementById("zoom-tag-input")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        this.addTag();
      }
      if (e.key === "Backspace" && !e.target.value && this.tags.length > 0) {
        this.tags.pop();
        this.renderTags();
        this.saveTags();
      }
    });

    // File upload
    document.getElementById("zoom-file-input")?.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (file) this.uploadFile(file);
      e.target.value = "";
    });

    // Drag and drop on upload area
    const uploadBtn = document.getElementById("zoom-upload-btn");
    if (uploadBtn) {
      uploadBtn.addEventListener("dragover", (e) => { e.preventDefault(); uploadBtn.classList.add("dragover"); });
      uploadBtn.addEventListener("dragleave", () => uploadBtn.classList.remove("dragover"));
      uploadBtn.addEventListener("drop", (e) => {
        e.preventDefault();
        uploadBtn.classList.remove("dragover");
        const file = e.dataTransfer?.files?.[0];
        if (file) this.uploadFile(file);
      });
    }

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
    const author = noteEl.dataset.author || "";
    const created = noteEl.dataset.created || "";

    // Parse checklist & tags
    try { this.checklist = JSON.parse(noteEl.dataset.checklist || "[]"); } catch (_) { this.checklist = []; }
    this.tags = (noteEl.dataset.tags || "").split(",").map(t => t.trim()).filter(Boolean);

    // Set front
    document.getElementById("zoom-title").textContent = title;

    // Set back meta
    const meta = document.getElementById("zoom-back-meta");
    meta.textContent = `${author}${author && created ? " · " : ""}${formatDate(created)}`;

    // Set back title
    const backTitle = document.getElementById("zoom-back-title");
    backTitle.textContent = title;
    backTitle.dataset.placeholder = "Title...";

    // Set back description
    const backDesc = document.getElementById("zoom-back-description");
    if (description) {
      backDesc.innerHTML = this.renderMarkdown(description);
    } else {
      backDesc.innerHTML = "";
    }
    backDesc.dataset.rawContent = description;

    // Set color picker active state
    document.querySelectorAll("#zoom-back-colors .zoom-color-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.color === this.color);
    });

    // Render checklist
    this.renderChecklist();

    // Render tags
    this.renderTags();

    // Set colors on card
    const colorClass = `takkr-${this.color || "yellow"}`;
    this.card.className = `zoom-card ${colorClass}`;
    this.overlay.querySelector(".zoom-front").className = `zoom-front ${colorClass}`;
    this.overlay.querySelector(".zoom-back").className = `zoom-back ${colorClass}`;

    // Show and animate
    this.overlay.style.display = "flex";
    this.isOpen = true;
    this.isFlipped = false;

    this.overlay.offsetHeight;
    this.overlay.classList.add("active");

    // Load attachments from API
    this.loadAttachments();

    // Auto-flip to back
    setTimeout(() => this.flip(), 350);
  },

  flip() {
    this.isFlipped = !this.isFlipped;
    this.overlay.classList.toggle("flipped", this.isFlipped);

    if (this.isFlipped) {
      setTimeout(() => {
        const backTitle = document.getElementById("zoom-back-title");
        const backDesc = document.getElementById("zoom-back-description");
        backTitle.contentEditable = "true";
        backDesc.contentEditable = "true";

        backTitle.addEventListener("blur", () => this.save(), { once: false });
        backDesc.addEventListener("blur", () => this.saveDescription(), { once: false });

        backDesc.addEventListener("focus", () => {
          if (!backDesc.dataset.rawContent) backDesc.innerHTML = "";
        });
      }, 300);
    }
  },

  changeColor(newColor) {
    if (!this.noteId || !newColor) return;
    this.color = newColor;

    // Update UI
    document.querySelectorAll("#zoom-back-colors .zoom-color-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.color === newColor);
    });

    const colorClass = `takkr-${newColor}`;
    this.card.className = `zoom-card ${colorClass}`;
    this.overlay.querySelector(".zoom-front").className = `zoom-front ${colorClass}`;
    this.overlay.querySelector(".zoom-back").className = `zoom-back ${colorClass}`;

    // Update canvas card
    const noteEl = document.querySelector(`[data-id="${this.noteId}"]`);
    if (noteEl) {
      noteEl.className = noteEl.className.replace(/takkr-\w+/g, "").trim() + ` takkr-${newColor}`;
    }

    // Save
    fetch(`/api/notes/${this.noteId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `color=${encodeURIComponent(newColor)}`,
    });
  },

  // Checklist
  renderChecklist() {
    const container = document.getElementById("zoom-back-checklist");
    container.innerHTML = this.checklist.map((item, i) => `
      <div class="zoom-checklist-item" data-index="${i}">
        <input type="checkbox" ${item.done ? "checked" : ""} />
        <span class="${item.done ? "checked" : ""}">${this.escapeHtml(item.text)}</span>
        <span class="checklist-remove">✕</span>
      </div>
    `).join("");

    // Wire events
    container.querySelectorAll("input[type=checkbox]").forEach((cb) => {
      cb.addEventListener("change", (e) => {
        const idx = Number(e.target.closest("[data-index]").dataset.index);
        this.checklist[idx].done = e.target.checked;
        this.renderChecklist();
        this.saveChecklist();
      });
    });
    container.querySelectorAll(".checklist-remove").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const idx = Number(e.target.closest("[data-index]").dataset.index);
        this.checklist.splice(idx, 1);
        this.renderChecklist();
        this.saveChecklist();
      });
    });
  },

  addChecklistItem() {
    const input = document.getElementById("zoom-checklist-input");
    const text = input.value.trim();
    if (!text) return;
    this.checklist.push({ text, done: false });
    input.value = "";
    this.renderChecklist();
    this.saveChecklist();
  },

  saveChecklist() {
    if (!this.noteId) return;
    const json = JSON.stringify(this.checklist);
    const noteEl = document.querySelector(`[data-id="${this.noteId}"]`);
    if (noteEl) noteEl.dataset.checklist = json;

    fetch(`/api/notes/${this.noteId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `checklist=${encodeURIComponent(json)}`,
    });
  },

  // Tags
  renderTags() {
    const container = document.getElementById("zoom-back-tags");
    const input = document.getElementById("zoom-tag-input");

    // Remove existing tags (keep input)
    container.querySelectorAll(".zoom-tag").forEach((el) => el.remove());

    // Insert tags before input
    this.tags.forEach((tag, i) => {
      const el = document.createElement("span");
      el.className = "zoom-tag";
      el.innerHTML = `${this.escapeHtml(tag)}<span class="zoom-tag-remove" data-index="${i}">✕</span>`;
      container.insertBefore(el, input);
    });

    // Wire remove
    container.querySelectorAll(".zoom-tag-remove").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const idx = Number(e.target.dataset.index);
        this.tags.splice(idx, 1);
        this.renderTags();
        this.saveTags();
      });
    });
  },

  addTag() {
    const input = document.getElementById("zoom-tag-input");
    const tag = input.value.replace(",", "").trim();
    if (!tag || this.tags.includes(tag)) { input.value = ""; return; }
    this.tags.push(tag);
    input.value = "";
    this.renderTags();
    this.saveTags();
  },

  saveTags() {
    if (!this.noteId) return;
    const val = this.tags.join(",");
    const noteEl = document.querySelector(`[data-id="${this.noteId}"]`);
    if (noteEl) noteEl.dataset.tags = val;

    fetch(`/api/notes/${this.noteId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `tags=${encodeURIComponent(val)}`,
    });
  },

  // Attachments
  async loadAttachments() {
    if (!this.noteId) return;
    try {
      const res = await fetch(`/api/notes/${this.noteId}/attachments`);
      this.attachments = await res.json();
      this.renderAttachments();
    } catch (_) {
      this.attachments = [];
      this.renderAttachments();
    }
  },

  renderAttachments() {
    const container = document.getElementById("zoom-back-attachments");
    if (this.attachments.length === 0) {
      container.innerHTML = '<p class="text-xs text-black/30 italic">No attachments yet</p>';
      return;
    }

    container.innerHTML = this.attachments.map((att) => {
      const isImage = att.mime_type?.startsWith("image/");
      const thumb = isImage
        ? `<img src="/api/attachments/${att.id}" class="zoom-attachment-thumb" alt="" />`
        : `<div class="zoom-attachment-thumb flex items-center justify-center bg-black/10 text-black/40 text-xs">📄</div>`;

      return `
        <div class="zoom-attachment-item" data-att-id="${att.id}">
          ${thumb}
          <div class="zoom-attachment-info">
            <div class="zoom-attachment-name">${this.escapeHtml(att.filename)}</div>
            <div class="zoom-attachment-size">${formatSize(att.size)}</div>
          </div>
          <span class="zoom-attachment-remove" data-att-id="${att.id}">✕</span>
        </div>
      `;
    }).join("");

    // Wire delete
    container.querySelectorAll(".zoom-attachment-remove").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const attId = e.target.dataset.attId;
        await fetch(`/api/attachments/${attId}`, { method: "DELETE" });
        this.attachments = this.attachments.filter((a) => String(a.id) !== attId);
        this.renderAttachments();
        this.updateAttachmentBadge();
      });
    });
  },

  async uploadFile(file) {
    if (!this.noteId) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("File too large (max 5MB)");
      return;
    }

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch(`/api/notes/${this.noteId}/attachments`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) { alert("Upload failed"); return; }
      const att = await res.json();
      this.attachments.push(att);
      this.renderAttachments();
      this.updateAttachmentBadge();
    } catch (_) {
      alert("Upload failed");
    }
  },

  updateAttachmentBadge() {
    const noteEl = document.querySelector(`[data-id="${this.noteId}"]`);
    if (!noteEl) return;
    const count = this.attachments.length;
    let badge = noteEl.querySelector(".takkr-attachments");
    if (count > 0) {
      if (!badge) {
        badge = document.createElement("div");
        badge.className = "takkr-attachments";
        noteEl.appendChild(badge);
      }
      badge.innerHTML = `
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
        </svg>
        <span>${count}</span>
      `;
    } else if (badge) {
      badge.remove();
    }
  },

  save() {
    if (!this.noteId) return;
    const backTitle = document.getElementById("zoom-back-title");
    const newTitle = backTitle.textContent.trim();
    if (!newTitle) return;

    const noteEl = document.querySelector(`[data-id="${this.noteId}"]`);
    if (noteEl) noteEl.querySelector(".takkr-title").textContent = newTitle;

    document.getElementById("zoom-title").textContent = newTitle;

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
    backDesc.dataset.rawContent = text;

    const noteEl = document.querySelector(`[data-id="${this.noteId}"]`);
    if (noteEl) noteEl.dataset.description = text;

    fetch(`/api/notes/${this.noteId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `description=${encodeURIComponent(text)}`,
    });
  },

  renderMarkdown(text) {
    if (!text) return "";
    return text
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" class="underline">$1</a>')
      .replace(/^[-*] (.+)$/gm, "<li>$1</li>")
      .replace(/(<li>.*<\/li>)/s, "<ul class='list-disc pl-4'>$1</ul>")
      .replace(/\n/g, "<br>");
  },

  escapeHtml(text) {
    const el = document.createElement("span");
    el.textContent = text;
    return el.innerHTML;
  },

  close() {
    if (!this.isOpen) return;

    const backTitle = document.getElementById("zoom-back-title");
    const backDesc = document.getElementById("zoom-back-description");
    backTitle.contentEditable = "false";
    backDesc.contentEditable = "false";

    this.save();
    this.saveDescription();

    // Step 1: unflip back to front (if flipped)
    const wasFlipped = this.isFlipped;
    if (wasFlipped) {
      this.overlay.classList.remove("flipped");
      this.isFlipped = false;
    }

    // Step 2: after unflip completes, shrink away
    const shrinkDelay = wasFlipped ? 500 : 50;
    setTimeout(() => {
      this.overlay.classList.add("closing");
      this.overlay.classList.remove("active");

      // Step 3: clean up after shrink animation
      setTimeout(() => {
        this.overlay.style.display = "none";
        this.overlay.classList.remove("closing");
        this.overlay.querySelector(".zoom-front").className = "zoom-front";
        this.overlay.querySelector(".zoom-back").className = "zoom-back";
        this.isOpen = false;
        this.noteId = null;
        this.noteEl = null;
        this.checklist = [];
        this.tags = [];
        this.attachments = [];
      }, 350);
    }, shrinkDelay);
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
    this.setupFileDrop();
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

  setupFileDrop() {
    const canvas = document.getElementById("canvas");
    let hoveredNote = null;

    // Detect file drag (not note drag) by checking dataTransfer types
    const isFileDrag = (e) => e.dataTransfer?.types?.includes("Files");

    canvas.addEventListener("dragenter", (e) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
    });

    canvas.addEventListener("dragover", (e) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";

      const note = e.target.closest(".takkr");
      if (note !== hoveredNote) {
        hoveredNote?.classList.remove("file-hover");
        hoveredNote = note;
        hoveredNote?.classList.add("file-hover");
      }
    });

    canvas.addEventListener("dragleave", (e) => {
      if (!isFileDrag(e)) return;
      // Only clear if we actually left the canvas
      if (!canvas.contains(e.relatedTarget)) {
        hoveredNote?.classList.remove("file-hover");
        hoveredNote = null;
      }
    });

    canvas.addEventListener("drop", async (e) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();

      const note = e.target.closest(".takkr");
      hoveredNote?.classList.remove("file-hover");
      hoveredNote = null;

      if (!note) return;

      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;

      const noteId = note.dataset.id;

      // Upload each file (show uploading state)
      note.classList.add("uploading");

      for (const file of files) {
        if (file.size > 5 * 1024 * 1024) continue; // skip >5MB silently

        const form = new FormData();
        form.append("file", file);

        try {
          const res = await fetch(`/api/notes/${noteId}/attachments`, {
            method: "POST",
            body: form,
          });
          if (!res.ok) continue;
        } catch (_) {
          continue;
        }
      }

      note.classList.remove("uploading");

      // Refresh attachment badge
      try {
        const res = await fetch(`/api/notes/${noteId}/attachments`);
        const atts = await res.json();
        const count = atts.length;
        let badge = note.querySelector(".takkr-attachments");
        if (count > 0) {
          if (!badge) {
            badge = document.createElement("div");
            badge.className = "takkr-attachments";
            note.appendChild(badge);
          }
          badge.innerHTML = `
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            <span>${count}</span>
          `;
        }
      } catch (_) {}
    });
  },

  setupDragAndDrop() {
    const canvas = document.getElementById("canvas");

    const preventScroll = (e) => {
      if (this.dragging) { e.preventDefault(); window.scrollTo(0, 0); }
    };

    canvas.addEventListener("pointerdown", (e) => {
      const note = e.target.closest(".takkr");
      if (!note) return;
      if (e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT") return;

      e.preventDefault();
      this.dragging = note;
      this.dragMoved = false;
      note.classList.add("dragging");
      note.setPointerCapture(e.pointerId);

      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
      window.addEventListener("scroll", preventScroll, { passive: false });

      const rect = note.getBoundingClientRect();
      this.dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };

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

      let x = e.clientX - canvasRect.left - this.dragOffset.x + canvas.scrollLeft;
      let y = e.clientY - canvasRect.top - this.dragOffset.y + canvas.scrollTop;
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
        fetch(`/api/notes/${note.dataset.id}?silent=1`, {
          method: "PUT",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `x=${x}&y=${y}`,
        });
      }

      note.classList.remove("dragging");
      this.dragging = null;

      if (!moved) zoom.open(note);
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
    if (e.target.contentEditable === "true") {
      if (e.key === "Escape") e.target.blur();
      return;
    }
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
          fetch(`/api/notes/${this.selected.dataset.id}`, { method: "DELETE" });
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
        if (this.selected) zoom.open(this.selected);
        break;
      case "ArrowUp": e.preventDefault(); this.selectNearest("up"); break;
      case "ArrowDown": e.preventDefault(); this.selectNearest("down"); break;
      case "ArrowLeft": e.preventDefault(); this.selectNearest("left"); break;
      case "ArrowRight": e.preventDefault(); this.selectNearest("right"); break;
    }
  },

  selectNext(direction) {
    const notes = Array.from(document.querySelectorAll(".takkr"));
    if (notes.length === 0) return;
    if (!this.selected) { this.select(notes[0]); return; }
    const currentIndex = notes.indexOf(this.selected);
    let nextIndex = currentIndex + direction;
    if (nextIndex < 0) nextIndex = notes.length - 1;
    if (nextIndex >= notes.length) nextIndex = 0;
    this.select(notes[nextIndex]);
  },

  selectNearest(direction) {
    const notes = Array.from(document.querySelectorAll(".takkr"));
    if (notes.length === 0) return;
    if (!this.selected) { this.select(notes[0]); return; }

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
        case "up": valid = y < current.y; break;
        case "down": valid = y > current.y; break;
        case "left": valid = x < current.x; break;
        case "right": valid = x > current.x; break;
      }

      if (valid) {
        const distance = Math.sqrt((x - current.x) ** 2 + (y - current.y) ** 2);
        if (distance < minDistance) { minDistance = distance; nearest = note; }
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
