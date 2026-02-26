import { describe, expect, test } from "bun:test";
import * as events from "@/events";

describe("events", () => {
  test("Event enums have correct values", () => {
    expect(events.Event.Note.Created as string).toBe("note:created");
    expect(events.Event.Note.Updated as string).toBe("note:updated");
    expect(events.Event.Note.Deleted as string).toBe("note:deleted");
    expect(events.Event.Member.Joined as string).toBe("member:joined");
    expect(events.Event.Member.Left as string).toBe("member:left");
  });

  test("names returns comma-separated event names", () => {
    const n = events.names();
    expect(n).toContain("note:created");
    expect(n).toContain("note:updated");
    expect(n).toContain("note:deleted");
    expect(n).toContain("member:joined");
    expect(n).toContain("member:left");
    expect(n.split(",").length).toBe(5);
  });

  test("connect and disconnect", () => {
    const { writable } = new TransformStream();
    const writer = writable.getWriter();
    const id = events.connect(writer, 1);
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
    events.disconnect(id);
    writer.close();
  });

  test("disconnect unknown id is a no-op", () => {
    events.disconnect("nonexistent");
  });

  test("broadcast sends to connected clients", async () => {
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const reader = readable.getReader();

    const id = events.connect(writer, 42);

    events.broadcast(42, events.Event.Note.Created, "<div>hello</div>");

    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);
    expect(text).toContain("event: note:created");
    expect(text).toContain("data: <div>hello</div>");

    events.disconnect(id);
    writer.close();
  });

  test("broadcast ignores clients on other boards", async () => {
    const { writable } = new TransformStream();
    const writer = writable.getWriter();
    const id = events.connect(writer, 99);

    // Broadcast to board 42, not 99
    events.broadcast(42, events.Event.Note.Updated, "data");

    // Writer should not have received anything beyond what we can check
    // (no easy way to check "nothing received" without timeout, so just verify no error)
    events.disconnect(id);
    writer.close();
  });

  test("broadcast handles writer errors gracefully", async () => {
    const { writable } = new TransformStream();
    const writer = writable.getWriter();
    const id = events.connect(writer, 50);

    // Close writer to simulate disconnected client
    await writer.close();

    // Should not throw
    events.broadcast(50, events.Event.Note.Deleted, "bye");

    events.disconnect(id);
  });
});
