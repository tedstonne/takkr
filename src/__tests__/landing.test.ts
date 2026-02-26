import { describe, expect, test, beforeAll } from "bun:test";
import "@/schema";
import { ensureLandingBoard, getLandingData } from "@/landing";
import * as Board from "@/board";
import * as Note from "@/note";
import { db } from "@/database";

describe("landing", () => {
  beforeAll(() => {
    // Clean up any existing landing data
    const board = Board.bySlug("__landing");
    if (board) {
      db.exec(`DELETE FROM notes WHERE board_id = ${board.id}`);
      db.exec(`DELETE FROM boards WHERE id = ${board.id}`);
    }
    db.exec("DELETE FROM users WHERE username = '__system'");
  });

  test("ensureLandingBoard creates system user", () => {
    ensureLandingBoard();
    const user = db.query("SELECT * FROM users WHERE username = '__system'").get();
    expect(user).not.toBeNull();
  });

  test("ensureLandingBoard creates __landing board", () => {
    const board = Board.bySlug("__landing");
    expect(board).not.toBeNull();
    expect(board!.owner).toBe("__system");
  });

  test("ensureLandingBoard seeds notes", () => {
    const board = Board.bySlug("__landing")!;
    const notes = Note.forBoard(board.id);
    expect(notes.length).toBeGreaterThanOrEqual(13);
  });

  test("seeded notes have content", () => {
    const board = Board.bySlug("__landing")!;
    const notes = Note.forBoard(board.id);
    for (const note of notes) {
      expect(note.content).toBeTruthy();
      expect(note.content.length).toBeGreaterThan(0);
    }
  });

  test("seeded notes have positions", () => {
    const board = Board.bySlug("__landing")!;
    const notes = Note.forBoard(board.id);
    for (const note of notes) {
      expect(typeof note.x).toBe("number");
      expect(typeof note.y).toBe("number");
    }
  });

  test("seeded notes include hero tag", () => {
    const board = Board.bySlug("__landing")!;
    const notes = Note.forBoard(board.id);
    const heroes = notes.filter(n => n.tags?.includes("hero"));
    expect(heroes.length).toBeGreaterThanOrEqual(1);
  });

  test("seeded notes include cta tag", () => {
    const board = Board.bySlug("__landing")!;
    const notes = Note.forBoard(board.id);
    const ctas = notes.filter(n => n.tags?.includes("cta"));
    expect(ctas.length).toBeGreaterThanOrEqual(1);
  });

  test("seeded notes have descriptions on feature cards", () => {
    const board = Board.bySlug("__landing")!;
    const notes = Note.forBoard(board.id);
    const withDesc = notes.filter(n => n.description && n.description.length > 0);
    expect(withDesc.length).toBeGreaterThanOrEqual(10);
  });

  test("ensureLandingBoard is idempotent (no duplicate notes)", () => {
    const board = Board.bySlug("__landing")!;
    const countBefore = Note.forBoard(board.id).length;
    ensureLandingBoard();
    const countAfter = Note.forBoard(board.id).length;
    expect(countAfter).toBe(countBefore);
  });

  test("getLandingData returns board and notes", () => {
    const data = getLandingData();
    expect(data).not.toBeNull();
    expect(data!.board.slug).toBe("__landing");
    expect(data!.notes.length).toBeGreaterThanOrEqual(13);
  });

  test("__landing slug is reserved", () => {
    const result = Board.valid("__landing");
    expect(result.ok).toBe(false);
  });

  test("seeded notes use all 5 colors", () => {
    const board = Board.bySlug("__landing")!;
    const notes = Note.forBoard(board.id);
    const colors = new Set(notes.map(n => n.color));
    expect(colors.has("yellow")).toBe(true);
    expect(colors.has("pink")).toBe(true);
    expect(colors.has("green")).toBe(true);
    expect(colors.has("blue")).toBe(true);
    expect(colors.has("orange")).toBe(true);
  });
});
