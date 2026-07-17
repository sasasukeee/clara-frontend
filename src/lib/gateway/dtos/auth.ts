import { z } from "zod";

export const AuthLoginSchema = z.object({
  usernameOrEmail: z.string().min(1),
  password: z.string().min(1),
});

export type AuthLoginDto = z.infer<typeof AuthLoginSchema>;

export const AuthSuccessResponseSchema = z.object({
  success: z.boolean(),
});

export type AuthSuccessResponseDto = z.infer<typeof AuthSuccessResponseSchema>;

export const GoogleCallbackSchema = z.union([
  z.object({ id_token: z.string().min(1) }),
  z.object({ code: z.string().min(1), state: z.string().min(1).optional() }),
]);

export type GoogleCallbackDto = z.infer<typeof GoogleCallbackSchema>;

export const GoogleOAuthCallbackResponseSchema = z.union([
  AuthSuccessResponseSchema,
  z.object({
    accessToken: z.string().min(1),
    refreshToken: z.string().min(1),
    user: z.object({ id: z.string().min(1) }),
  }),
]);

export type GoogleOAuthCallbackResponseDto = z.infer<
  typeof GoogleOAuthCallbackResponseSchema
>;
