/**
 * Event types the API handles at `POST /stripe/webhook`.
 * When registering the endpoint in Stripe Dashboard → Developers → Webhooks,
 * subscribe to exactly these (or use “Select events” and pick each).
 */
export const STRIPE_WEBHOOK_EVENT_TYPES = [
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'customer.subscription.updated',
  'customer.subscription.created',
  'customer.subscription.deleted',
  'invoice.payment_failed',
] as const;
