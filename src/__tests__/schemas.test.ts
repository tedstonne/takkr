import { describe, expect, test } from "bun:test";
import * as S from "@/schemas";

describe("schemas", () => {
  // ViewportBody
  test("ViewportBody accepts valid data", () => {
    const result = S.ViewportBody.safeParse({ zoom: 1, scroll_x: 100, scroll_y: 200 });
    expect(result.success).toBe(true);
  });

  test("ViewportBody coerces strings to numbers", () => {
    const result = S.ViewportBody.safeParse({ zoom: "0.75", scroll_x: "100", scroll_y: "200" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.zoom).toBe(0.75);
    }
  });

  test("ViewportBody rejects zoom below min", () => {
    const result = S.ViewportBody.safeParse({ zoom: 0.1, scroll_x: 0, scroll_y: 0 });
    expect(result.success).toBe(false);
  });

  test("ViewportBody rejects zoom above max", () => {
    const result = S.ViewportBody.safeParse({ zoom: 3, scroll_x: 0, scroll_y: 0 });
    expect(result.success).toBe(false);
  });

  // CreateNoteBody
  test("CreateNoteBody accepts valid note", () => {
    const result = S.CreateNoteBody.safeParse({ content: "Hello", color: "pink", x: 100, y: 200 });
    expect(result.success).toBe(true);
  });

  test("CreateNoteBody requires content", () => {
    const result = S.CreateNoteBody.safeParse({ color: "pink" });
    expect(result.success).toBe(false);
  });

  test("CreateNoteBody rejects empty content", () => {
    const result = S.CreateNoteBody.safeParse({ content: "" });
    expect(result.success).toBe(false);
  });

  test("CreateNoteBody rejects content over 80 chars", () => {
    const result = S.CreateNoteBody.safeParse({ content: "a".repeat(81) });
    expect(result.success).toBe(false);
  });

  test("CreateNoteBody accepts content at 80 chars", () => {
    const result = S.CreateNoteBody.safeParse({ content: "a".repeat(80) });
    expect(result.success).toBe(true);
  });

  test("CreateNoteBody color and position are optional", () => {
    const result = S.CreateNoteBody.safeParse({ content: "Just a title" });
    expect(result.success).toBe(true);
  });

  test("CreateNoteBody rejects invalid color", () => {
    const result = S.CreateNoteBody.safeParse({ content: "Hi", color: "red" });
    expect(result.success).toBe(false);
  });

  // UpdateNoteBody
  test("UpdateNoteBody accepts partial updates", () => {
    const result = S.UpdateNoteBody.safeParse({ content: "Updated" });
    expect(result.success).toBe(true);
  });

  test("UpdateNoteBody accepts empty (all optional)", () => {
    const result = S.UpdateNoteBody.safeParse({});
    expect(result.success).toBe(true);
  });

  test("UpdateNoteBody accepts all fields", () => {
    const result = S.UpdateNoteBody.safeParse({
      content: "Title",
      description: "Details",
      tags: "bug,urgent",
      checklist: '[{"text":"item","done":false}]',
      x: 100,
      y: 200,
      z: 5,
      color: "blue",
    });
    expect(result.success).toBe(true);
  });

  // ColorEnum
  test("ColorEnum accepts valid colors", () => {
    for (const c of ["yellow", "pink", "green", "blue", "orange"]) {
      expect(S.ColorEnum.safeParse(c).success).toBe(true);
    }
  });

  test("ColorEnum rejects invalid colors", () => {
    expect(S.ColorEnum.safeParse("red").success).toBe(false);
    expect(S.ColorEnum.safeParse("").success).toBe(false);
  });

  // BackgroundEnum
  test("BackgroundEnum accepts all backgrounds", () => {
    for (const bg of ["plain", "grid", "cork", "chalkboard", "lined", "canvas", "blueprint", "doodle"]) {
      expect(S.BackgroundEnum.safeParse(bg).success).toBe(true);
    }
  });

  test("BackgroundEnum rejects invalid", () => {
    expect(S.BackgroundEnum.safeParse("photo").success).toBe(false);
  });

  // FontEnum
  test("FontEnum accepts all fonts", () => {
    for (const f of ["caveat", "indie-flower", "kalam", "parisienne", "cookie", "handlee", "sofia", "gochi-hand", "grand-hotel"]) {
      expect(S.FontEnum.safeParse(f).success).toBe(true);
    }
  });

  test("FontEnum rejects invalid", () => {
    expect(S.FontEnum.safeParse("comic-sans").success).toBe(false);
  });

  // RegisterQuery
  test("RegisterQuery accepts valid username", () => {
    const result = S.RegisterQuery.safeParse({ username: "alice" });
    expect(result.success).toBe(true);
  });

  test("RegisterQuery rejects short username", () => {
    const result = S.RegisterQuery.safeParse({ username: "ab" });
    expect(result.success).toBe(false);
  });

  test("RegisterQuery rejects long username", () => {
    const result = S.RegisterQuery.safeParse({ username: "a".repeat(31) });
    expect(result.success).toBe(false);
  });

  // SlugParam
  test("SlugParam accepts valid slug", () => {
    const result = S.SlugParam.safeParse({ slug: "my-board" });
    expect(result.success).toBe(true);
  });

  // NoteIdParam
  test("NoteIdParam transforms string to number", () => {
    const result = S.NoteIdParam.safeParse({ id: "42" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(42);
    }
  });

  // OkResponse
  test("OkResponse validates correctly", () => {
    expect(S.OkResponse.safeParse({ ok: true }).success).toBe(true);
    expect(S.OkResponse.safeParse({ ok: false }).success).toBe(true);
    expect(S.OkResponse.safeParse({}).success).toBe(false);
  });

  // BoardResponse
  test("BoardResponse validates board shape", () => {
    const result = S.BoardResponse.safeParse({
      id: 1,
      slug: "test",
      name: "test",
      owner: "alice",
      background: "grid",
    });
    expect(result.success).toBe(true);
  });

  // ProfileResponse
  test("ProfileResponse validates profile shape", () => {
    const result = S.ProfileResponse.safeParse({
      username: "alice",
      displayName: "Alice",
      email: "alice@test.com",
      avatar: "",
      font: "caveat",
      preferredColor: "yellow",
    });
    expect(result.success).toBe(true);
  });

  // PriorityEnum
  test("PriorityEnum accepts valid priorities", () => {
    for (const p of ["low", "medium", "high"]) {
      expect(S.PriorityEnum.safeParse(p).success).toBe(true);
    }
  });

  test("PriorityEnum rejects invalid", () => {
    expect(S.PriorityEnum.safeParse("critical").success).toBe(false);
    expect(S.PriorityEnum.safeParse("").success).toBe(false);
  });

  // StatusEnum
  test("StatusEnum accepts valid statuses", () => {
    for (const s of ["todo", "in_progress", "done"]) {
      expect(S.StatusEnum.safeParse(s).success).toBe(true);
    }
  });

  test("StatusEnum rejects invalid", () => {
    expect(S.StatusEnum.safeParse("cancelled").success).toBe(false);
    expect(S.StatusEnum.safeParse("").success).toBe(false);
  });

  // CreateNoteBody with PM fields
  test("CreateNoteBody accepts PM fields", () => {
    const result = S.CreateNoteBody.safeParse({
      content: "Task",
      due_date: "2026-03-15",
      priority: "high",
      status: "todo",
    });
    expect(result.success).toBe(true);
  });

  test("CreateNoteBody PM fields are optional", () => {
    const result = S.CreateNoteBody.safeParse({ content: "Simple" });
    expect(result.success).toBe(true);
  });

  // UpdateNoteBody with PM fields
  test("UpdateNoteBody accepts PM fields", () => {
    const result = S.UpdateNoteBody.safeParse({
      due_date: "2026-03-15",
      priority: "medium",
      status: "in_progress",
    });
    expect(result.success).toBe(true);
  });

  test("UpdateNoteBody accepts empty due_date to clear", () => {
    const result = S.UpdateNoteBody.safeParse({ due_date: "" });
    expect(result.success).toBe(true);
  });

  test("UpdateNoteBody accepts empty priority to clear", () => {
    const result = S.UpdateNoteBody.safeParse({ priority: "" });
    expect(result.success).toBe(true);
  });
});
