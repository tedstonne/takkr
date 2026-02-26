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

    // Inject viewport-center position into form
    const canvas = document.getElementById("canvas");
    if (canvas && this.$refs.form) {
      const boardComp = Alpine.$data(canvas);
      const z = boardComp?.zoomLevel || 1;
      const cx = (canvas.scrollLeft + canvas.clientWidth / 2) / z;
      const cy = (canvas.scrollTop + canvas.clientHeight / 2) / z;
      // Small random offset so sequential cards don't stack exactly
      const ox = (Math.random() - 0.5) * 60;
      const oy = (Math.random() - 0.5) * 60;
      const x = Math.max(20, Math.round(cx + ox));
      const y = Math.max(20, Math.round(cy + oy));

      // Remove old hidden inputs if any, then add fresh ones
      this.$refs.form.querySelectorAll("input[name=x], input[name=y]").forEach(el => el.remove());
      const ix = Object.assign(document.createElement("input"), { type: "hidden", name: "x", value: x });
      const iy = Object.assign(document.createElement("input"), { type: "hidden", name: "y", value: y });
      this.$refs.form.append(ix, iy);
    }

    this.$el.showModal();
    this.$nextTick(() => this.$refs.content?.focus());
  },

  close() {
    this.open = false;
    this.$el.close();
    this.$refs.form?.reset();
    // Remove injected position inputs
    this.$refs.form?.querySelectorAll("input[name=x], input[name=y]").forEach(el => el.remove());
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
        backTitle.addEventListener("input", () => {
          const MAX_CHARS = 80;
          if (backTitle.textContent.length > MAX_CHARS) {
            backTitle.textContent = backTitle.textContent.slice(0, MAX_CHARS);
            // Move cursor to end
            const sel = window.getSelection();
            sel.selectAllChildren(backTitle);
            sel.collapseToEnd();
          }
        });
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

// Zoom levels
const ZOOM_LEVELS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

// Board canvas functionality
window.board = () => ({
  selected: null,
  dragging: null,
  dragOffset: { x: 0, y: 0 },
  dragMoved: false,
  zoomLevel: 1,
  _viewportSaveTimer: null,
  _zoomIndicatorTimer: null,

  init() {
    zoom.init();
    this.setupDragAndDrop();
    this.setupFileDrop();
    this.setupButtonHandlers();
    this.setupKeyboard();
    this.setupZoom();
    this.loadViewport();
  },

  // --- Zoom ---
  setupZoom() {
    const canvas = document.getElementById("canvas");

    // Pinch-to-zoom (ctrl+wheel = trackpad pinch on most browsers)
    canvas.addEventListener("wheel", (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (e.deltaY < 0) this.zoomIn(e);
        else this.zoomOut(e);
      }
    }, { passive: false });
  },

  _applyZoom(oldZoom, pivotClientX, pivotClientY) {
    const canvas = document.getElementById("canvas");
    const notes = document.getElementById("notes");
    if (!canvas || !notes) return;

    const newZoom = this.zoomLevel;
    notes.style.transform = `scale(${newZoom})`;
    notes.style.transformOrigin = "0 0";

    // Adjust scroll to keep pivot point stable
    if (pivotClientX != null && oldZoom !== newZoom) {
      const rect = canvas.getBoundingClientRect();
      const px = (canvas.scrollLeft + pivotClientX - rect.left) / oldZoom;
      const py = (canvas.scrollTop + pivotClientY - rect.top) / oldZoom;
      canvas.scrollLeft = px * newZoom - (pivotClientX - rect.left);
      canvas.scrollTop = py * newZoom - (pivotClientY - rect.top);
    }

    this.showZoomIndicator();
    this.debounceSaveViewport();
  },

  zoomIn(e) {
    const old = this.zoomLevel;
    const idx = ZOOM_LEVELS.indexOf(this.zoomLevel);
    if (idx < ZOOM_LEVELS.length - 1) {
      this.zoomLevel = ZOOM_LEVELS[idx + 1];
    } else if (idx === -1) {
      // find next level above current
      this.zoomLevel = ZOOM_LEVELS.find(z => z > old) || ZOOM_LEVELS[ZOOM_LEVELS.length - 1];
    }
    const cx = e ? e.clientX : window.innerWidth / 2;
    const cy = e ? e.clientY : window.innerHeight / 2;
    this._applyZoom(old, cx, cy);
  },

  zoomOut(e) {
    const old = this.zoomLevel;
    const idx = ZOOM_LEVELS.indexOf(this.zoomLevel);
    if (idx > 0) {
      this.zoomLevel = ZOOM_LEVELS[idx - 1];
    } else if (idx === -1) {
      this.zoomLevel = [...ZOOM_LEVELS].reverse().find(z => z < old) || ZOOM_LEVELS[0];
    }
    const cx = e ? e.clientX : window.innerWidth / 2;
    const cy = e ? e.clientY : window.innerHeight / 2;
    this._applyZoom(old, cx, cy);
  },

  zoomReset() {
    const old = this.zoomLevel;
    this.zoomLevel = 1;
    this._applyZoom(old, window.innerWidth / 2, window.innerHeight / 2);
  },

  showZoomIndicator() {
    const el = document.getElementById("zoom-indicator");
    if (!el) return;
    el.textContent = `${Math.round(this.zoomLevel * 100)}%`;
    el.style.opacity = "1";
    clearTimeout(this._zoomIndicatorTimer);
    this._zoomIndicatorTimer = setTimeout(() => { el.style.opacity = "0"; }, 2000);
  },

  // --- Viewport persistence ---
  _boardSlug() {
    return window.location.pathname.slice(1);
  },

  debounceSaveViewport() {
    clearTimeout(this._viewportSaveTimer);
    this._viewportSaveTimer = setTimeout(() => this.saveViewport(), 1000);
  },

  saveViewport() {
    const canvas = document.getElementById("canvas");
    if (!canvas) return;
    const slug = this._boardSlug();
    fetch(`/api/boards/${slug}/viewport`, {
      method: "PUT",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `zoom=${this.zoomLevel}&scroll_x=${canvas.scrollLeft}&scroll_y=${canvas.scrollTop}`,
    });
  },

  async loadViewport() {
    const slug = this._boardSlug();
    try {
      const res = await fetch(`/api/boards/${slug}/viewport`);
      if (!res.ok) return;
      const vp = await res.json();
      if (vp.zoom && vp.zoom !== 1) {
        this.zoomLevel = vp.zoom;
        const notes = document.getElementById("notes");
        if (notes) {
          notes.style.transform = `scale(${this.zoomLevel})`;
          notes.style.transformOrigin = "0 0";
        }
      }
      const canvas = document.getElementById("canvas");
      if (canvas && (vp.scroll_x || vp.scroll_y)) {
        canvas.scrollLeft = vp.scroll_x;
        canvas.scrollTop = vp.scroll_y;
      }
    } catch (_) {}

    // Also save viewport on scroll (debounced)
    const canvas = document.getElementById("canvas");
    if (canvas) {
      canvas.addEventListener("scroll", () => this.debounceSaveViewport());
    }
  },

  setupButtonHandlers() {
    document.getElementById("help-btn")?.addEventListener("click", () => {
      document.getElementById("help-modal")?.showModal();
    });
    document.getElementById("members-btn")?.addEventListener("click", () => {
      document.getElementById("members-modal")?.showModal();
    });

    // Settings (user avatar)
    document.getElementById("settings-btn")?.addEventListener("click", () => {
      document.getElementById("settings-modal")?.showModal();
    });

    // Avatar upload
    document.getElementById("avatar-file-input")?.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) { alert("Image too large (max 2MB)"); return; }
      if (!file.type.startsWith("image/")) { alert("Must be an image"); return; }

      const form = new FormData();
      form.append("file", file);

      try {
        const res = await fetch("/api/user/avatar", { method: "POST", body: form });
        if (!res.ok) { alert("Upload failed"); return; }
        const data = await res.json();

        // Update avatar in settings modal
        const label = document.getElementById("avatar-label");
        const initials = document.getElementById("settings-avatar-initials");
        const existing = document.getElementById("settings-avatar-img");

        if (existing) {
          existing.src = `/api/user/avatar/${data.avatar}`;
        } else if (initials) {
          const img = document.createElement("img");
          img.src = `/api/user/avatar/${data.avatar}`;
          img.id = "settings-avatar-img";
          img.className = "h-14 w-14 rounded-full object-cover ring-2 ring-slate-200 group-hover:ring-slate-400 transition-all";
          initials.replaceWith(img);
        }

        // Update header avatar
        const headerBtn = document.getElementById("settings-btn");
        if (headerBtn) {
          headerBtn.innerHTML = `<img src="/api/user/avatar/${data.avatar}" class="h-10 w-10 rounded-full object-cover" alt="" />`;
        }
      } catch (_) { alert("Upload failed"); }
      e.target.value = "";
    });

    // Inline edit fields (37signals pattern)
    document.querySelectorAll(".inline-edit-field").forEach((field) => {
      const display = field.querySelector(".inline-edit-display");
      const input = field.querySelector(".inline-edit-input");
      const endpoint = field.dataset.endpoint;
      const fieldName = field.dataset.field;
      if (!display || !input) return;

      // Click text → show input
      display.addEventListener("click", () => {
        input.value = display.textContent.trim();
        display.classList.add("hidden");
        input.classList.remove("hidden");
        input.focus();
        input.select();
      });

      // Save and go back to text
      const commit = () => {
        const val = input.value.trim();
        display.textContent = val;
        input.classList.add("hidden");
        display.classList.remove("hidden");

        // Save to server
        fetch(endpoint, {
          method: "PUT",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `${fieldName}=${encodeURIComponent(val)}`,
        });

        // Update header display name if it's the name field
        if (fieldName === "display_name") {
          const label = document.getElementById("settings-display-name-label");
          if (label) label.textContent = val || label.dataset.fallback || "";
        }
      };

      // Enter → save, Escape → cancel
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); commit(); }
        if (e.key === "Escape") {
          e.preventDefault();
          input.classList.add("hidden");
          display.classList.remove("hidden");
        }
      });

      // Blur → save
      input.addEventListener("blur", commit);
    });

    // Font picker in settings
    document.getElementById("settings-font-grid")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-font]");
      if (!btn) return;
      const font = btn.dataset.font;

      // Update active state
      document.querySelectorAll("#settings-font-grid .settings-font-btn").forEach((b) => {
        b.classList.toggle("active", b.dataset.font === font);
      });

      // Update CSS variable live
      document.documentElement.style.setProperty("--takkr-font", `"${FONT_MAP[font] || "Caveat"}"`);

      // Save
      fetch("/api/user/font", {
        method: "PUT",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `font=${encodeURIComponent(font)}`,
      });
    });

    // Color picker in settings
    document.getElementById("settings-color-picker")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-color]");
      if (!btn) return;
      const color = btn.dataset.color;

      document.querySelectorAll("#settings-color-picker .settings-color-btn").forEach((b) => {
        b.classList.toggle("active", b.dataset.color === color);
      });

      // Update the add-note dialog default
      const radio = document.querySelector(`#add-note-dialog input[name="color"][value="${color}"]`);
      if (radio) radio.checked = true;

      fetch("/api/user/color", {
        method: "PUT",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `color=${encodeURIComponent(color)}`,
      });
    });

    // Background picker in settings
    document.getElementById("settings-bg-grid")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-bg]");
      if (!btn) return;
      const bg = btn.dataset.bg;
      const canvas = document.getElementById("canvas");
      if (!canvas) return;

      // Update active
      document.querySelectorAll("#settings-bg-grid .settings-bg-btn").forEach((b) => {
        b.classList.toggle("active", b.dataset.bg === bg);
      });

      // Swap background live
      canvas.dataset.background = bg;

      // Save board background
      const slug = window.location.pathname.slice(1);
      fetch(`/api/boards/${slug}/background`, {
        method: "PUT",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `background=${encodeURIComponent(bg)}`,
      });
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
      const z = this.zoomLevel || 1;
      const noteWidth = this.dragging.offsetWidth;
      const noteHeight = this.dragging.offsetHeight;

      let x = (e.clientX - canvasRect.left + canvas.scrollLeft) / z - this.dragOffset.x / z;
      let y = (e.clientY - canvasRect.top + canvas.scrollTop) / z - this.dragOffset.y / z;
      x = Math.max(0, x);
      y = Math.max(0, y);

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

  // --- Command Palette ---
  _paletteOpen: false,
  _paletteIndex: 0,
  _paletteItems: [],
  _gPending: false,

  openPalette() {
    const el = document.getElementById("command-palette");
    const input = document.getElementById("palette-input");
    if (!el || !input) return;
    el.classList.remove("hidden");
    this._paletteOpen = true;
    this._paletteIndex = 0;
    input.value = "";
    input.focus();
    this._updatePalette("");

    // Wire events (once)
    if (!el._wired) {
      el._wired = true;
      el.querySelector(".palette-backdrop").addEventListener("click", () => this.closePalette());
      input.addEventListener("input", () => {
        this._paletteIndex = 0;
        this._updatePalette(input.value);
      });
      input.addEventListener("keydown", (e) => {
        if (e.key === "Escape") { e.preventDefault(); this.closePalette(); return; }
        if (e.key === "ArrowDown") { e.preventDefault(); this._paletteNav(1); return; }
        if (e.key === "ArrowUp") { e.preventDefault(); this._paletteNav(-1); return; }
        if (e.key === "Enter") { e.preventDefault(); this._paletteExec(); return; }
      });
    }
  },

  closePalette() {
    const el = document.getElementById("command-palette");
    if (!el) return;
    el.classList.add("hidden");
    this._paletteOpen = false;
    this._paletteItems = [];
  },

  _fuzzyMatch(text, query) {
    text = text.toLowerCase();
    query = query.toLowerCase();
    if (!query) return true;
    let qi = 0;
    for (let i = 0; i < text.length && qi < query.length; i++) {
      if (text[i] === query[qi]) qi++;
    }
    return qi === query.length;
  },

  _updatePalette(query) {
    const results = document.getElementById("palette-results");
    if (!results) return;
    const q = query.trim();
    const items = [];

    // Notes on current board
    const notes = Array.from(document.querySelectorAll(".takkr"));
    for (const note of notes) {
      const title = note.querySelector(".takkr-title")?.textContent || "";
      const tags = note.dataset.tags || "";
      const searchText = `${title} ${tags}`;
      if (this._fuzzyMatch(searchText, q)) {
        items.push({ type: "note", icon: "📝", label: title, hint: tags ? `#${tags.split(",")[0]}` : "", el: note });
      }
    }

    // Boards
    const canvas = document.getElementById("canvas");
    const boards = JSON.parse(canvas?.dataset.boards || "[]");
    const currentSlug = canvas?.dataset.slug || "";
    for (const b of boards) {
      if (b.slug === currentSlug) continue;
      if (this._fuzzyMatch(b.slug, q)) {
        items.push({ type: "board", icon: "📋", label: `/${b.slug}`, hint: b.role, slug: b.slug });
      }
    }

    // Commands
    const commands = [
      { label: "New note", icon: "✨", hint: "n", action: () => { this.closePalette(); document.getElementById("add-note-dialog")?.showModal(); } },
      { label: "Delete note", icon: "🗑️", hint: "x", action: () => { this.closePalette(); this._deleteSelected(); } },
      { label: "Duplicate note", icon: "📋", hint: "d", action: () => { this.closePalette(); this._duplicateSelected(); } },
      { label: "Cycle color", icon: "🎨", hint: "c", action: () => { this.closePalette(); this._cycleColor(); } },
      { label: "Settings", icon: "⚙️", hint: "s", action: () => { this.closePalette(); document.getElementById("settings-modal")?.showModal(); } },
      { label: "Members", icon: "👥", hint: "m", action: () => { this.closePalette(); document.getElementById("members-modal")?.showModal(); } },
      { label: "Zoom in", icon: "🔍", hint: "+", action: () => { this.closePalette(); this.zoomIn(); } },
      { label: "Zoom out", icon: "🔍", hint: "−", action: () => { this.closePalette(); this.zoomOut(); } },
      { label: "Reset zoom", icon: "🔍", hint: "0", action: () => { this.closePalette(); this.zoomReset(); } },
      { label: "Help", icon: "❓", hint: "?", action: () => { this.closePalette(); document.getElementById("help-modal")?.showModal(); } },
    ];
    for (const cmd of commands) {
      if (this._fuzzyMatch(cmd.label, q)) {
        items.push({ type: "command", icon: cmd.icon, label: cmd.label, hint: cmd.hint, action: cmd.action });
      }
    }

    this._paletteItems = items;
    if (this._paletteIndex >= items.length) this._paletteIndex = Math.max(0, items.length - 1);

    // Render
    let html = "";
    let lastType = "";
    const sectionLabels = { note: "Notes", board: "Boards", command: "Commands" };
    items.forEach((item, i) => {
      if (item.type !== lastType) {
        html += `<div class="palette-section">${sectionLabels[item.type]}</div>`;
        lastType = item.type;
      }
      html += `<div class="palette-item${i === this._paletteIndex ? " active" : ""}" data-index="${i}">
        <span class="palette-item-icon">${item.icon}</span>
        <span class="palette-item-label">${this._escapeHtml(item.label)}</span>
        <span class="palette-item-hint">${this._escapeHtml(item.hint || "")}</span>
      </div>`;
    });
    if (!items.length && q) {
      html = '<div class="palette-item text-slate-400"><span class="palette-item-icon">🔍</span><span>No results</span></div>';
    }
    results.innerHTML = html;

    // Click handler on items
    results.querySelectorAll(".palette-item[data-index]").forEach((el) => {
      el.addEventListener("click", () => {
        this._paletteIndex = Number(el.dataset.index);
        this._paletteExec();
      });
      el.addEventListener("mouseenter", () => {
        results.querySelector(".palette-item.active")?.classList.remove("active");
        el.classList.add("active");
        this._paletteIndex = Number(el.dataset.index);
      });
    });
  },

  _escapeHtml(text) {
    const el = document.createElement("span");
    el.textContent = text;
    return el.innerHTML;
  },

  _paletteNav(dir) {
    const results = document.getElementById("palette-results");
    if (!this._paletteItems.length) return;
    results.querySelector(".palette-item.active")?.classList.remove("active");
    this._paletteIndex += dir;
    if (this._paletteIndex < 0) this._paletteIndex = this._paletteItems.length - 1;
    if (this._paletteIndex >= this._paletteItems.length) this._paletteIndex = 0;
    const active = results.querySelector(`[data-index="${this._paletteIndex}"]`);
    active?.classList.add("active");
    active?.scrollIntoView({ block: "nearest" });
  },

  _paletteExec() {
    const item = this._paletteItems[this._paletteIndex];
    if (!item) return;
    this.closePalette();

    if (item.type === "note") {
      this.select(item.el);
    } else if (item.type === "board") {
      window.location.href = `/${item.slug}`;
    } else if (item.action) {
      item.action();
    }
  },

  // --- Actions ---
  _deleteSelected() {
    if (!this.selected) return;
    fetch(`/api/notes/${this.selected.dataset.id}`, { method: "DELETE" });
    this.selected.remove();
    this.selected = null;
  },

  async _duplicateSelected() {
    if (!this.selected) return;
    const noteId = this.selected.dataset.id;
    try {
      const res = await fetch(`/api/notes/${noteId}/duplicate`, { method: "POST" });
      if (!res.ok) return;
      const html = await res.text();
      document.getElementById("notes").insertAdjacentHTML("beforeend", html);
    } catch (_) {}
  },

  _cycleColor() {
    if (!this.selected) return;
    const colors = ["yellow", "pink", "green", "blue", "orange"];
    const current = Array.from(this.selected.classList)
      .find(c => c.startsWith("takkr-") && c !== "takkr")?.replace("takkr-", "") || "yellow";
    const idx = colors.indexOf(current);
    const next = colors[(idx + 1) % colors.length];

    this.selected.className = this.selected.className.replace(/takkr-\w+/g, "").trim() + ` takkr-${next}`;

    fetch(`/api/notes/${this.selected.dataset.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `color=${encodeURIComponent(next)}`,
    });
  },

  handleKey(e) {
    // Palette open — let palette input handle everything
    if (this._paletteOpen) return;

    // Zoom shortcuts work everywhere
    if ((e.metaKey || e.ctrlKey) && (e.key === "=" || e.key === "+")) {
      e.preventDefault(); this.zoomIn(); return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "-") {
      e.preventDefault(); this.zoomOut(); return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "0") {
      e.preventDefault(); this.zoomReset(); return;
    }

    // Cmd+P / Ctrl+P → palette
    if ((e.metaKey || e.ctrlKey) && e.key === "p") {
      e.preventDefault(); this.openPalette(); return;
    }

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

    // gg (double-g) detection
    if (e.key === "g" && !e.metaKey && !e.ctrlKey) {
      if (this._gPending) {
        e.preventDefault();
        this._gPending = false;
        // gg → first note
        const notes = Array.from(document.querySelectorAll(".takkr"));
        if (notes.length) this.select(notes[0]);
        return;
      }
      this._gPending = true;
      setTimeout(() => { this._gPending = false; }, 400);
      return;
    }
    this._gPending = false;

    switch (e.key) {
      // Vim navigation
      case "h": e.preventDefault(); this.selectNearest("left"); break;
      case "j": e.preventDefault(); this.selectNearest("down"); break;
      case "k": e.preventDefault(); this.selectNearest("up"); break;
      case "l": e.preventDefault(); this.selectNearest("right"); break;

      // G → last note
      case "G":
        e.preventDefault();
        { const notes = Array.from(document.querySelectorAll(".takkr"));
          if (notes.length) this.select(notes[notes.length - 1]); }
        break;

      // Actions
      case "n": e.preventDefault(); document.getElementById("add-note-dialog")?.showModal(); break;
      case "x":
      case "Delete":
      case "Backspace":
        e.preventDefault(); this._deleteSelected(); break;
      case "d": e.preventDefault(); this._duplicateSelected(); break;
      case "c": e.preventDefault(); this._cycleColor(); break;
      case "s": e.preventDefault(); document.getElementById("settings-modal")?.showModal(); break;
      case "m": e.preventDefault(); document.getElementById("members-modal")?.showModal(); break;
      case "/": e.preventDefault(); this.openPalette(); break;

      // Zoom without modifier
      case "+": case "=": e.preventDefault(); this.zoomIn(); break;
      case "-": e.preventDefault(); this.zoomOut(); break;

      case "?": e.preventDefault(); document.getElementById("help-modal")?.showModal(); break;
      case "Escape":
        if (this.selected) { this.selected.classList.remove("selected"); this.selected = null; }
        break;
      case "Tab": e.preventDefault(); this.selectNext(e.shiftKey ? -1 : 1); break;
      case "Enter": e.preventDefault(); if (this.selected) zoom.open(this.selected); break;

      // Arrow keys
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
