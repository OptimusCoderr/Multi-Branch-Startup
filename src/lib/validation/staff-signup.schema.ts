import { z } from "zod";

// The code a staff member types at self-service sign-up (see
// src/server/actions/staff-signup.ts) to request to join a company —
// matched against Company.companyCode after the same normalization applied
// when that code was first set (see src/lib/company-code.ts).
export const joinCompanySchema = z.object({
  companyCode: z.string().trim().min(1, "Enter your company's code or RC number").max(50),
});

export type JoinCompanyInput = z.infer<typeof joinCompanySchema>;
