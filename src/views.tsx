import type { Child } from "hono/jsx";
import type * as Board from "@/board";
import type * as Member from "@/member";
import type * as Note from "@/note";

/** Calculate days until a due date from today. Negative = overdue. */
const daysUntilDue = (dueDate: string | null): number | null => {
  if (!dueDate) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const due = new Date(dueDate);
  const diff = due.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

// Button component using CSS classes from main.css
const Button = (props: {
  children: Child;
  type?: "button" | "submit";
  variant?: "default" | "outline" | "ghost" | "destructive" | "secondary";
  size?: "sm" | "md" | "lg" | "icon";
  class?: string;
  [key: string]: unknown;
}) => {
  const variants = {
    default: "btn-default",
    outline: "btn-outline",
    ghost: "btn-ghost",
    destructive: "btn-destructive",
    secondary: "btn-secondary",
  };

  const sizes = {
    sm: "btn-sm",
    md: "btn-md",
    lg: "btn-lg",
    icon: "btn-icon",
  };

  const variant = props.variant || "default";
  const size = props.size || "md";
  const className = `btn ${variants[variant]} ${sizes[size]} ${props.class || ""}`;

  return (
    <button type={props.type || "button"} class={className} {...props}>
      {props.children}
    </button>
  );
};

// Input component using CSS class from main.css
const Input = (props: { class?: string; [key: string]: unknown }) => (
  <input class={`input ${props.class || ""}`} {...props} />
);

// Login page
export const Login = () => (
  <div class="flex min-h-full items-center justify-center p-4">
    <div class="w-full max-w-sm space-y-8 text-center">
      <div>
        <a href="/" class="text-4xl font-bold text-slate-900 hover:text-slate-700 transition-colors no-underline">takkr</a>
        <p class="mt-2 text-slate-600">
          Collaborative sticky notes for your ideas
        </p>
      </div>
      <div class="space-y-3" x-data="discover()">
        <Button
          variant="default"
          size="lg"
          class="w-full"
          x-on:click="submit()"
        >
          Sign In with Passkey
        </Button>
        <a
          href="/~/join"
          class="block w-full rounded-md border border-slate-300 bg-white py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          Create Account
        </a>
      </div>
    </div>
  </div>
);

// Registration page
export const Join = () => (
  <div class="flex min-h-full items-center justify-center p-4">
    <div class="w-full max-w-sm space-y-6" x-data="register()">
      <div class="text-center">
        <h1 class="text-2xl font-bold text-slate-900">Create Account</h1>
      </div>
      <div class="space-y-4">
        <Input
          type="text"
          name="username"
          placeholder="Choose a username"
          autocomplete="username"
          x-model="username"
        />
        <Button
          variant="default"
          size="lg"
          class="w-full"
          x-on:click="submit()"
        >
          Register with Passkey
        </Button>
      </div>
      <p
        id="hx-alert"
        class="text-sm text-red-600 text-center min-h-[1.25rem]"
      />
      <p class="text-center text-sm text-slate-600">
        <a href="/~/login" class="text-slate-900 hover:underline">
          Already have an account? Sign in
        </a>
      </p>
    </div>
  </div>
);

// Home page
export const Home = (props: { username: string; boards: Board.Record[] }) => (
  <div class="min-h-full p-6">
    <div class="mx-auto max-w-2xl space-y-8">
      <header class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-slate-900">takkr</h1>
        <div class="flex items-center gap-4">
          <span class="text-sm text-slate-600">{props.username}</span>
          <form action="/api/user/logout" method="post">
            <Button type="submit" variant="ghost" size="sm">
              Sign Out
            </Button>
          </form>
        </div>
      </header>

      <div
        class="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
        x-data="goToBoard()"
      >
        <p class="mb-4 text-sm text-slate-600">
          Go to any board by typing its name:
        </p>
        <div class="flex items-center gap-2">
          <span class="text-lg text-slate-400">/</span>
          <Input
            type="text"
            placeholder="board-name"
            class="flex-1"
            x-model="slug"
            x-on:keydown="handleKey($event)"
          />
          <Button variant="default" x-on:click="go()">
            Go
          </Button>
        </div>
      </div>

      {props.boards.length > 0 && (
        <div>
          <h2 class="mb-4 text-sm font-medium text-slate-500">Your Boards</h2>
          <div class="flex flex-wrap gap-2">
            {props.boards.map((board) => (
              <a
                href={`/${board.slug}`}
                key={board.slug}
                class="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-mono text-slate-700 hover:bg-slate-50 transition-colors"
              >
                /{board.slug}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  </div>
);

// Takkr note component — fixed size card, title only on front
export const Takkr = (props: {
  note: Note.Record;
  selected?: boolean;
  oob?: boolean;
  attachmentCount?: number;
}) => {
  const days = daysUntilDue(props.note.due_date);
  const isDone = props.note.status === "done";
  const classes = [
    "takkr",
    `takkr-${props.note.color}`,
    props.selected ? "selected" : "",
    isDone ? "takkr-done" : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      id={`note-${props.note.id}`}
      class={classes}
      data-id={props.note.id}
      data-x={props.note.x}
      data-y={props.note.y}
      data-description={props.note.description || ""}
      data-tags={props.note.tags || ""}
      data-checklist={props.note.checklist || "[]"}
      data-author={props.note.created_by || ""}
      data-created={props.note.created || ""}
      data-assigned={props.note.assigned_to || ""}
      data-due-date={props.note.due_date || ""}
      data-priority={props.note.priority || ""}
      data-status={props.note.status || "todo"}
      style={`left: ${props.note.x}px; top: ${props.note.y}px; z-index: ${props.note.z};`}
      tabindex={0}
      {...(props.oob
        ? { "hx-swap-oob": `outerHTML:#note-${props.note.id}` }
        : {})}
    >
      <div class="takkr-title">{props.note.content}</div>
      {/* Dog-ear: days until due */}
      {days !== null && (
        <div class="takkr-ear">{days}</div>
      )}
      {/* Priority dot */}
      {props.note.priority && (
        <div class={`takkr-priority takkr-priority-${props.note.priority}`} />
      )}
      {/* Done checkmark */}
      {isDone && (
        <div class="takkr-done-check">{"\u2713"}</div>
      )}
      {(props.attachmentCount ?? 0) > 0 && (
        <div class="takkr-attachments">
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
          <span>{props.attachmentCount}</span>
        </div>
      )}
    </div>
  );
};

// Zoom overlay — rendered once, populated by JS
export const ZoomOverlay = () => (
  <div id="zoom-overlay" class="zoom-overlay" style="display:none;">
    <div class="zoom-backdrop" />
    <button type="button" id="zoom-close-btn" class="zoom-close-btn">
      <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
    <div id="zoom-card" class="zoom-card">
      <div class="zoom-card-inner">
        <div class="zoom-front">
          <div class="zoom-title" id="zoom-title" />
        </div>
        <div class="zoom-back">
          <div class="zoom-back-content">
            {/* Meta: author + date */}
            <div class="zoom-back-meta" id="zoom-back-meta" />

            {/* Title */}
            {/* @ts-expect-error contenteditable accepts string in HTML */}
            <div class="zoom-back-title" id="zoom-back-title" contenteditable="false" />

            {/* Description */}
            {/* @ts-expect-error contenteditable accepts string in HTML */}
            <div class="zoom-back-description" id="zoom-back-description" contenteditable="false" data-placeholder="Add details, notes, links..." />

            {/* Color picker */}
            <div class="zoom-back-section">
              <div class="zoom-back-section-title">Color</div>
              <div class="zoom-back-colors" id="zoom-back-colors">
                {(["yellow", "pink", "green", "blue", "orange"] as const).map((c) => (
                  <button
                    type="button"
                    key={c}
                    data-color={c}
                    class={`zoom-color-btn bg-takkr-${c}`}
                  />
                ))}
              </div>
            </div>

            {/* Progressive disclosure: Due Date, Priority, Status */}
            <div class="zoom-back-extras" id="zoom-back-extras">
              <button type="button" id="zoom-toggle-due" class="zoom-extras-btn" title="Due date">
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
              </button>
              <button type="button" id="zoom-toggle-priority" class="zoom-extras-btn" title="Priority">
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
                </svg>
              </button>
              <button type="button" id="zoom-toggle-status" class="zoom-extras-btn" title="Status">
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            </div>

            {/* Due Date (hidden by default) */}
            <div class="zoom-extras-section" id="zoom-section-due">
              <div class="zoom-back-section-title">Due Date</div>
              <div class="flex items-center gap-2">
                <input type="date" id="zoom-back-due-date" class="zoom-due-input" />
                <button type="button" id="zoom-due-clear" class="btn btn-ghost btn-sm">Clear</button>
              </div>
            </div>

            {/* Priority (hidden by default) */}
            <div class="zoom-extras-section" id="zoom-section-priority">
              <div class="zoom-back-section-title">Priority</div>
              <div id="zoom-back-priority" class="flex gap-2 flex-wrap">
                <button type="button" class="zoom-priority-btn" data-priority="low">
                  <span class="zoom-priority-dot zoom-priority-dot-low" />Low
                </button>
                <button type="button" class="zoom-priority-btn" data-priority="medium">
                  <span class="zoom-priority-dot zoom-priority-dot-medium" />Medium
                </button>
                <button type="button" class="zoom-priority-btn" data-priority="high">
                  <span class="zoom-priority-dot zoom-priority-dot-high" />High
                </button>
              </div>
            </div>

            {/* Status (hidden by default) */}
            <div class="zoom-extras-section" id="zoom-section-status">
              <div class="zoom-back-section-title">Status</div>
              <div id="zoom-back-status" class="flex gap-2 flex-wrap">
                <button type="button" class="zoom-status-btn" data-status="todo">To Do</button>
                <button type="button" class="zoom-status-btn" data-status="in_progress">In Progress</button>
                <button type="button" class="zoom-status-btn" data-status="done">Done</button>
              </div>
            </div>

            {/* Assignee — only shown when board has collaborators */}
            <div class="zoom-back-section" id="zoom-back-assign-section" style="display:none;">
              <div class="zoom-back-section-title">Assign</div>
              <div id="zoom-back-assign" class="zoom-back-assign"></div>
            </div>

            {/* Checklist */}
            <div class="zoom-back-section">
              <div class="zoom-back-section-title">Checklist</div>
              <div class="zoom-back-checklist" id="zoom-back-checklist" />
              <div class="zoom-checklist-add">
                <input type="text" id="zoom-checklist-input" placeholder="Add item..." />
                <button type="button" class="btn btn-ghost btn-sm" id="zoom-checklist-add-btn">+</button>
              </div>
            </div>

            {/* Tags */}
            <div class="zoom-back-section">
              <div class="zoom-back-section-title">Tags</div>
              <div class="zoom-back-tags" id="zoom-back-tags">
                <input type="text" class="zoom-tag-input" id="zoom-tag-input" placeholder="Add tag..." />
              </div>
            </div>

            {/* Attachments */}
            <div class="zoom-back-section">
              <div class="zoom-back-section-title">Attachments</div>
              <div class="zoom-back-attachments" id="zoom-back-attachments" />
              <label class="zoom-upload-btn" id="zoom-upload-btn">
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338-2.317 4.502 4.502 0 013.576 4.065A3 3 0 0118 19.5H6.75z" />
                </svg>
                <span>Upload file (max 5MB)</span>
                <input type="file" class="hidden" id="zoom-file-input" />
              </label>
            </div>
          </div>
          <div class="zoom-back-actions">
            <button type="button" class="btn btn-ghost btn-sm text-red-500 hover:text-red-700" id="zoom-delete-btn">Delete note</button>
          </div>
        </div>
      </div>
    </div>
  </div>
);

// Add note dialog
const AddNoteDialog = (props: { slug: string }) => (
  <dialog
    id="add-note-dialog"
    class="rounded-lg border-0 p-0 shadow-xl backdrop:bg-black/50"
    x-data="noteDialog()"
  >
    <div class="w-[90vw] max-w-md p-6">
      <div class="mb-4 flex items-center justify-between">
        <h3 class="text-lg font-semibold text-slate-900">New Note</h3>
        <button
          type="button"
          class="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          x-on:click="close()"
        >
          <svg
            class="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
      <form
        hx-post={`/api/boards/${props.slug}/notes`}
        hx-target="#notes"
        hx-swap="beforeend"
        x-ref="form"
        class="space-y-4"
      >
        <input
          type="text"
          name="content"
          placeholder="What's on your mind?"
          required
          maxlength={80}
          x-ref="content"
          class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 font-handwriting text-lg"
        />
        <div class="flex gap-2">
          {(["yellow", "pink", "green", "blue", "orange"] as const).map((c) => (
            <label key={c} class="cursor-pointer">
              <input
                type="radio"
                name="color"
                value={c}
                checked={c === "yellow"}
                class="peer sr-only"
              />
              <span
                class={`block h-8 w-8 rounded-full border-2 border-transparent peer-checked:border-slate-900 ${
                  c === "yellow"
                    ? "bg-[#fff740]"
                    : c === "pink"
                      ? "bg-[#ff7eb9]"
                      : c === "green"
                        ? "bg-[#7afcff]"
                        : c === "blue"
                          ? "bg-[#7affc7]"
                          : "bg-[#ffa07a]"
                }`}
              />
            </label>
          ))}
        </div>
        <Button type="submit" variant="default" class="w-full">
          Add Note
        </Button>
      </form>
    </div>
  </dialog>
);

// Help modal
const HelpModal = () => (
  <dialog
    id="help-modal"
    class="rounded-lg border-0 p-0 shadow-xl backdrop:bg-black/50"
  >
    <div class="w-[90vw] max-w-md p-6">
      <div class="mb-4 flex items-center justify-between">
        <h3 class="text-lg font-semibold text-slate-900">Keyboard Shortcuts</h3>
        <button
          type="button"
          class="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          onclick="this.closest('dialog').close()"
        >
          <svg
            class="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
      <div class="space-y-2 text-sm">
        {[
          ["⌘P / /", "Command palette"],
          ["h j k l", "Navigate notes (vim)"],
          ["↑↓←→", "Navigate notes"],
          ["n", "New note"],
          ["Enter", "Open card detail"],
          ["x", "Delete selected note"],
          ["d", "Duplicate selected note"],
          ["c", "Cycle note color"],
          ["f", "Cycle status (todo/in-progress/done)"],
          ["g g", "Jump to first note"],
          ["G", "Jump to last note"],
          ["+ / −", "Zoom in / out"],
          ["⌘/Ctrl 0", "Reset zoom"],
          ["Tab", "Next note"],
          ["Escape", "Deselect / Close"],
          ["?", "Show this help"],
        ].map(([key, desc]) => (
          <div class="flex items-center justify-between" key={key}>
            <kbd class="rounded bg-slate-100 px-2 py-1 font-mono text-xs">
              {key}
            </kbd>
            <span class="text-slate-600">{desc}</span>
          </div>
        ))}
      </div>
    </div>
  </dialog>
);

// Members modal
const MembersModal = (props: {
  board: Board.Record;
  members: Member.Record[];
  username: string;
}) => (
  <dialog
    id="members-modal"
    class="rounded-lg border-0 p-0 shadow-xl backdrop:bg-black/50"
  >
    <div class="w-[90vw] max-w-md p-6">
      <div class="mb-4 flex items-center justify-between">
        <h3 class="text-lg font-semibold text-slate-900">Board Members</h3>
        <button
          type="button"
          class="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          onclick="this.closest('dialog').close()"
        >
          <svg
            class="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
      <ul class="mb-4 space-y-2">
        <li class="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
          <span class="text-sm">{props.username}</span>
          <span class="text-xs text-slate-500">owner</span>
        </li>
        {props.members.map((m) => (
          <li
            key={m.username}
            class="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2"
          >
            <span class="text-sm">{m.username}</span>
            <form
              hx-delete={`/api/boards/${props.board.slug}/members/${m.username}`}
              hx-target="#hx-body"
              hx-swap="innerHTML"
            >
              <Button type="submit" variant="destructive" size="sm">
                Remove
              </Button>
            </form>
          </li>
        ))}
      </ul>
      <form
        hx-post={`/api/boards/${props.board.slug}/members`}
        hx-target="#hx-body"
        hx-swap="innerHTML"
        class="flex gap-2"
      >
        <Input
          type="text"
          name="username"
          placeholder="Username to invite"
          class="flex-1"
        />
        <Button type="submit" variant="outline">
          Invite
        </Button>
      </form>
    </div>
  </dialog>
);

// Settings modal
const SettingsModal = (props: {
  username: string;
  font: string;
  preferredColor: string;
  displayName: string;
  email: string;
  avatar: string;
  board: Board.Record;
  members: Member.Record[];
  isOwner: boolean;
  allBoards: { board: Board.Record; role: "owner" | "member" }[];
}) => (
  <dialog
    id="settings-modal"
    class="rounded-lg border-0 p-0 shadow-xl backdrop:bg-black/50 max-h-[85vh] overflow-y-auto"
  >
    <div class="w-[90vw] max-w-lg p-6">
      <div class="mb-6 flex items-center justify-between">
        <div class="flex items-center gap-3">
          {/* Avatar with upload */}
          <label class="relative cursor-pointer group" id="avatar-label">
            {props.avatar ? (
              <img
                src={`/api/user/avatar/${props.avatar}`}
                id="settings-avatar-img"
                class="h-14 w-14 rounded-full object-cover ring-2 ring-slate-200 group-hover:ring-slate-400 transition-all"
                alt=""
              />
            ) : (
              <div
                id="settings-avatar-initials"
                class="flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white text-lg font-semibold uppercase ring-2 ring-transparent group-hover:ring-slate-400 transition-all"
              >
                {props.username.slice(0, 2)}
              </div>
            )}
            <div class="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
              <svg class="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
              </svg>
            </div>
            <input type="file" accept="image/*" class="hidden" id="avatar-file-input" />
          </label>
          <div class="flex-1">
            <h3 class="text-lg font-semibold text-slate-900" id="settings-display-name-label">
              {props.displayName || props.username}
            </h3>
            <p class="text-xs text-slate-500">@{props.username}</p>
          </div>
        </div>
        <button
          type="button"
          class="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          onclick="this.closest('dialog').close()"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Profile fields — inline edit */}
      <div class="mb-6 space-y-2">
        <div class="inline-edit-field" id="field-display-name" data-field="display_name" data-endpoint="/api/user/display-name">
          <label class="text-xs font-medium text-slate-400 uppercase tracking-wide">Display Name</label>
          <div class="inline-edit-display" data-placeholder="Add your name...">
            {props.displayName || ""}
          </div>
          <input type="text" class="inline-edit-input hidden" value={props.displayName} maxlength={50} placeholder="How should we call you?" />
        </div>
        <div class="inline-edit-field" id="field-email" data-field="email" data-endpoint="/api/user/email">
          <label class="text-xs font-medium text-slate-400 uppercase tracking-wide">Email</label>
          <div class="inline-edit-display" data-placeholder="Add your email...">
            {props.email || ""}
          </div>
          <input type="email" class="inline-edit-input hidden" value={props.email} placeholder="your@email.com" />
        </div>
      </div>

      {/* Font picker */}
      <div class="mb-6">
        <h4 class="text-sm font-medium text-slate-700 mb-3">Handwriting Font</h4>
        <div class="grid grid-cols-3 gap-2" id="settings-font-grid">
          {Object.entries({
            caveat: "Caveat",
            "indie-flower": "Indie Flower",
            kalam: "Kalam",
            handlee: "Handlee",
            "gochi-hand": "Gochi Hand",
            cookie: "Cookie",
            parisienne: "Parisienne",
            sofia: "Sofia",
            "grand-hotel": "Grand Hotel",
          }).map(([key, label]) => (
            <button
              type="button"
              key={key}
              data-font={key}
              class={`settings-font-btn font-${key === "gochi-hand" ? "gochi-hand" : key === "indie-flower" ? "indie-flower" : key === "grand-hotel" ? "grand-hotel" : key}${props.font === key ? " active" : ""}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Preferred note color */}
      <div class="mb-6">
        <h4 class="text-sm font-medium text-slate-700 mb-3">Default Note Color</h4>
        <div class="flex gap-3" id="settings-color-picker">
          {(["yellow", "pink", "green", "blue", "orange"] as const).map((c) => (
            <button
              type="button"
              key={c}
              data-color={c}
              class={`settings-color-btn bg-takkr-${c}${props.preferredColor === c ? " active" : ""}`}
            />
          ))}
        </div>
      </div>

      {/* Board background */}
      {props.isOwner && (
        <div class="mb-6">
          <h4 class="text-sm font-medium text-slate-700 mb-3">Board Background</h4>
          <div class="grid grid-cols-4 gap-2" id="settings-bg-grid">
            {(["plain", "grid", "cork", "chalkboard", "lined", "canvas", "blueprint", "doodle"] as const).map((bg) => (
              <button
                type="button"
                key={bg}
                data-bg={bg}
                class={`settings-bg-btn${props.board.background === bg ? " active" : ""}`}
              >
                <div class={`settings-bg-preview settings-bg-preview-${bg}`} />
                <span class="text-xs text-slate-500 capitalize">{bg}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Members (if owner) */}
      {props.isOwner && (
        <div class="mb-6">
          <h4 class="text-sm font-medium text-slate-700 mb-3">Collaborators</h4>
          <ul class="mb-3 space-y-2">
            <li class="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
              <div class="flex items-center gap-2">
                <div class="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-white text-xs font-semibold uppercase">
                  {props.username.slice(0, 2)}
                </div>
                <span class="text-sm">{props.username}</span>
              </div>
              <span class="text-xs text-slate-500">owner</span>
            </li>
            {props.members.map((m) => (
              <li key={m.username} class="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
                <div class="flex items-center gap-2">
                  <div class="flex h-7 w-7 items-center justify-center rounded-full bg-slate-300 text-slate-700 text-xs font-semibold uppercase">
                    {m.username.slice(0, 2)}
                  </div>
                  <span class="text-sm">{m.username}</span>
                </div>
                <form
                  hx-delete={`/api/boards/${props.board.slug}/members/${m.username}`}
                  hx-target="#hx-body"
                  hx-swap="innerHTML"
                >
                  <Button type="submit" variant="destructive" size="sm">Remove</Button>
                </form>
              </li>
            ))}
          </ul>
          <form
            hx-post={`/api/boards/${props.board.slug}/members`}
            hx-target="#hx-body"
            hx-swap="innerHTML"
            class="flex gap-2"
          >
            <Input type="text" name="username" placeholder="Invite by username" class="flex-1" />
            <Button type="submit" variant="outline">Invite</Button>
          </form>
        </div>
      )}

      {/* Your boards */}
      <div class="mb-6">
        <h4 class="text-sm font-medium text-slate-700 mb-3">Your Boards</h4>
        {props.allBoards.length > 0 ? (
          <div class="space-y-1">
            {props.allBoards.map(({ board: b, role }) => (
              <a
                key={b.slug}
                href={`/${b.slug}`}
                class={`flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${
                  b.slug === props.board.slug
                    ? "bg-slate-900 text-white"
                    : "hover:bg-slate-100 text-slate-700"
                }`}
              >
                <span class="font-mono">/{b.slug}</span>
                <span class={`text-xs ${b.slug === props.board.slug ? "text-slate-400" : "text-slate-400"}`}>
                  {role}
                </span>
              </a>
            ))}
          </div>
        ) : (
          <p class="text-sm text-slate-400 italic">No boards yet</p>
        )}
      </div>

      {/* Sign out */}
      <div class="pt-4 border-t border-slate-200">
        <form action="/api/user/logout" method="post">
          <Button type="submit" variant="ghost" size="sm" class="text-slate-500">
            Sign Out
          </Button>
        </form>
      </div>
    </div>
  </dialog>
);

// Board canvas view
export const BoardView = (props: {
  board: Board.Record;
  notes: Note.Record[];
  members: Member.Record[];
  username: string;
  isOwner: boolean;
  font?: string;
  preferredColor?: string;
  displayName?: string;
  email?: string;
  avatar?: string;
  allBoards?: { board: Board.Record; role: "owner" | "member" }[];
  attachmentCounts?: Map<number, number>;
}) => (
  <div
    class="h-full overflow-hidden"
    hx-ext="sse"
    sse-connect={`/api/boards/${props.board.slug}/events`}
  >
    <div
      class="relative h-full overflow-auto"
      id="canvas"
      x-data="board()"
      data-background={props.board.background || "grid"}
      data-boards={JSON.stringify((props.allBoards || []).map(b => ({ slug: b.board.slug, role: b.role })))}
      data-slug={props.board.slug}
      data-members={JSON.stringify([props.board.owner, ...props.members.map(m => m.username)])}
    >
      <div id="notes" sse-swap="note:created" hx-swap="beforeend" style="position:relative;width:4000px;height:4000px;transform-origin:0 0;">
        {props.notes.map((note) => (
          <Takkr note={note} key={note.id} attachmentCount={props.attachmentCounts?.get(note.id) ?? 0} />
        ))}
      </div>
      <div id="note-updated" sse-swap="note:updated" hx-swap="none" />
      <div id="note-deleted" sse-swap="note:deleted" hx-swap="none" />
    </div>

    <button
      type="button"
      class="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-2xl text-white shadow-lg hover:bg-slate-800 transition-colors"
      id="add-note-btn"
    >
      +
    </button>

    {/* Zoom indicator */}
    <div
      id="zoom-indicator"
      class="fixed bottom-6 left-6 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur-sm transition-opacity duration-300 opacity-0 pointer-events-none z-10"
    >
      100%
    </div>

    {/* Left: back button */}
    <a
      href="/"
      class="fixed top-4 left-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-slate-600 shadow hover:bg-white hover:text-slate-900 transition-colors z-10"
    >
      ←
    </a>

    {/* Right: help + user avatar */}
    <div class="fixed top-4 right-4 flex items-center gap-2 z-10">
      <button
        type="button"
        class="flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-slate-600 shadow hover:bg-white hover:text-slate-900 transition-colors"
        id="help-btn"
      >
        ?
      </button>
      <button
        type="button"
        class="flex h-10 w-10 items-center justify-center rounded-full shadow hover:ring-2 hover:ring-slate-400 transition-all overflow-hidden"
        id="settings-btn"
        title={props.username}
      >
        {props.avatar ? (
          <img src={`/api/user/avatar/${props.avatar}`} class="h-10 w-10 rounded-full object-cover" alt="" />
        ) : (
          <span class="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-white text-sm font-semibold uppercase">
            {props.username.slice(0, 2)}
          </span>
        )}
      </button>
    </div>

    {/* Command palette */}
    <div id="command-palette" class="fixed inset-0 z-50 hidden">
      <div class="palette-backdrop" />
      <div class="palette-container">
        <input
          type="text"
          id="palette-input"
          class="palette-input"
          placeholder="Search notes, boards, commands..."
          autocomplete="off"
          spellcheck={false}
        />
        <div id="palette-results" class="palette-results" />
      </div>
    </div>

    <ZoomOverlay />
    <AddNoteDialog slug={props.board.slug} />
    <HelpModal />
    <SettingsModal
      username={props.username}
      font={props.font || "caveat"}
      preferredColor={props.preferredColor || "yellow"}
      displayName={props.displayName || ""}
      email={props.email || ""}
      avatar={props.avatar || ""}
      board={props.board}
      members={props.members}
      isOwner={props.isOwner}
      allBoards={props.allBoards || []}
    />
  </div>
);

// Landing page — the board IS the pitch
// Landing page — hero + draggable feature notes from DB
export const Landing = (props: { notes: Note.Record[]; background?: string }) => {
  const features = props.notes.filter(n => n.tags?.includes("feature"));
  const usecases = props.notes.filter(n => n.tags?.includes("usecase"));
  const philosophy = props.notes.filter(n => n.tags?.includes("philosophy"));

  const NoteGrid = (gridProps: { notes: Note.Record[]; id: string }) => (
    <div
      id={gridProps.id}
      class="landing-board relative"
      style="min-height: 500px;"
    >
      {gridProps.notes.map((note, i) => {
        const grp = (note.tags || "").split(",").find(t => t.startsWith("grp-")) || "";
        return (
          <div
            key={note.id}
            class={`takkr takkr-${note.color} landing-note`}
            data-id={note.id}
            data-idx={i}
            data-grp={grp}
          >
            <div class="takkr-title">{note.content}</div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div class="h-full overflow-y-auto overflow-x-hidden" id="landing-scroll">
      {/* SEO: semantic content from actual notes */}
      <article class="sr-only">
        <h1>takkr — Collaborative Sticky Notes for Your Ideas</h1>
        <p>Free, real-time collaborative sticky note boards. Organize ideas visually with your team.</p>
        <h2>Features</h2>
        {features.map((n) => (<section key={n.id}><h3>{n.content}</h3>{n.description && <p>{n.description}</p>}</section>))}
        <h2>Use Cases</h2>
        {usecases.map((n) => (<section key={n.id}><h3>{n.content}</h3>{n.description && <p>{n.description}</p>}</section>))}
        <h2>Philosophy</h2>
        {philosophy.map((n) => (<section key={n.id}><h3>{n.content}</h3>{n.description && <p>{n.description}</p>}</section>))}
      </article>

      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": "takkr",
        "description": "Free, real-time collaborative sticky note boards. Drag and drop notes, invite teammates, use vim shortcuts and a command palette. Passkey login, no passwords. Open source.",
        "applicationCategory": "ProductivityApplication",
        "operatingSystem": "Web",
        "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
        "featureList": [...features, ...usecases].map(n => n.content),
      })}} />

      {/* ── Hero ── */}
      <section class="flex flex-col items-center justify-center min-h-[80vh] px-6 text-center">
        <h1 class="text-7xl sm:text-8xl font-bold text-slate-900 tracking-tight font-handwriting">takkr</h1>
        <p class="mt-6 text-2xl sm:text-4xl font-bold text-slate-800 max-w-2xl leading-tight">
          Collaborative sticky notes<br />for your ideas
        </p>
        <p class="mt-4 text-lg text-slate-500 max-w-md">
          Drag, drop, and organize — together, in real-time.<br />
          Free &amp; open source. No passwords, ever.
        </p>
        <div class="mt-10 flex flex-col sm:flex-row items-center gap-4">
          <a
            href="/~/join"
            class="rounded-xl bg-slate-900 px-10 py-4 text-lg font-semibold text-white hover:bg-slate-800 transition-all shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98]"
          >
            Start for Free →
          </a>
          <a
            href="/~/login"
            class="rounded-xl border-2 border-slate-300 px-10 py-4 text-lg font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Sign In
          </a>
        </div>
        <p class="mt-4 text-xs text-slate-400">No credit card. No setup. Just go.</p>
      </section>

      {/* ── Board Zone — one unified background for all note sections ── */}
      <div
        id="board-zone"
        class="relative transition-all duration-500 py-20"
        data-background="grid"
      >
        {/* Theme switcher arrows */}
        <div class="sticky top-4 z-30 flex justify-between px-3 sm:px-6 pointer-events-none" style="margin-bottom: -40px;">
          <button
            id="carousel-prev"
            class="pointer-events-auto w-10 h-10 rounded-full bg-white/80 border border-slate-200 shadow-md flex items-center justify-center hover:bg-white transition-colors text-slate-600 hover:text-slate-900"
            aria-label="Previous theme"
          >
            ←
          </button>
          <button
            id="carousel-next"
            class="pointer-events-auto w-10 h-10 rounded-full bg-white/80 border border-slate-200 shadow-md flex items-center justify-center hover:bg-white transition-colors text-slate-600 hover:text-slate-900"
            aria-label="Next theme"
          >
            →
          </button>
        </div>

        <div id="carousel-dots" class="flex justify-center gap-2 mb-10"></div>

        {/* ── Features ── */}
        <section class="relative mx-auto max-w-5xl px-6 pt-8 pb-16">
          <h2 class="text-center text-3xl font-bold board-zone-heading mb-2">What's inside</h2>
          <p class="text-center text-sm board-zone-subtext mb-10">
            go ahead, drag them around
          </p>
          <NoteGrid notes={features} id="landing-features" />
        </section>

        {/* ── Use cases ── */}
        <section class="relative mx-auto max-w-5xl px-6 pt-8 pb-16">
          <h2 class="text-center text-3xl font-bold board-zone-heading mb-2">Use it for anything</h2>
          <p class="text-center text-sm board-zone-subtext mb-10">
            boards that fit how you work
          </p>
          <NoteGrid notes={usecases} id="landing-usecases" />
        </section>

        {/* ── Philosophy ── */}
        <section class="relative mx-auto max-w-5xl px-6 pt-8 pb-16">
          <h2 class="text-center text-3xl font-bold board-zone-heading mb-2">The takkr way</h2>
          <p class="text-center text-sm board-zone-subtext mb-10">
            minimalist by default, powerful on demand
          </p>
          <NoteGrid notes={philosophy} id="landing-philosophy" />
        </section>
      </div>

      {/* ── Bottom CTA ── */}
      <section class="py-20 text-center border-t border-slate-100">
        <h2 class="text-4xl font-bold text-slate-900 font-handwriting">Ready to try?</h2>
        <p class="mt-3 text-lg text-slate-500">Claim a board in seconds.</p>
        <a
          href="/~/join"
          class="mt-8 inline-block rounded-xl bg-slate-900 px-10 py-4 text-lg font-semibold text-white hover:bg-slate-800 transition-all shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98]"
        >
          Start for Free →
        </a>
        <p class="mt-3 text-xs text-slate-400">No credit card. No setup. Just go.</p>
      </section>
    </div>
  );
};

// Help page
export const Help = () => (
  <div class="min-h-full p-6">
    <div class="mx-auto max-w-xl">
      <a href="/" class="text-sm text-slate-600 hover:text-slate-900">
        ← Back
      </a>
      <h1 class="mt-4 text-2xl font-bold text-slate-900">Help</h1>

      <section class="mt-8">
        <h2 class="text-lg font-semibold text-slate-900">Getting Started</h2>
        <p class="mt-2 text-slate-600">
          Go to any path like{" "}
          <code class="rounded bg-slate-100 px-1">/my-project</code> to claim it
          as your board. First visitor owns it. Add notes, drag them around,
          invite others.
        </p>
      </section>

      <section class="mt-8">
        <h2 class="text-lg font-semibold text-slate-900">Keyboard Shortcuts</h2>
        <div class="mt-4 space-y-2">
          {[
            ["⌘P / /", "Command palette"],
            ["h j k l", "Navigate (vim)"],
            ["Arrows", "Navigate notes"],
            ["n", "New note"],
            ["Enter", "Open card detail"],
            ["x", "Delete note"],
            ["d", "Duplicate note"],
            ["c", "Cycle color"],
            ["f", "Cycle status"],
            ["g g", "First note"],
            ["G", "Last note"],
            ["+ / −", "Zoom in / out"],
            ["⌘/Ctrl 0", "Reset zoom"],
            ["Escape", "Deselect / Close"],
          ].map(([key, desc]) => (
            <div class="flex items-center gap-4" key={key}>
              <kbd class="w-20 rounded bg-slate-100 px-2 py-1 text-center font-mono text-xs">
                {key}
              </kbd>
              <span class="text-slate-600">{desc}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  </div>
);

// Error alert component
export const Alert = (props: { message: string }) => (
  <p class="text-sm text-red-600 text-center">{props.message}</p>
);
