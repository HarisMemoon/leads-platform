import { apiGet } from "@/lib/api";

/** Response from GET /auth/me (user loaded from DB) */
export type AuthMeDto = {
  userId: string;
  email: string;
  role: string;
  full_name: string | null;
  company_name: string | null;
  /** When true, PATCH /distribution/me is rejected; customer UI should disable edits. */
  distribution_locked: boolean;
};

export function getAuthMe() {
  return apiGet<AuthMeDto>("/auth/me");
}
