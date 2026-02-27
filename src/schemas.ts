import { z } from "@hono/zod-openapi";

// --- Common ---
export const SlugParam = z.object({
  slug: z.string().openapi({ description: "Board slug", example: "my-board" }),
});

export const NoteIdParam = z.object({
  id: z
    .string()
    .transform(Number)
    .openapi({ description: "Note ID", example: "42" }),
});

export const AttachmentIdParam = z.object({
  id: z
    .string()
    .transform(Number)
    .openapi({ description: "Attachment ID", example: "7" }),
});

export const FilenameParam = z.object({
  filename: z.string().openapi({ description: "Avatar filename" }),
});

export const UsernameParam = z.object({
  username: z.string().openapi({ description: "Username" }),
});

// --- Auth ---
export const RegisterQuery = z.object({
  username: z
    .string()
    .min(3)
    .max(30)
    .openapi({ description: "Desired username", example: "alice" }),
});

export const RegisterVerifyBody = z.object({
  username: z.string(),
  credential: z
    .string()
    .openapi({ description: "Base64-encoded WebAuthn credential" }),
});

export const DiscoverVerifyBody = z.object({
  credential: z
    .string()
    .openapi({ description: "Base64-encoded WebAuthn credential" }),
});

// --- Board ---
export const BackgroundEnum = z.enum([
  "plain",
  "grid",
  "cork",
  "chalkboard",
  "lined",
  "canvas",
  "blueprint",
  "doodle",
]);

export const BackgroundBody = z.object({
  background: BackgroundEnum.openapi({ description: "Board background style" }),
});

export const ViewportBody = z.object({
  zoom: z.coerce
    .number()
    .min(0.25)
    .max(2)
    .openapi({ description: "Zoom level", example: 1 }),
  scroll_x: z.coerce
    .number()
    .openapi({ description: "Horizontal scroll", example: 0 }),
  scroll_y: z.coerce
    .number()
    .openapi({ description: "Vertical scroll", example: 0 }),
});

export const ViewportResponse = z.object({
  zoom: z.number(),
  scroll_x: z.number(),
  scroll_y: z.number(),
});

export const MemberBody = z.object({
  username: z.string().min(1).openapi({ description: "Username to invite" }),
});

// --- Note ---
export const ColorEnum = z.enum(["yellow", "pink", "green", "blue", "orange"]);

export const CreateNoteBody = z.object({
  content: z.string().min(1).max(80).openapi({ description: "Note title" }),
  color: ColorEnum.optional().openapi({ description: "Note color" }),
  x: z.coerce.number().optional().openapi({ description: "X position" }),
  y: z.coerce.number().optional().openapi({ description: "Y position" }),
});

export const UpdateNoteBody = z.object({
  content: z.string().max(80).optional(),
  description: z.string().optional(),
  tags: z.string().optional(),
  checklist: z
    .string()
    .optional()
    .openapi({ description: "JSON array of {text, done}" }),
  x: z.coerce.number().optional(),
  y: z.coerce.number().optional(),
  z: z.coerce.number().optional(),
  color: ColorEnum.optional(),
});

export const NoteResponse = z.object({
  id: z.number(),
  board_id: z.number(),
  content: z.string(),
  description: z.string(),
  x: z.number(),
  y: z.number(),
  z: z.number(),
  color: z.string(),
  tags: z.string(),
  checklist: z.string(),
  created_by: z.string(),
  created: z.string().optional(),
});

export const NoteDetailResponse = NoteResponse.extend({
  attachments: z.array(
    z.object({
      id: z.number(),
      note_id: z.number(),
      filename: z.string(),
      mime_type: z.string(),
      size: z.number(),
      path: z.string(),
      created: z.string().optional(),
    }),
  ),
});

export const AttachmentResponse = z.object({
  id: z.number(),
  note_id: z.number(),
  filename: z.string(),
  mime_type: z.string(),
  size: z.number(),
  path: z.string(),
  created: z.string().optional(),
});

// --- User ---
export const FontEnum = z.enum([
  "caveat",
  "indie-flower",
  "kalam",
  "parisienne",
  "cookie",
  "handlee",
  "sofia",
  "gochi-hand",
  "grand-hotel",
]);

export const FontBody = z.object({
  font: FontEnum.openapi({ description: "Handwriting font" }),
});

export const ColorPrefBody = z.object({
  color: z.string().openapi({ description: "Preferred note color" }),
});

export const BackgroundPrefBody = z.object({
  background: z.string().openapi({ description: "Preferred background" }),
});

export const DisplayNameBody = z.object({
  display_name: z.string().openapi({ description: "Display name" }),
});

export const EmailBody = z.object({
  email: z.string().openapi({ description: "Email address" }),
});

export const ProfileResponse = z.object({
  username: z.string(),
  displayName: z.string(),
  email: z.string(),
  avatar: z.string(),
  font: z.string(),
  preferredColor: z.string(),
});

export const PrefsResponse = z.object({
  font: z.string(),
  preferred_color: z.string(),
  preferred_background: z.string(),
});

export const BoardResponse = z.object({
  id: z.number(),
  slug: z.string(),
  name: z.string(),
  owner: z.string(),
  background: z.string(),
  created: z.string().optional(),
});

// --- Invitations ---
export const InvitationResponse = z.object({
  board_slug: z.string(),
  board_name: z.string(),
  invited_by: z.string(),
});

export const InviteLinkResponse = z.object({
  token: z.string(),
  url: z.string(),
});

export const TokenParam = z.object({
  token: z.string().openapi({ description: "Invite token" }),
});

// --- Generic ---
export const OkResponse = z.object({ ok: z.boolean() });
export const OkWithField = (field: string, schema: z.ZodType) =>
  z.object({ ok: z.boolean(), [field]: schema });
