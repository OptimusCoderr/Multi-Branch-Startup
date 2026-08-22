import { z } from "zod";

export const setDevicePinSchema = z.object({
  pin: z.string().regex(/^\d{4,6}$/, "PIN must be 4-6 digits"),
});
export type SetDevicePinInput = z.infer<typeof setDevicePinSchema>;

export const verifyDevicePinSchema = z.object({
  membershipId: z.string().min(1),
  pin: z.string().regex(/^\d{4,6}$/, "PIN must be 4-6 digits"),
});
export type VerifyDevicePinInput = z.infer<typeof verifyDevicePinSchema>;
