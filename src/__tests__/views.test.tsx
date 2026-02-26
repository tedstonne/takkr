import { describe, expect, test } from "bun:test";
import "@/schema";
import * as Board from "@/board";
import * as Note from "@/note";
import * as User from "@/user";
import * as Member from "@/member";
import { db } from "@/database";
import {
  Alert,
  BoardView,
  Help,
  Home,
  Join,
  Login,
  Takkr,
  ZoomOverlay,
} from "@/views";
import { Layout } from "@/layout";

// Ensure test data
db.exec("DELETE FROM users WHERE username='viewuser'");
User.create({ username: "viewuser", credential_id: "vc1", public_key: Buffer.from([1]), counter: 0 } as User.Record);

describe("views", () => {
  test("Login renders", () => {
    const html = (<Login />).toString();
    expect(html).toContain("Sign In with Passkey");
  });

  test("Join renders", () => {
    const html = (<Join />).toString();
    expect(html).toContain("Create Account");
  });

  test("Home renders with boards", () => {
    const boards = Board.all("viewuser");
    const html = (<Home username="viewuser" boards={boards} />).toString();
    expect(html).toContain("viewuser");
    expect(html).toContain("takkr");
  });

  test("Home renders empty state", () => {
    const html = (<Home username="viewuser" boards={[]} />).toString();
    expect(html).toContain("viewuser");
  });

  test("Alert renders message", () => {
    const html = (<Alert message="Something went wrong" />).toString();
    expect(html).toContain("Something went wrong");
  });

  test("Help renders", () => {
    const html = (<Help />).toString();
    expect(html).toContain("Getting Started");
    expect(html).toContain("Keyboard Shortcuts");
  });

  test("Takkr renders a note card", () => {
    const note: Note.Record = {
      id: 1, board_id: 1, content: "Test", description: "desc",
      tags: "a,b", checklist: "[]", x: 10, y: 20, z: 1,
      color: "yellow", created_by: "viewuser", created: "2026-01-01",
      assigned_to: "", completed: "", deleted_at: "",
    };
    const html = (<Takkr note={note} />).toString();
    expect(html).toContain("Test");
    expect(html).toContain("takkr-yellow");
    expect(html).toContain('data-tags="a,b"');
    expect(html).toContain('data-author="viewuser"');
  });

  test("Takkr renders completed card with check badge", () => {
    const note: Note.Record = {
      id: 99, board_id: 1, content: "Done", description: "",
      tags: "", checklist: "[]", x: 0, y: 0, z: 1,
      color: "green", created_by: "viewuser", completed: "2026-01-15T12:00:00Z",
      assigned_to: "", deleted_at: "",
    };
    const html = (<Takkr note={note} />).toString();
    expect(html).toContain("completed");
    expect(html).toContain("takkr-check");
    expect(html).toContain('data-completed="2026-01-15T12:00:00Z"');
  });

  test("Takkr renders with selected class", () => {
    const note: Note.Record = {
      id: 2, board_id: 1, content: "Sel", description: "",
      tags: "", checklist: "[]", x: 0, y: 0, z: 1,
      color: "pink", created_by: "viewuser",
      assigned_to: "", completed: "", deleted_at: "",
    };
    const html = (<Takkr note={note} selected />).toString();
    expect(html).toContain("selected");
  });

  test("Takkr renders with oob swap", () => {
    const note: Note.Record = {
      id: 3, board_id: 1, content: "OOB", description: "",
      tags: "", checklist: "[]", x: 0, y: 0, z: 1,
      color: "green", created_by: "viewuser",
      assigned_to: "", completed: "", deleted_at: "",
    };
    const html = (<Takkr note={note} oob />).toString();
    expect(html).toContain("hx-swap-oob");
  });

  test("Takkr renders attachment count", () => {
    const note: Note.Record = {
      id: 4, board_id: 1, content: "Att", description: "",
      tags: "", checklist: "[]", x: 0, y: 0, z: 1,
      color: "blue", created_by: "viewuser",
      assigned_to: "", completed: "", deleted_at: "",
    };
    const html = (<Takkr note={note} attachmentCount={3} />).toString();
    expect(html).toContain("takkr-attachments");
    expect(html).toContain("3");
  });

  test("Takkr hides attachment badge when 0", () => {
    const note: Note.Record = {
      id: 5, board_id: 1, content: "No att", description: "",
      tags: "", checklist: "[]", x: 0, y: 0, z: 1,
      color: "orange", created_by: "viewuser",
      assigned_to: "", completed: "", deleted_at: "",
    };
    const html = (<Takkr note={note} attachmentCount={0} />).toString();
    expect(html).not.toContain("takkr-attachments");
  });

  test("ZoomOverlay renders", () => {
    const html = (<ZoomOverlay />).toString();
    expect(html).toContain("zoom-overlay");
    expect(html).toContain("zoom-close-btn");
    expect(html).toContain("zoom-back-checklist");
    expect(html).toContain("zoom-back-tags");
    expect(html).toContain("zoom-back-attachments");
    expect(html).toContain("zoom-file-input");
    expect(html).toContain("zoom-delete-btn");
    expect(html).toContain("zoom-complete-btn");
    expect(html).toContain("Mark complete");
  });

  test("Layout renders with title and children", () => {
    const html = (<Layout title="Test"><div>content</div></Layout>).toString();
    expect(html).toContain("takkr :: Test");
    expect(html).toContain("content");
    expect(html).toContain("styles.css");
  });

  test("Layout renders with scripts", () => {
    const html = (<Layout title="T" scripts={["/www/test.js"]}><span /></Layout>).toString();
    expect(html).toContain("/www/test.js");
  });

  test("Layout renders with font", () => {
    const html = (<Layout title="T" font="kalam"><span /></Layout>).toString();
    expect(html).toContain('data-font="kalam"');
  });

  test("BoardView renders full board", () => {
    const board: Board.Record = {
      id: 1, slug: "test", name: "Test", owner: "viewuser", background: "grid",
    };
    const notes: Note.Record[] = [{
      id: 1, board_id: 1, content: "Note1", description: "", tags: "",
      checklist: "[]", x: 0, y: 0, z: 1, color: "yellow", created_by: "viewuser",
      assigned_to: "", completed: "", deleted_at: "",
    }];
    const html = (<BoardView
      board={board}
      notes={notes}
      members={[]}
      username="viewuser"
      isOwner={true}
      font="caveat"
      preferredColor="yellow"
      displayName="View User"
      email="view@test.com"
      avatar=""
      allBoards={[{ board, role: "owner" }]}
      attachmentCounts={new Map()}
    />).toString();
    expect(html).toContain("Note1");
    expect(html).toContain("viewuser");
    expect(html).toContain("settings-modal");
    expect(html).toContain("/test");
    expect(html).toContain("View User");
  });

  test("BoardView renders with avatar", () => {
    const board: Board.Record = {
      id: 1, slug: "test", name: "Test", owner: "viewuser", background: "grid",
    };
    const html = (<BoardView
      board={board}
      notes={[]}
      members={[]}
      username="viewuser"
      isOwner={false}
      avatar="avatar.jpg"
      allBoards={[]}
      attachmentCounts={new Map()}
    />).toString();
    expect(html).toContain("avatar.jpg");
  });

  test("BoardView renders with members (owner view)", () => {
    const board: Board.Record = {
      id: 1, slug: "test", name: "Test", owner: "viewuser", background: "cork",
    };
    const members: Member.Record[] = [
      { id: 1, board_id: 1, username: "alice", invited_by: "viewuser" },
    ];
    const html = (<BoardView
      board={board}
      notes={[]}
      members={members}
      username="viewuser"
      isOwner={true}
      allBoards={[{ board, role: "owner" }]}
      attachmentCounts={new Map()}
    />).toString();
    // Settings modal should have collaborators section and background picker
    expect(html).toContain("alice");
    expect(html).toContain("Collaborators");
    expect(html).toContain("Board Background");
    expect(html).toContain("Invite by username");
    expect(html).toContain("settings-bg-grid");
  });

  test("BoardView non-owner hides background picker and collaborators", () => {
    const board: Board.Record = {
      id: 1, slug: "test", name: "Test", owner: "other", background: "grid",
    };
    const html = (<BoardView
      board={board}
      notes={[]}
      members={[]}
      username="viewuser"
      isOwner={false}
      allBoards={[]}
      attachmentCounts={new Map()}
    />).toString();
    expect(html).not.toContain("Board Background");
    expect(html).not.toContain("Collaborators");
  });

  test("BoardView renders member role in board list", () => {
    const board: Board.Record = {
      id: 1, slug: "test", name: "Test", owner: "other", background: "grid",
    };
    const html = (<BoardView
      board={board}
      notes={[]}
      members={[]}
      username="viewuser"
      isOwner={false}
      allBoards={[{ board, role: "member" }]}
      attachmentCounts={new Map()}
    />).toString();
    expect(html).toContain("member");
  });
});
