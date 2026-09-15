import { z } from "zod";

// settings_profile_desktop — name + bio are the only editable fields; email
// is read-only in the Stitch design (changing it would mean re-verifying
// identity, out of scope for MVP).
export const updateProfileSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  bio: z.string().trim().max(500, "Bio must be 500 characters or fewer").optional(),
});

// settings_security_desktop's change-password form. Same min-length rule as
// signup/admin-created accounts (validations/auth.ts, validations/admin.ts).
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
    confirmNewPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Passwords do not match",
    path: ["confirmNewPassword"],
  });
