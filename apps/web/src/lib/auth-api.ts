import { apiGet } from "@/lib/api";

/** Response from GET /auth/me (user loaded from DB) */
export type AuthMeDto = {
  userId: string;
  email: string;
  role: string;
  full_name: string | null;
  company_name: string | null;
};

export function getAuthMe() {
  return apiGet<AuthMeDto>("/auth/me");
}
