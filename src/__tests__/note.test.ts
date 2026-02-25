import { beforeAll, describe, expect, test } from "bun:test";
import "@/schema";
import * as Note from "@/note";
import * as Board from "@/board";
import * as User from "@/user";
import { db } from "@/database";

describe("note", () => {
  let boardId: number;

  beforeAll(() => {
    db.exec("DELETE FROM attachments");
    db.exec("DELETE FROM notes");
    db.exec("DELETE FROM boards");
    db.exec("DELETE FROM users");
    User.create({ username: "noteuser", credential_id: "nc1", public_key: Buffer.from([1]), counter: 0 } as User.Record);
    const board = Board.create("note-board", "noteuser");
    boardId = board.id;
  });

  test("COLORS has 5 entries", () => {
    expect(Note.COLORS.length).toBe(5);
    expect(Note.COLORS).toContain("yellow");
    expect(Note.COLORS).toContain("pink");
  });

  test("create a note", () => {
    const note = Note.create(boardId, "Test note", "noteuser");
    expect(note.content).toBe("Test note");
    expect(note.board_id).toBe(boardId);
    expect(note.color).toBe("yellow");
    expect(note.x).toBe(100);
    expect(note.y).toBe(100);
    expect(note.z).toBe(1);
    expect(note.created_by).toBe("noteuser");
    expect(note.description).toBe("");
  });

  test("create with custom position and color", () => {
    const note = Note.create(boardId, "Pink note", "noteuser", 200, 300, "pink");
    expect(note.x).toBe(200);
    expect(note.y).toBe(300);
    expect(note.color).toBe("pink");
    expect(note.z).toBe(2);
  });

  test("byId finds note", () => {
    const note = Note.create(boardId, "Find me", "noteuser");
    expect(Note.byId(note.id)).not.toBeNull();
    expect(Note.byId(note.id)!.content).toBe("Find me");
  });

  test("byId returns null for unknown", () => {
    expect(Note.byId(99999)).toBeNull();
  });

  test("forBoard returns all notes for board", () => {
    const notes = Note.forBoard(boardId);
    expect(notes.length).toBeGreaterThanOrEqual(3);
    expect(notes.every((n) => n.board_id === boardId)).toBe(true);
  });

  test("update content", () => {
    const note = Note.create(boardId, "Original", "noteuser");
    expect(Note.update(note.id, { content: "Updated" })!.content).toBe("Updated");
  });

  test("update description", () => {
    const note = Note.create(boardId, "Desc", "noteuser");
    expect(Note.update(note.id, { description: "Details" })!.description).toBe("Details");
  });

  test("update tags", () => {
    const note = Note.create(boardId, "Tags", "noteuser");
    expect(Note.update(note.id, { tags: "bug,urgent" })!.tags).toBe("bug,urgent");
  });

  test("update checklist", () => {
    const note = Note.create(boardId, "CL", "noteuser");
    const cl = JSON.stringify([{ text: "item", done: false }]);
    expect(Note.update(note.id, { checklist: cl })!.checklist).toBe(cl);
  });

  test("update position", () => {
    const note = Note.create(boardId, "Pos", "noteuser");
    const u = Note.update(note.id, { x: 500, y: 600 })!;
    expect(u.x).toBe(500);
    expect(u.y).toBe(600);
  });

  test("update color", () => {
    const note = Note.create(boardId, "Color", "noteuser");
    expect(Note.update(note.id, { color: "green" })!.color).toBe("green");
  });

  test("update z", () => {
    const note = Note.create(boardId, "Z", "noteuser");
    expect(Note.update(note.id, { z: 99 })!.z).toBe(99);
  });

  test("update returns null for unknown note", () => {
    expect(Note.update(99999, { content: "nope" })).toBeNull();
  });

  test("remove deletes note", () => {
    const note = Note.create(boardId, "Delete me", "noteuser");
    Note.remove(note.id);
    expect(Note.byId(note.id)).toBeNull();
  });

  test("bringToFront increases z-index", () => {
    const n1 = Note.create(boardId, "Bottom", "noteuser");
    const n2 = Note.create(boardId, "Top", "noteuser");
    const brought = Note.bringToFront(n1.id, boardId);
    expect(brought!.z).toBeGreaterThan(n2.z);
  });

  test("bringToFront returns null for unknown", () => {
    expect(Note.bringToFront(99999, boardId)).toBeNull();
  });

  test("addAttachment and attachments", () => {
    const note = Note.create(boardId, "With file", "noteuser");
    const att = Note.addAttachment(note.id, "test.pdf", "application/pdf", 1024, "test_123.pdf");
    expect(att.filename).toBe("test.pdf");
    expect(att.mime_type).toBe("application/pdf");
    expect(att.size).toBe(1024);
    expect(Note.attachments(note.id).length).toBe(1);
  });

  test("attachmentById", () => {
    const note = Note.create(boardId, "Att", "noteuser");
    const att = Note.addAttachment(note.id, "img.png", "image/png", 2048, "img.png");
    expect(Note.attachmentById(att.id)!.filename).toBe("img.png");
  });

  test("attachmentById returns null for unknown", () => {
    expect(Note.attachmentById(99999)).toBeNull();
  });

  test("removeAttachment", () => {
    const note = Note.create(boardId, "Rm att", "noteuser");
    const att = Note.addAttachment(note.id, "rm.txt", "text/plain", 100, "rm.txt");
    Note.removeAttachment(att.id);
    expect(Note.attachmentById(att.id)).toBeNull();
  });

  test("attachmentCount", () => {
    const note = Note.create(boardId, "Count", "noteuser");
    Note.addAttachment(note.id, "a.txt", "text/plain", 10, "a.txt");
    Note.addAttachment(note.id, "b.txt", "text/plain", 20, "b.txt");
    expect(Note.attachmentCount(note.id)).toBe(2);
  });

  test("attachmentCount returns 0 for no attachments", () => {
    const note = Note.create(boardId, "Empty", "noteuser");
    expect(Note.attachmentCount(note.id)).toBe(0);
  });

  test("attachmentCountsForBoard returns Map", () => {
    const counts = Note.attachmentCountsForBoard(boardId);
    expect(counts instanceof Map).toBe(true);
  });

  test("attachments returns empty for note with none", () => {
    const note = Note.create(boardId, "No files", "noteuser");
    expect(Note.attachments(note.id)).toEqual([]);
  });
});
