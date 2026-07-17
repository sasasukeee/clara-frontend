import { gatewayRequestJson } from "@/lib/gateway/client";
import {
  IdentityUserSchema,
  UpdateProfileSchema,
  UserProfileSchema,
  type IdentityUserDto,
  type UpdateProfileDto,
  type UserProfileDto,
} from "@/lib/gateway/dtos";

export async function getIdentityMe() {
  return await gatewayRequestJson<IdentityUserDto>("/accounts/identity/me", {
    schema: IdentityUserSchema,
  });
}

export async function getUserProfile(userId: string) {
  return await gatewayRequestJson<UserProfileDto>(`/accounts/identity/profile/${userId}`, {
    schema: UserProfileSchema,
  });
}

export async function updateUserProfile(userId: string, payload: UpdateProfileDto) {
  const body = UpdateProfileSchema.parse(payload);
  return await gatewayRequestJson<UserProfileDto>(`/accounts/identity/profile/${userId}`, {
    method: "PATCH",
    body,
    schema: UserProfileSchema,
  });
}
