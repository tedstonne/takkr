export namespace Event {
  export enum Note {
    Created = "note:created",
    Updated = "note:updated",
    Deleted = "note:deleted",
  }
  export enum Member {
    Joined = "member:joined",
    Left = "member:left",
  }
}

export const names = (): string =>
  [...Object.values(Event.Note), ...Object.values(Event.Member)].join(",");

type Client = {
  id: string;
  boardId: number;
  writer: WritableStreamDefaultWriter;
};

const clients: Set<Client> = new Set();

export const connect = (
  writer: WritableStreamDefaultWriter,
  boardId: number,
): string => {
  const id: string = crypto.randomUUID();
  const client: Client = { id, boardId, writer };

  clients.add(client);

  return id;
};

export const disconnect = (id: string): void => {
  const client: Client | undefined = Array.from(clients).find(
    (c: Client) => c.id === id,
  );

  if (client) clients.delete(client);
};

const NEW_LINE = "\n";

type EventType = Event.Note | Event.Member;

const encode = (event: EventType, data: string): Uint8Array => {
  const encoder: TextEncoder = new TextEncoder();
  const lines: string[] = [
    `event: ${event}`,
    ...data.split(NEW_LINE).map((line: string) => `data: ${line}`),
    NEW_LINE,
  ];
  const message: string = lines.join(NEW_LINE);

  return encoder.encode(message);
};

// Broadcast to all clients connected to a specific board
export const broadcast = (
  boardId: number,
  event: EventType,
  data: string,
): void => {
  const encoded: Uint8Array = encode(event, data);

  for (const client of Array.from(clients)) {
    if (client.boardId === boardId) {
      client.writer.write(encoded).catch(() => {
        clients.delete(client);
      });
    }
  }
};
