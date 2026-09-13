import { apiGet, apiPost } from "@/lib/api";

/** Response from GET /auth/me (user loaded from DB) */
export type AuthMeDto = {
  userId: string;
  email: string;
  role: string;
  full_name: string | null;
  company_name: string | null;
  /** When true, PATCH /distribution/me is rejected; customer UI should disable edits. */
  distribution_locked: boolean;
  phone_verified: boolean;
};

export function getAuthMe() {
  return apiGet<AuthMeDto>("/auth/me");
}

export type TermsStatusDto = {
  accepted: boolean;
  terms_version: string;
  accepted_at: string | null;
};

export function getTermsStatus() {
  return apiGet<TermsStatusDto>("/terms/status");
}

export function acceptTerms() {
  return apiPost<{ accepted: boolean; accepted_at: string }>("/terms/accept", {});
}

export function sendPhoneVerificationCode() {
  return apiPost<{ sent: boolean }>("/auth/phone/send-code", {});
}

export function verifyPhoneVerificationCode(code: string) {
  return apiPost<{ verified: boolean }>("/auth/phone/verify-code", { code });
}
