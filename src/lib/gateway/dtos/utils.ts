import { z } from "zod";

export const IpInfoResponseSchema = z
  .object({
    ip: z.string().min(1),
    success: z.boolean(),
    type: z.string().min(1).optional(),
    country: z.string().min(1).optional(),
    region: z.string().min(1).optional(),
    city: z.string().min(1).optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
  })
  .passthrough();

export type IpInfoResponseDto = z.infer<typeof IpInfoResponseSchema>;

