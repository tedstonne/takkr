import { db } from "@/database";

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY,
    credential_id TEXT UNIQUE NOT NULL,
    public_key BLOB NOT NULL,
    counter INTEGER DEFAULT 0,
    font TEXT DEFAULT 'caveat',
    login DATETIME,
    created DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Migration: add font column if missing
try {
  db.exec(`ALTER TABLE users ADD COLUMN font TEXT DEFAULT 'caveat'`);
} catch (_) {}

// Migration: add preferred_color column
try {
  db.exec(`ALTER TABLE users ADD COLUMN preferred_color TEXT DEFAULT 'yellow'`);
} catch (_) {}

// Migration: add preferred_background column
try {
  db.exec(
    `ALTER TABLE users ADD COLUMN preferred_background TEXT DEFAULT 'grid'`,
  );
} catch (_) {}

// Migration: add display_name column
try {
  db.exec(`ALTER TABLE users ADD COLUMN display_name TEXT DEFAULT ''`);
} catch (_) {}

// Migration: add email column
try {
  db.exec(`ALTER TABLE users ADD COLUMN email TEXT DEFAULT ''`);
} catch (_) {}

// Migration: add avatar column (filename in uploads/)
try {
  db.exec(`ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT ''`);
} catch (_) {}

db.exec(`
  CREATE TABLE IF NOT EXISTS boards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    owner TEXT NOT NULL REFERENCES users(username),
    background TEXT DEFAULT 'grid',
    created DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    username TEXT NOT NULL REFERENCES users(username),
    invited_by TEXT NOT NULL,
    UNIQUE(board_id, username)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    description TEXT DEFAULT '',
    x INTEGER DEFAULT 100,
    y INTEGER DEFAULT 100,
    z INTEGER DEFAULT 1,
    color TEXT DEFAULT 'yellow',
    created_by TEXT NOT NULL,
    created DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Create indexes
db.exec(`CREATE INDEX IF NOT EXISTS idx_boards_owner ON boards(owner)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_members_board ON members(board_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_members_user ON members(username)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_notes_board ON notes(board_id)`);

// Migration: add background column if missing
try {
  db.exec(`ALTER TABLE boards ADD COLUMN background TEXT DEFAULT 'grid'`);
} catch (_) {}

// Migration: add description column if missing
try {
  db.exec(`ALTER TABLE notes ADD COLUMN description TEXT DEFAULT ''`);
} catch (_) {
  // column already exists
}

// Migration: add tags column if missing
try {
  db.exec(`ALTER TABLE notes ADD COLUMN tags TEXT DEFAULT ''`);
} catch (_) {}

// Migration: add checklist column if missing
try {
  db.exec(`ALTER TABLE notes ADD COLUMN checklist TEXT DEFAULT '[]'`);
} catch (_) {}

// Migration: add assigned_to column
try {
  db.exec(`ALTER TABLE notes ADD COLUMN assigned_to TEXT DEFAULT ''`);
} catch (_) {}

// Attachments table
db.exec(`
  CREATE TABLE IF NOT EXISTS attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    mime_type TEXT DEFAULT '',
    size INTEGER DEFAULT 0,
    path TEXT NOT NULL,
    created DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);
db.exec(
  `CREATE INDEX IF NOT EXISTS idx_attachments_note ON attachments(note_id)`,
);

// Viewport state per user per board (zoom + scroll position)
db.exec(`
  CREATE TABLE IF NOT EXISTS board_viewports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL REFERENCES users(username),
    board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    zoom REAL DEFAULT 1.0,
    scroll_x REAL DEFAULT 0,
    scroll_y REAL DEFAULT 0,
    UNIQUE(username, board_id)
  )
`);

// Migration: add seen column to members (0 = unseen invitation, 1 = seen)
try {
  db.exec(`ALTER TABLE members ADD COLUMN seen INTEGER DEFAULT 0`);
  db.exec(`UPDATE members SET seen = 1`);
} catch (_) {}

// Board invite links (one reusable link per board)
db.exec(`
  CREATE TABLE IF NOT EXISTS board_invites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    created_by TEXT NOT NULL,
    active INTEGER DEFAULT 1,
    created DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(board_id)
  )
`);
