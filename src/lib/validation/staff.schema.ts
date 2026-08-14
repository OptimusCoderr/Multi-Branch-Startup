import { z } from "zod";

export const inviteStaffSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  roleId: z.string().min(1, "Select a role"),
});
export type InviteStaffInput = z.infer<typeof inviteStaffSchema>;

export const updateStaffRoleSchema = z.object({
  roleId: z.string().min(1, "Select a role"),
});
export type UpdateStaffRoleInput = z.infer<typeof updateStaffRoleSchema>;

export const permissionOverrideSchema = z.object({
  permissionId: z.string().min(1),
  effect: z.enum(["GRANT", "DENY", "INHERIT"]),
});
export type PermissionOverrideInput = z.infer<typeof permissionOverrideSchema>;
