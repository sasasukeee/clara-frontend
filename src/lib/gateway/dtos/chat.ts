import { z } from "zod";

export const ChatConversationSchema = z.object({
  id: z.string().min(1),
  user_id: z.string().min(1),
  title: z.string().nullable().optional(),
  created_at: z.string().min(1),
  last_message_at: z.string().nullable().optional(),
});

export type ChatConversationDto = z.infer<typeof ChatConversationSchema>;

const SizeBytesSchema = z.union([z.number(), z.string()]).transform((value) => {
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
});

export const ChatMessageAttachmentSchema = z.object({
  id: z.string().min(1),
  message_id: z.string().min(1),
  conversation_id: z.string().min(1),
  type: z.literal("image"),
  path: z.string().min(1),
  mime_type: z.string().min(1),
  size_bytes: SizeBytesSchema,
  width: z.number().nullable().optional(),
  height: z.number().nullable().optional(),
  created_at: z.string().min(1),
});

export const ChatMessageSchema = z.object({
  id: z.string().min(1),
  conversation_id: z.string().min(1),
  role: z.enum(["user", "ai", "system"]),
  content: z.string(),
  created_at: z.string().min(1),
  message_attachments: ChatMessageAttachmentSchema.array().optional(),
});

export type ChatMessageDto = z.infer<typeof ChatMessageSchema>;
