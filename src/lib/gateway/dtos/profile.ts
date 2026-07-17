import { z } from "zod";

export const UpdateProfileSchema = z.object({
  birthdate: z
    .string()
    .datetime()
    .nullable()
    .optional(),
  gender: z.string().trim().min(1).optional(),
});

export type UpdateProfileDto = z.infer<typeof UpdateProfileSchema>;

export const UserProfileSchema = z
  .object({
    id: z.string().min(1),
    user_id: z.string().min(1),
    first_name: z.string().nullish(),
    last_name: z.string().nullish(),
    bio: z.string().nullish(),
    avatar_url: z.string().url().nullish(),
    birthdate: z.string().datetime().or(z.string().min(1)).nullish(),
    gender: z.string().nullish(),
    website: z.string().url().nullish(),
    country: z.string().nullish(),
    city: z.string().nullish(),
    created_at: z.string().datetime().or(z.string().min(1)),
    updated_at: z.string().datetime().or(z.string().min(1)),
  })
  .passthrough();

export type UserProfileDto = z.infer<typeof UserProfileSchema>;
