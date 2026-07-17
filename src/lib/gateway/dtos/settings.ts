import { z } from "zod";

export const IdentitySettingsSchema = z
  .object({
    id: z.string().min(1),
    user_id: z.string().min(1),
    language: z.string().min(1).nullish(),
    theme: z.string().min(1).nullish(),
    notifications_enabled: z.boolean().nullish(),
    time_zone: z.string().min(1).nullish(),
    time_format: z.string().min(1).nullish(),
    locale: z.string().min(1).nullish(),
    created_at: z.string().datetime().or(z.string().min(1)),
    updated_at: z.string().datetime().or(z.string().min(1)),
  })
  .passthrough();

export type IdentitySettingsDto = z.infer<typeof IdentitySettingsSchema>;

export const UpdateIdentitySettingsSchema = z.object({
  language: z.string().min(1).optional(),
  theme: z.string().min(1).optional(),
  notifications_enabled: z.boolean().optional(),
  time_zone: z.string().min(1).optional(),
  time_format: z.string().min(1).optional(),
  locale: z.string().min(1).optional(),
});

export type UpdateIdentitySettingsDto = z.infer<typeof UpdateIdentitySettingsSchema>;

