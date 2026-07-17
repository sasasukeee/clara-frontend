import { z } from "zod";

export const IdentityCredentialsSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export type IdentityCredentialsDto = z.infer<typeof IdentityCredentialsSchema>;

export const IdentityRegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).regex(/^\S+$/, "Parola boşluk içeremez."),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  username: z.string().min(1).optional(),
});

export type IdentityRegisterDto = z.infer<typeof IdentityRegisterSchema>;

export const IdentityUpdateSchema = z.object({
  email: z.string().email().optional(),
  username: z.string().min(1).optional(),
  password: z
    .string()
    .min(1)
    .regex(/^\S+$/, "Parola boşluk içeremez.")
    .optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
});

export type IdentityUpdateDto = z.infer<typeof IdentityUpdateSchema>;

const IdentityUserRawSchema = z.object({
  userId: z.string().min(1).optional(),
  id: z.string().min(1).optional(),
  username: z.string().min(1).nullish(),
  email: z.string().email().nullish(),
  extra: z.unknown().nullish(),
});

export const IdentityUserSchema = z
  .union([IdentityUserRawSchema, z.object({ data: IdentityUserRawSchema })])
  .transform((value) => ("data" in value ? value.data : value))
  .refine((value) => Boolean(value.userId ?? value.id), {
    message: "Identity user id is missing.",
  })
  .transform((value) => ({
    userId: (value.userId ?? value.id)!,
    username: value.username ?? undefined,
    email: value.email ?? undefined,
    extra:
      value.extra && typeof value.extra === "object" && !Array.isArray(value.extra)
        ? (value.extra as Record<string, unknown>)
        : undefined,
  }));

export type IdentityUserDto = z.infer<typeof IdentityUserSchema>;

export const IdentityResolveStatusSchema = z.enum([
  "FOUND_BY_PROVIDER",
  "FOUND_BY_EMAIL",
  "NOT_FOUND",
]);

export type IdentityResolveStatus = z.infer<typeof IdentityResolveStatusSchema>;

export const ResolveIdentityUserSchema = z.object({
  provider: z.string().min(1).optional(),
  providerUserId: z.string().min(1).optional(),
  email: z.string().email().optional(),
  emailVerified: z.boolean().optional(),
});

export type ResolveIdentityUserDto = z.infer<typeof ResolveIdentityUserSchema>;

export const IdentityResolveResponseSchema = z.object({
  status: IdentityResolveStatusSchema,
  userId: z.string().min(1).optional(),
});

export type IdentityResolveResponseDto = z.infer<typeof IdentityResolveResponseSchema>;
