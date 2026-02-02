import type { Child } from "hono/jsx";
import type * as Board from "@/board";
import type * as Member from "@/member";
import type * as Note from "@/note";

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
        <h1 class="text-4xl font-bold text-slate-900">Post-It</h1>
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
        <a href="/" class="text-slate-900 hover:underline">
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
        <h1 class="text-2xl font-bold text-slate-900">Post-It</h1>
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

// Post-it note component
export const PostIt = (props: {
  note: Note.Record;
  selected?: boolean;
  oob?: boolean;
}) => (
  <div
    id={`note-${props.note.id}`}
    class={`postit postit-${props.note.color}${props.selected ? " selected" : ""}`}
    data-id={props.note.id}
    data-x={props.note.x}
    data-y={props.note.y}
    style={`left: ${props.note.x}px; top: ${props.note.y}px; z-index: ${props.note.z};`}
    tabindex={0}
    {...(props.oob
      ? { "hx-swap-oob": `outerHTML:#note-${props.note.id}` }
      : {})}
  >
    <div class="postit-inner">
      <div class="postit-front">
        <p>{props.note.content}</p>
      </div>
      <div class="postit-back">
        <small>
          Space: flip | Enter: edit | Del: delete
          <br />
          Arrows: navigate | n: new
        </small>
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
        <textarea
          name="content"
          placeholder="What's on your mind?"
          required
          rows={4}
          x-ref="content"
          class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
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
          ["n", "New note"],
          ["Enter", "Edit selected note"],
          ["Delete", "Remove selected note"],
          ["Space", "Flip note"],
          ["↑↓←→", "Navigate notes"],
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

// Board canvas view
export const BoardView = (props: {
  board: Board.Record;
  notes: Note.Record[];
  members: Member.Record[];
  username: string;
  isOwner: boolean;
}) => (
  <div
    class="h-full overflow-hidden"
    hx-ext="sse"
    sse-connect={`/api/boards/${props.board.slug}/events`}
  >
    <div
      class="relative h-full overflow-hidden bg-slate-50"
      id="canvas"
      x-data="board()"
      style="background-image: radial-gradient(circle, #cbd5e1 1px, transparent 1px); background-size: 20px 20px;"
    >
      <div id="notes" sse-swap="note:created" hx-swap="beforeend">
        {props.notes.map((note) => (
          <PostIt note={note} key={note.id} />
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

    <a
      href="/"
      class="fixed top-4 left-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-slate-600 shadow hover:bg-white hover:text-slate-900 transition-colors"
    >
      ←
    </a>

    <button
      type="button"
      class="fixed top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-slate-600 shadow hover:bg-white hover:text-slate-900 transition-colors"
      id="help-btn"
    >
      ?
    </button>

    {props.isOwner && (
      <button
        type="button"
        class="fixed top-4 right-16 flex h-10 items-center gap-1 rounded-full bg-white/80 px-3 text-sm text-slate-600 shadow hover:bg-white hover:text-slate-900 transition-colors"
        id="members-btn"
      >
        <span>{props.members.length + 1}</span>
        <svg
          class="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
          />
        </svg>
      </button>
    )}

    <AddNoteDialog slug={props.board.slug} />
    <HelpModal />
    {props.isOwner && (
      <MembersModal
        board={props.board}
        members={props.members}
        username={props.username}
      />
    )}
  </div>
);

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
            ["n", "New note"],
            ["Enter", "Edit selected note"],
            ["Delete", "Remove selected note"],
            ["Space", "Flip note"],
            ["Arrows", "Navigate notes"],
            ["Tab", "Next note"],
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
