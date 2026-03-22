import { apiGet, apiPatch } from "@/lib/api";

/** Matches backend onboarding_progress row (dates as ISO strings from JSON) */
export type OnboardingProgressDto = {
  id: string;
  current_step: number;
  completed_steps: number[];
  data: Record<string, unknown>;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type UpdateOnboardingPayload = {
  current_step?: number;
  completed_steps?: number[];
  data?: Record<string, unknown>;
  completed_at?: string | null;
};

export function getOnboardingMe() {
  return apiGet<OnboardingProgressDto>("/onboarding/me");
}

export function patchOnboardingMe(payload: UpdateOnboardingPayload) {
  return apiPatch<OnboardingProgressDto>("/onboarding/me", payload);
}