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
  // Hero (SEO only, filtered from display)
  { content: "takkr", color: "yellow", x: 0, y: 0, tags: "hero",
    description: "Free, real-time collaborative sticky note boards. Organize ideas visually with your team." },

  // ── Features (the how) ──
  // Standalone cards
  { content: "Drag & drop everything", color: "yellow", x: 0, y: 0, tags: "feature",
    description: "Move sticky notes anywhere on an infinite canvas." },
  { content: "Real-time collaboration", color: "green", x: 0, y: 0, tags: "feature",
    description: "Invite teammates and see changes as they happen." },
  { content: "Passkey login", color: "pink", x: 0, y: 0, tags: "feature",
    description: "No passwords. Ever. Sign in with biometrics or a security key." },
  { content: "REST API", color: "blue", x: 0, y: 0, tags: "feature",
    description: "Programmatic access to boards, notes, and users. Build integrations." },
  // Grouped: keyboard power users
  { content: "Command palette (⌘P)", color: "pink", x: 0, y: 0, tags: "feature,grp-keys",
    description: "Search notes, jump between boards, and run commands from one input." },
  { content: "Vim keyboard shortcuts", color: "blue", x: 0, y: 0, tags: "feature,grp-keys",
    description: "h/j/k/l to navigate, x to delete, d to duplicate, c to cycle colors." },
  // Grouped: canvas navigation
  { content: "Zoom & pan", color: "yellow", x: 0, y: 0, tags: "feature,grp-canvas",
    description: "Pinch or Cmd+/- to zoom. Your viewport is saved per board." },
  { content: "Infinite canvas", color: "green", x: 0, y: 0, tags: "feature,grp-canvas",
    description: "No edges, no limits. Scroll in any direction." },
  // Grouped: note details
  { content: "File attachments", color: "green", x: 0, y: 0, tags: "feature,grp-detail",
    description: "Drag files onto any note. Images, PDFs, anything up to 5MB." },
  { content: "Checklists & tags", color: "orange", x: 0, y: 0, tags: "feature,grp-detail",
    description: "Add checklists and tags to organize notes within a board." },
  { content: "Color coding", color: "yellow", x: 0, y: 0, tags: "feature,grp-detail",
    description: "Six colors. Cycle with 'c'. Meaning is up to you." },

  // ── Use cases (the why) ──
  // Standalone
  { content: "Brainstorming", color: "yellow", x: 0, y: 0, tags: "usecase",
    description: "Throw ideas on the wall. Rearrange. Cluster. Think out loud." },
  { content: "Design reviews", color: "blue", x: 0, y: 0, tags: "usecase",
    description: "Attach screenshots. Leave feedback on cards. Visual and collaborative." },
  { content: "Retrospectives", color: "green", x: 0, y: 0, tags: "usecase",
    description: "What went well, what didn't, what to try next. One board, done." },
  { content: "Mood boards", color: "pink", x: 0, y: 0, tags: "usecase",
    description: "Collect references, colors, and inspiration in one visual space." },
  // Grouped: project management
  { content: "Kanban boards", color: "blue", x: 0, y: 0, tags: "usecase,grp-pm",
    description: "Track work across columns. To do, doing, done — or whatever you want." },
  { content: "Project tracking", color: "green", x: 0, y: 0, tags: "usecase,grp-pm",
    description: "One board per project. See everything at a glance." },
  // Grouped: daily workflows
  { content: "Team standups", color: "pink", x: 0, y: 0, tags: "usecase,grp-daily",
    description: "Each person gets a note. Yesterday, today, blockers. Done in 5 minutes." },
  { content: "Todo lists", color: "orange", x: 0, y: 0, tags: "usecase,grp-daily",
    description: "Quick personal boards. Checklists on each card. Check off and move on." },

  // ── Philosophy (the vibe) ──
  // Standalone
  { content: "Free & open source", color: "orange", x: 0, y: 0, tags: "philosophy",
    description: "No credit card. No trial. No catch." },
  { content: "Self-hostable", color: "blue", x: 0, y: 0, tags: "philosophy",
    description: "One binary. Your server. Your data. Deploy in 30 seconds." },
  // Grouped: simplicity pair
  { content: "Gets out of your way", color: "green", x: 0, y: 0, tags: "philosophy,grp-simple",
    description: "No onboarding. No tutorials. No 47 settings to configure. Just start." },
  { content: "No bloat", color: "pink", x: 0, y: 0, tags: "philosophy,grp-simple",
    description: "No Gantt charts. No resource leveling. No enterprise pricing page." },
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
