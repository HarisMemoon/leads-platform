import { getAuthMe } from "@/lib/auth-api";
import { getOnboardingMe, type OnboardingProgressDto } from "@/lib/onboarding-api";
import {
  centsToNumber,
  getWalletMe,
  getWalletTransactions,
  type WalletAccountDto,
  type WalletTransactionDto,
} from "@/lib/wallet-api";

export type DashboardSummary = {
  me: Awaited<ReturnType<typeof getAuthMe>>;
  wallet: WalletAccountDto;
  onboarding: OnboardingProgressDto | null;
  txs: WalletTransactionDto[];
};

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const [me, wallet, onboarding, txs] = await Promise.all([
    getAuthMe(),
    getWalletMe(),
    getOnboardingMe().catch(() => null),
    getWalletTransactions({ limit: 100, offset: 0 }),
  ]);
  return { me, wallet, onboarding, txs };
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Sum debit amounts in current calendar month (dollars as number, from cents). */
export function debitSpendThisMonthDollars(txs: WalletTransactionDto[]): number {
  const start = startOfMonth(new Date()).getTime();
  return txs
    .filter((t) => t.type === "debit" && new Date(t.created_at).getTime() >= start)
    .reduce((s, t) => s + Math.abs(centsToNumber(t.amount_cents)) / 100, 0);
}

/** Count lead_purchase debits in current calendar month. */
export function leadPurchaseCountThisMonth(txs: WalletTransactionDto[]): number {
  const start = startOfMonth(new Date()).getTime();
  return txs.filter(
    (t) =>
      t.type === "debit" &&
      new Date(t.created_at).getTime() >= start &&
      t.reference_type === "lead_purchase",
  ).length;
}

/** Last 7 calendar days, transaction counts per day (oldest → newest). */
export function weeklyTxCounts(txs: WalletTransactionDto[]): number[] {
  const counts = Array.from({ length: 7 }, () => 0);
  const now = new Date();
  for (let i = 0; i < 7; i++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
    const ds = new Date(day);
    ds.setHours(0, 0, 0, 0);
    const de = new Date(day);
    de.setHours(23, 59, 59, 999);
    for (const tx of txs) {
      const t = new Date(tx.created_at);
      if (t >= ds && t <= de) counts[i]++;
    }
  }
  return counts.map((c) => Math.max(c, 0));
}

export function greetingName(me: { email: string } | undefined): string {
  if (!me?.email) return "there";
  const local = me.email.split("@")[0] ?? "there";
  return local.charAt(0).toUpperCase() + local.slice(1);
}

function timeAgoShort(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "Just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** Labels for the last 7 calendar days (oldest → newest), e.g. Mon, Tue, … */
export function last7DayLabels(): string[] {
  const labels: string[] = [];
  const now = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
    labels.push(d.toLocaleDateString("en-US", { weekday: "short" }));
  }
  return labels;
}

export function activityFromTransactions(txs: WalletTransactionDto[]): Array<{
  id: string;
  icon: string;
  msg: string;
  time: string;
}> {
  const sorted = [...txs].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const iconFor = (t: WalletTransactionDto) => {
    if (t.type === "credit") return "💳";
    const m: Record<string, string> = {
      lead_purchase: "📋",
      auto_buy: "🤖",
      dev_topup: "💳",
      stripe_topup: "💳",
      subscription: "⭐",
    };
    return m[t.reference_type] || "💫";
  };
  return sorted.slice(0, 10).map((t) => ({
    id: t.id,
    icon: iconFor(t),
    msg: t.description?.trim()
      ? t.description
      : `${t.type === "credit" ? "Credit" : "Debit"} · ${t.reference_type.replace(/_/g, " ")}`,
    time: timeAgoShort(t.created_at),
  }));
}
