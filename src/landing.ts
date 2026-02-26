import { db } from "@/database";
import * as Board from "@/board";
import * as Note from "@/note";
import * as User from "@/user";

const LANDING_SLUG = "__landing";
const LANDING_USER = "__system";

// Seed data for the landing board
const SEED_NOTES: Array<{
  content: string;
  color: Note.Color;
  x: number;
  y: number;
  tags?: string;
  description?: string;
}> = [
  // Hero cluster (center)
  { content: "takkr", color: "yellow", x: 520, y: 80, tags: "hero" },
  {
    content: "Collaborative sticky notes for your ideas",
    color: "pink",
    x: 480,
    y: 300,
    description:
      "Free, real-time collaborative sticky note boards. Organize ideas visually with your team.",
  },

  // Features (right side)
  { content: "✨ Features", color: "orange", x: 900, y: 60 },
  {
    content: "Drag & drop everything",
    color: "yellow",
    x: 870,
    y: 240,
    description: "Move sticky notes anywhere on an infinite canvas.",
  },
  {
    content: "Real-time collaboration",
    color: "green",
    x: 1140,
    y: 200,
    description: "Invite teammates and see changes as they happen via SSE.",
  },
  {
    content: "Vim keyboard shortcuts",
    color: "blue",
    x: 880,
    y: 420,
    description:
      "Navigate with h/j/k/l, delete with x, duplicate with d, cycle colors with c.",
  },
  {
    content: "Command palette (⌘P)",
    color: "pink",
    x: 1150,
    y: 380,
    description:
      "Search notes, jump between boards, and run commands from one input.",
  },
  {
    content: "Zoom in & out",
    color: "yellow",
    x: 1130,
    y: 560,
    description:
      "Cmd+/- or pinch to zoom. Viewport state persists per user per board.",
  },
  {
    content: "File attachments",
    color: "green",
    x: 890,
    y: 590,
    description: "Drag files onto any note. Up to 5MB per attachment.",
  },
  {
    content: "Checklists & tags",
    color: "orange",
    x: 1160,
    y: 730,
    description: "Add checklists and tags to organize notes within a board.",
  },

  // How it works (left side)
  { content: "🚀 How it works", color: "blue", x: 60, y: 80 },
  {
    content: "Go to /anything to claim a board",
    color: "green",
    x: 40,
    y: 260,
    description:
      "Just type a URL like /my-project. First visitor claims it as their board.",
  },
  {
    content: "Invite teammates by username",
    color: "yellow",
    x: 70,
    y: 440,
    description:
      "Share your board by inviting collaborators. They can add and edit notes in real time.",
  },
  {
    content: "Passkey login — no passwords ever",
    color: "pink",
    x: 50,
    y: 620,
    description:
      "Sign in with biometrics or security keys. No passwords to remember or leak.",
  },

  // CTA (bottom center)
  {
    content: "Free & open source",
    color: "green",
    x: 440,
    y: 540,
    description: "takkr is free to use. No credit card required.",
  },
  {
    content: "Try it now →",
    color: "orange",
    x: 500,
    y: 720,
    tags: "hero,cta",
  },
];

/**
 * Ensure the landing board exists with seed notes.
 * Safe to call on every startup — only creates if missing.
 */
export function ensureLandingBoard(): void {
  // Create system user if not exists
  const user = User.find(LANDING_USER);
  if (!user) {
    try {
      User.create({
        username: LANDING_USER,
        credential_id: `__system_${Date.now()}`,
        public_key: Buffer.from([0]),
        counter: 0,
      } as User.Record);
    } catch (_) {
      // Already exists (race)
    }
  }

  // Create board if not exists
  let board = Board.bySlug(LANDING_SLUG);
  if (!board) {
    board = Board.create(LANDING_SLUG, LANDING_USER);
  }

  // Seed notes if board is empty
  const existing = Note.forBoard(board.id);
  if (existing.length === 0) {
    for (const seed of SEED_NOTES) {
      const note = Note.create(
        board.id,
        seed.content,
        LANDING_USER,
        seed.x,
        seed.y,
        seed.color,
      );
      if (seed.description || seed.tags) {
        Note.update(note.id, {
          description: seed.description || "",
          tags: seed.tags || "",
        });
      }
    }
  }
}

/**
 * Get the landing board and its notes.
 */
export function getLandingData(): {
  board: Board.Record;
  notes: Note.Record[];
} | null {
  const board = Board.bySlug(LANDING_SLUG);
  if (!board) return null;
  const notes = Note.forBoard(board.id);
  return { board, notes };
}
