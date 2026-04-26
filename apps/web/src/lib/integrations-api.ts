import { apiGet, apiPatch, apiPost } from "@/lib/api";

export type WebhookIntegrationResponse = {
  id: string;
  webhook_url: string;
  status: string;
};

export function getWebhookIntegration() {
  return apiGet<WebhookIntegrationResponse>("/integrations/webhook");
}

export function patchWebhookIntegration(webhook_url: string) {
  return apiPatch<WebhookIntegrationResponse>("/integrations/webhook", { webhook_url });
}

export function testWebhookIntegration() {
  return apiPost<{ ok: boolean; status: number }>("/integrations/webhook/test", {});
}
