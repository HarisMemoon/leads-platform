"use client";

import Link from "next/link";
import MarketingNavbar from "@/components/MarketingNavbar";
import { useQuery } from "@tanstack/react-query";
import { getSubscriptionPricing } from "@/lib/subscriptions-api";

type IconProps = { className?: string };
const iconBase = "shrink-0";

const headingStyle = {
  fontFamily: "var(--font-heading)",
  fontWeight: 600,
} as const;

function IconFilters({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={`${iconBase} ${className}`}>
      <path
        d="M3 5h14M3 10h14M3 15h14"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle
        cx="7"
        cy="5"
        r="1.6"
        fill="#0A0B10"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <circle
        cx="13"
        cy="10"
        r="1.6"
        fill="#0A0B10"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <circle
        cx="9"
        cy="15"
        r="1.6"
        fill="#0A0B10"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function IconSplit({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={`${iconBase} ${className}`}>
      <rect
        x="3"
        y="4"
        width="14"
        height="12"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M10 4v12"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeDasharray="1.6 2"
      />
      <rect
        x="5"
        y="7.5"
        width="3"
        height="5"
        rx="0.8"
        fill="currentColor"
        opacity="0.4"
      />
    </svg>
  );
}

function IconGauge({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={`${iconBase} ${className}`}>
      <path
        d="M3.5 13.5a6.5 6.5 0 1 1 13 0"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M10 13.5 13 9"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="10" cy="13.5" r="1.1" fill="currentColor" />
    </svg>
  );
}

function IconFlow({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={`${iconBase} ${className}`}>
      <rect
        x="2"
        y="7"
        width="5"
        height="5"
        rx="1.3"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <rect
        x="13"
        y="7"
        width="5"
        height="5"
        rx="1.3"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M7.5 9.5h5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeDasharray="1.4 1.8"
      />
      <path
        d="M11 8l1.5 1.5L11 11"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconBell({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={`${iconBase} ${className}`}>
      <path
        d="M6 8a4 4 0 0 1 8 0c0 3 1.2 4 1.2 4H4.8S6 11 6 8Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M8.3 14.5a1.7 1.7 0 0 0 3.4 0"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconTarget({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={`${iconBase} ${className}`}>
      <circle cx="10" cy="10" r="6.5" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="10" cy="10" r="0.9" fill="currentColor" />
    </svg>
  );
}

function IconGrid({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={`${iconBase} ${className}`}>
      <rect
        x="3"
        y="3"
        width="6"
        height="6"
        rx="1.2"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <rect
        x="11"
        y="3"
        width="6"
        height="6"
        rx="1.2"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <rect
        x="3"
        y="11"
        width="6"
        height="6"
        rx="1.2"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <rect
        x="11"
        y="11"
        width="6"
        height="6"
        rx="1.2"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function IconToggle({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={`${iconBase} ${className}`}>
      <rect
        x="2.5"
        y="6"
        width="15"
        height="8"
        rx="4"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <circle cx="13.5" cy="10" r="2.4" fill="currentColor" />
    </svg>
  );
}

function IconCheckCircle({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={`${iconBase} ${className}`}>
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M6.8 10.2l2 2 4-4.4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCheck({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={`${iconBase} ${className}`}>
      <path
        d="M4.5 10.3l3.2 3.2L15.5 6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconDash({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={`${iconBase} ${className}`}>
      <path
        d="M5 10h10"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconZap({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={`${iconBase} ${className}`}>
      <path
        d="M11 2L4 12h5l-1 6 8-10h-5l2-6z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconShield({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={`${iconBase} ${className}`}>
      <path
        d="M10 2.5L3 5v4.5c0 4.2 3 7.8 7 9.5 4-1.7 7-5.3 7-9.5V5l-7-2.5z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function NetworkGraphic() {
  return (
    <div className="relative z-10 flex-1 w-full rounded-2xl border border-white/5 bg-[#0A0B10]/80 p-3 xs:p-1 flex items-center justify-center overflow-hidden">
      {/* Grid Lines - Shared across both views */}
      <div className="absolute inset-0 bg-[url('/textures/cubes.png')] opacity-5 mix-blend-overlay pointer-events-none" />

      {/* =========================================
          MOBILE & TABLET VIEW (Vertical Flow)
          Displays on screens smaller than 768px
      ========================================= */}
      <div className="relative w-full h-[340px] max-w-[280px] mx-auto flex md:hidden items-center justify-center">
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ overflow: "visible" }}
        >
          {/* Top Left (FL) to Center */}
          <path
            d="M 60 40 C 60 90, 140 90, 140 140"
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="2"
          />
          {/* Top Right (TX) to Center */}
          <path
            d="M 220 40 C 220 90, 140 90, 140 140"
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="2"
          />
          {/* Center to Bottom (CRM) */}
          <path
            d="M 140 160 C 140 200, 140 220, 140 260"
            fill="none"
            stroke="#6C5CE7"
            strokeWidth="2"
            strokeDasharray="6 6"
            className=""
          />
        </svg>

        {/* Top Left Node */}
        <div className="absolute left-[60px] top-[40px] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2">
          <div className="h-4 w-4 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <div className="h-1.5 w-1.5 rounded-full bg-white/60" />
          </div>
          <span className="text-[9px] text-white/40  tracking-widest font-mono whitespace-nowrap">
            Ping: FL
          </span>
        </div>

        {/* Top Right Node */}
        <div className="absolute left-[220px] top-[40px] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2">
          <div className="h-4 w-4 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <div className="h-1.5 w-1.5 rounded-full bg-white/60" />
          </div>
          <span className="text-[9px] text-white/40  tracking-widest font-mono whitespace-nowrap">
            Ping: TX
          </span>
        </div>

        {/* Center Node (Engine) */}
        <div className="absolute left-[140px] top-[140px] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#6C5CE7] to-[#10b981] p-[1px] shadow-[0_0_30px_rgba(108,92,231,0.3)] shrink-0">
            <div className="h-full w-full rounded-[11px] bg-[#12141C] flex items-center justify-center">
              <IconGrid className="h-6 w-6 text-white" />
            </div>
          </div>
          <span className="text-[10px] font-bold text-white tracking-widest  whitespace-nowrap">
            Engine
          </span>
        </div>

        {/* Bottom Node (CRM) */}
        <div className="absolute left-[140px] top-[260px] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-[#2FD699]/20 border border-[#2FD699]/50 flex items-center justify-center shadow-[0_0_20px_rgba(47,214,153,0.2)] shrink-0">
            <IconCheck className="h-4 w-4 text-[#2FD699]" />
          </div>
          <div className="flex flex-col items-center whitespace-nowrap text-center">
            <span className="text-[10px] font-bold text-[#2FD699]  tracking-wider">
              Post
            </span>
            <span className="text-[9px] text-white/50 font-mono">
              CRM Delivery
            </span>
          </div>
        </div>
      </div>

      {/* =========================================
          DESKTOP VIEW (Horizontal Flow)
          Displays on screens 768px and wider
      ========================================= */}
      <div className="relative w-full h-64 max-w-[300px] mx-auto hidden md:flex items-center justify-center">
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ overflow: "visible" }}
        >
          {/* Top Left to Center */}
          <path
            d="M 8 40 C 50 40, 70 120, 120 120"
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="2"
          />
          {/* Bottom Left to Center */}
          <path
            d="M 8 200 C 50 200, 70 120, 120 120"
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="2"
          />
          {/* Center to Right */}
          <path
            d="M 120 120 C 145 120, 165 120, 196 120"
            fill="none"
            stroke="#6C5CE7"
            strokeWidth="2"
            strokeDasharray="6 6"
            className=""
          />
        </svg>

        {/* Left Nodes */}
        <div className="absolute left-0 top-[40px] -translate-y-1/2 flex items-center gap-2">
          <div className="h-4 w-4 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <div className="h-1.5 w-1.5 rounded-full bg-white/60" />
          </div>
          <span className="text-[9px] text-white/40  tracking-widest font-mono whitespace-nowrap">
            Ping: FL
          </span>
        </div>

        <div className="absolute left-0 top-[200px] -translate-y-1/2 flex items-center gap-2">
          <div className="h-4 w-4 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <div className="h-1.5 w-1.5 rounded-full bg-white/60" />
          </div>
          <span className="text-[9px] text-white/40  tracking-widest font-mono whitespace-nowrap">
            Ping: TX
          </span>
        </div>

        {/* Center Node */}
        <div className="absolute left-[120px] top-[130px] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#6C5CE7] to-[#10b981] p-[1px] shadow-[0_0_30px_rgba(108,92,231,0.3)] shrink-0">
            <div className="h-full w-full rounded-[11px] bg-[#12141C] flex items-center justify-center">
              <IconGrid className="h-6 w-6 text-white" />
            </div>
          </div>
          <span className="text-[10px] font-bold text-white tracking-widest  whitespace-nowrap">
            Engine
          </span>
        </div>

        {/* Right Node */}
        <div className="absolute left-[180px] top-[120px] -translate-y-1/2 flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-[#2FD699]/20 border border-[#2FD699]/50 flex items-center justify-center shadow-[0_0_20px_rgba(47,214,153,0.2)] shrink-0">
            <IconCheck className="h-4 w-4 text-[#2FD699]" />
          </div>
          <div className="flex flex-col whitespace-nowrap">
            <span className="text-[10px] font-bold text-[#2FD699]  tracking-wider">
              Post
            </span>
            <span className="text-[9px] text-white/50 font-mono">
              CRM Delivery
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Data                                                                  */
/* ---------------------------------------------------------------------- */

const FEED: {
  city: string;
  state: string;
  situation: string;
  type: "Exclusive" | "Non Exclusive";
  slots?: string;
}[] = [
  {
    city: "Mesquite",
    state: "TX",
    situation: "Pre-foreclosure",
    type: "Exclusive",
  },
  {
    city: "Gastonia",
    state: "NC",
    situation: "Inherited property",
    type: "Non Exclusive",
    slots: "2 of 4 open",
  },
  {
    city: "Peoria",
    state: "AZ",
    situation: "Tired landlord",
    type: "Exclusive",
  },
  {
    city: "Warren",
    state: "OH",
    situation: "Tax delinquent",
    type: "Non Exclusive",
    slots: "1 of 4 open",
  },
  {
    city: "Macon",
    state: "GA",
    situation: "Vacant property",
    type: "Exclusive",
  },
];

const PAIN = [
  {
    before: "Sourcing across scattered lists and vendors",
    after: "One searchable marketplace by market and buy box",
  },
  {
    before: "Manually re-keying leads into your CRM",
    after: "CRM-ready delivery the moment a lead is purchased",
  },
  {
    before: "Spend that's hard to see coming",
    after: "Caps, rules, and wallet controls you set yourself",
  },
  {
    before: "Fast-moving leads you find out about too late",
    after: "Pro early access and real-time Ping/Post routing",
  },
];

const STEPS = [
  {
    title: "Define your markets and buy box",
    copy: "Set the states, cities, property types, and seller situations you actually want to see.",
    icon: IconTarget,
  },
  {
    title: "Browse leads or set automated rules",
    copy: "Shop the marketplace yourself, or let saved rules watch it for you.",
    icon: IconGrid,
  },
  {
    title: "Choose Exclusive or Non Exclusive",
    copy: "Pick the access level that fits the lead and your strategy.",
    icon: IconToggle,
  },
  {
    title: "Work it in your CRM",
    copy: "The lead lands in your pipeline — Open, Contacted, Under Contract, Closed.",
    icon: IconCheckCircle,
  },
];

const FEATURES = [
  {
    title: "Search leads your way",
    copy: "Filter by state, city, property type, seller situation, timeline, and condition. Contact details stay protected until you buy.",
    icon: IconFilters,
    chips: [
      "State",
      "City",
      "Property type",
      "Seller situation",
      "Timeline",
      "Condition",
    ],
  },
  {
    title: "Choose the purchase option that fits",
    copy: "Exclusive for full control, or Non Exclusive for lower-cost access with a limited number of buyer slots.",
    icon: IconSplit,
    chips: ["Exclusive", "Non Exclusive"],
  },
  {
    title: "Automate without losing control",
    copy: "Set markets, lead types, and purchase preference. Every purchase draws from a wallet you fund and watch.",
    icon: IconGauge,
    chips: ["Daily cap", "Weekly cap", "Monthly cap"],
  },
  {
    title: "Deliver leads straight to your CRM",
    copy: "Route purchased leads to GoHighLevel, LeadConnector, Zapier, or any HTTPS webhook. Send a test lead before you go live.",
    icon: IconFlow,
    chips: ["GoHighLevel", "LeadConnector", "Zapier", "Webhook"],
  },
  {
    title: "Stay ahead with market alerts",
    copy: "Get notified by email or SMS — instantly, or in hourly, daily, or weekly digests.",
    icon: IconBell,
    chips: ["Instant", "Hourly", "Daily", "Weekly"],
  },
];

const PIPELINE_STAGES = [
  "Open",
  "Contacted",
  "Under Contract",
  "Closed",
] as const;

const PURCHASE_COMPARISON = [
  {
    label: "Buyers on this lead",
    exclusive: "Just you",
    nonExclusive: "A limited number of slots, shown before you buy",
  },
  {
    label: "Contact details",
    exclusive: "Revealed after purchase",
    nonExclusive: "Revealed after purchase",
  },
  {
    label: "Relative cost",
    exclusive: "Standard marketplace price",
    nonExclusive: "Lower cost",
  },
  {
    label: "Requires Pro membership",
    exclusive: "No",
    nonExclusive: "Yes",
    nonExclusiveOk: true,
  },
];

/* ---------------------------------------------------------------------- */
/* Hooks                                                                  */
/* ---------------------------------------------------------------------- */

/* ---------------------------------------------------------------------- */
/* Small building blocks                                                  */
/* ---------------------------------------------------------------------- */

function Reveal({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
  index?: number;
}) {
  return <div className={className}>{children}</div>;
}

function SlotDots({ label }: { label: string }) {
  const match = label.match(/(\d+) of (\d+)/);
  const open = match ? parseInt(match[1], 10) : 0;
  const total = match ? parseInt(match[2], 10) : 4;
  return (
    <span className="inline-flex items-center gap-[3px] align-middle">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`h-[6px] w-[6px] rounded-[2px] ${i < open ? "bg-[#2FD699]" : "bg-white/15"}`}
        />
      ))}
    </span>
  );
}

function PipelineStepper({
  current,
}: {
  current: (typeof PIPELINE_STAGES)[number];
}) {
  const currentIndex = PIPELINE_STAGES.indexOf(current);
  return (
    <div className="flex items-center">
      {PIPELINE_STAGES.map((stage, i) => (
        <div key={stage} className="flex flex-1 items-center last:flex-none">
          <div className="flex flex-col items-center gap-1.5">
            <span
              className={`h-2.5 w-2.5 rounded-full border ${i === currentIndex ? "border-[#2FD699] bg-[#2FD699]" : i < currentIndex ? "border-white/40 bg-white/40" : "border-white/20 bg-transparent"}`}
            />
            <span
              className={`text-[10px] ${i === currentIndex ? "text-[#2FD699]" : "text-white/35"}`}
            >
              {stage}
            </span>
          </div>
          {i < PIPELINE_STAGES.length - 1 && (
            <span
              className={`mx-1.5 h-px flex-1 ${i < currentIndex ? "bg-white/30" : "bg-white/10"}`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function chipTone(label: string) {
  if (label === "Exclusive") return "bg-[#6C5CE7]/20 text-[#A9A0FF]";
  if (label === "Non Exclusive") return "bg-[#E8A33D]/15 text-[#E8A33D]";
  return "bg-white/5 text-white/55";
}

/* ---------------------------------------------------------------------- */
/* Navbar Wrapper (Inline to fix background blending issues)              */
/* ---------------------------------------------------------------------- */
function MarketingHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50  ">
      <MarketingNavbar />
    </header>
  );
}

/* ---------------------------------------------------------------------- */
/* Page                                                                  */
/* ---------------------------------------------------------------------- */

export default function Home() {
  const { data: pricing } = useQuery({
    queryKey: ["subscriptions", "pricing"],
    queryFn: getSubscriptionPricing,
    staleTime: 5 * 60 * 1000,
  });

  const proPrice = pricing?.proDisplayPrice ?? "$49";
  const sharedInbound = pricing
    ? `$${Math.round(pricing.sharedInboundPriceCents / 100)}`
    : "$30";
  const sharedOutbound = pricing
    ? `$${Math.round(pricing.sharedOutboundPriceCents / 100)}`
    : "$20";
  return (
    <main
      className="min-h-screen bg-[#0A0B10] text-[#F3F4F8]"
      style={{ fontFamily: "var(--font-body)" }}
    >
      <MarketingHeader />

      {/* Hero */}
      <section className="relative overflow-hidden pt-16 md:pt-24">
        <div className="relative mx-auto grid max-w-6xl gap-12 px-6 pb-20 pt-16 md:grid-cols-[1.1fr_0.9fr] md:pt-24">
          <div className="flex flex-col justify-center">
            <h1
              className="text-[clamp(2.5rem,5vw,4rem)] leading-[1.05] tracking-tight text-white"
              style={{ fontFamily: "var(--font-heading)", fontWeight: 600 }}
            >
              Motivated-seller leads, <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-white/50">
                matched to your buy box.
              </span>
            </h1>
            <p className="mt-6 max-w-[46ch] text-lg leading-relaxed text-white/60">
              Newleey gives real-estate investors one place to discover
              motivated-seller leads, choose the right purchase option, automate
              matching purchases, and send opportunities directly into their
              CRM.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link
                href="/register"
                className="rounded-xl bg-[#6C5CE7] px-6 py-3.5 text-[15px] font-semibold text-white hover:bg-[#7A6BF0]"
              >
                Browse the marketplace
              </Link>
              <a
                href="#how-it-works"
                className="rounded-xl border border-white/15 px-6 py-3.5 text-[15px] font-semibold text-white/85 transition hover:bg-white/5 hover:text-white"
              >
                See how it works
              </a>
            </div>
            <p className="mt-6 text-sm font-medium text-white/35 flex items-center gap-2">
              <IconCheckCircle className="h-4 w-4 text-[#2FD699]" />
              Free to create — no subscription required to buy Exclusive leads.
            </p>
          </div>

          {/* Intelligent Distribution & Wallet Preview */}
          <div className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#12141C] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
            {/* Background Animated Gradients & Scanners */}
            {/* Top Header */}
            <div className="relative flex items-center justify-between mb-5 text-xs">
              <span className=" tracking-wider font-semibold text-transparent bg-clip-text bg-gradient-to-r from-white to-white/50">
                Smart Distribution Engine
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-[#2FD699]/10 px-2.5 py-1 border border-[#2FD699]/20 text-[#2FD699]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#2FD699]" />
                Ping / Post Active
              </span>
            </div>

            {/* Wallet Hero Widget */}
            <div className="relative mb-4 overflow-hidden rounded-xl border border-white/10 bg-[#1A1C29] p-5 shadow-inner">
              <div className="absolute right-0 bottom-0 opacity-[0.03] text-[8rem] leading-none font-bold transform translate-x-4 translate-y-6">
                $
              </div>
              <div className="relative flex justify-between items-start">
                <div>
                  <p className="text-[10px]  tracking-widest text-white/40 mb-1">
                    Available Balance
                  </p>
                  <p
                    className="text-3xl font-bold text-white tracking-tight"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    $1,929.00
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[9px]  tracking-wide text-white/30 mb-1.5">
                    Auto-reload
                  </p>
                  <div className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full px-2.5 py-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-white/20" />
                    <span className="text-[10px] text-white/50 font-medium">
                      Off
                    </span>
                  </div>
                </div>
              </div>

              {/* Wallet Micro-Metrics */}
              <div className="relative mt-5 grid grid-cols-2 lg:grid-cols-4 gap-2">
                {[
                  { label: "Funded", val: "$2,000" },
                  { label: "Spent", val: "$71", alert: true },
                  {
                    label: "Capacity",
                    val: "16 leads",
                    color: "text-[#2FD699]",
                  },
                  { label: "Exclusive", val: "$120/ea" },
                ].map((stat, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-white/5 bg-[#12141C] p-2.5 text-center flex flex-col justify-center"
                  >
                    <span className="text-[8px]  tracking-widest text-white/35 mb-1 block whitespace-nowrap overflow-hidden text-ellipsis">
                      {stat.label}
                    </span>
                    <span
                      className={`text-[11px] font-semibold ${stat.color || "text-white/80"} ${stat.alert ? "text-[#E8A33D]" : ""}`}
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      {stat.val}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Complex Engine / Ping Post Visualizer */}
            <div className="relative mb-4 rounded-xl border border-[#6C5CE7]/30 bg-gradient-to-r from-[#6C5CE7]/[0.05] to-transparent p-4 overflow-hidden">
              {/* Laser line animation */}
              <div className="absolute left-0 top-1/2 w-full h-px bg-gradient-to-r from-transparent via-[#6C5CE7]/40 to-transparent -translate-y-1/2" />

              <div className="relative z-10 flex justify-between items-center">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[9px]  tracking-wider text-[#A9A0FF] font-semibold bg-[#6C5CE7]/10 border border-[#6C5CE7]/20 px-2 py-0.5 rounded w-fit">
                    Real-time Routing
                  </span>
                  <p className="text-[11px] text-white/60">
                    Matching 433 Markets & Buy Box...
                  </p>
                </div>
                <div className="flex -space-x-1.5">
                  <div className="h-6 w-6 rounded-full border-2 border-[#12141C] bg-[#E8A33D] flex items-center justify-center shadow-lg z-30">
                    <span className="text-[8px] font-bold text-[#12141C]">
                      TX
                    </span>
                  </div>
                  <div className="h-6 w-6 rounded-full border-2 border-[#12141C] bg-[#2FD699] flex items-center justify-center shadow-lg z-20">
                    <span className="text-[8px] font-bold text-[#12141C]">
                      EX
                    </span>
                  </div>
                  <div className="h-6 w-6 rounded-full border-2 border-[#12141C] bg-[#6C5CE7] flex items-center justify-center shadow-lg z-10">
                    <svg
                      className="w-3 h-3 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Row: Stripe Top-up & Transactions */}
            <div className="grid grid-cols-[1fr_1.5fr] gap-3">
              {/* Stripe Add Funds UI */}
              <div className="rounded-xl border border-white/10 bg-gradient-to-br from-[#1A1C29] to-[#12141C] p-3 flex flex-col justify-between relative overflow-hidden group hover:border-white/20 transition-colors cursor-pointer">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[9px] text-white/40  tracking-widest">
                    Top-up
                  </span>
                  <span className="text-[10px] font-bold italic text-white/70 tracking-tighter">
                    VISA
                  </span>
                </div>
                <div>
                  <p className="text-[10px] text-white/50 tracking-[0.2em] mb-1">
                    •••• 4242
                  </p>
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] text-[#2FD699] font-medium">
                      + $500 Preset
                    </p>
                    <span className="h-4 w-4 rounded-full bg-white/5 flex items-center justify-center text-[10px] text-white/40 group-hover:bg-white/10 transition-colors">
                      +
                    </span>
                  </div>
                </div>
              </div>

              {/* Transactions Mini-Ledger */}
              <div className="rounded-xl border border-white/10 bg-[#1A1C29] p-3 flex flex-col justify-between">
                <div className="flex justify-between items-center mb-2.5">
                  <span className="text-[9px] text-white/40  tracking-widest">
                    History
                  </span>
                  <span className="text-[9px] text-[#6C5CE7] hover:text-[#A9A0FF] cursor-pointer transition-colors">
                    Rows 1-3
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <div className="h-1.5 w-1.5 rounded-full bg-[#E8A33D] shrink-0" />
                      <span className="text-[10px] text-white/70 truncate">
                        Lead purchase
                      </span>
                    </div>
                    <span
                      className="text-[10px] text-white/90 font-medium shrink-0"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      -$71.00
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <div className="h-1.5 w-1.5 rounded-full bg-[#2FD699] shrink-0" />
                      <span className="text-[10px] text-white/40 truncate">
                        Stripe top-up
                      </span>
                    </div>
                    <span
                      className="text-[10px] text-white/50 font-medium shrink-0"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      +$1,000.00
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Highlights / Core Capabilities (Place directly below Hero) */}
      <section className="relative overflow-hidden border-t border-white/[0.06] bg-[#0A0B10] py-24">
        {/* Section-specific animations */}

        {/* Ambient Background Blur */}

        <div className="relative mx-auto max-w-6xl px-6">
          <Reveal>
            <div className="max-w-3xl mx-auto text-center mb-16">
              <h2 className="text-sm font-bold  tracking-[0.2em] text-[#6C5CE7] mb-4">
                The Smart Automated Marketplace
              </h2>
              <h3
                className="text-3xl md:text-5xl text-white tracking-tight mb-6"
                style={{ fontFamily: "var(--font-heading)", fontWeight: 600 }}
              >
                Precision control meets <br className="hidden md:block" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-white/80 to-white/40">
                  intelligent distribution.
                </span>
              </h3>
              <p className="text-lg text-white/50 leading-relaxed">
                Take total command of your acquisition. Our complex routing
                engines process thousands of data points instantly to drop the
                perfect leads straight into your pipeline.
              </p>
            </div>
          </Reveal>

          {/* Highlights Grid */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Card 1: Absolute Control */}
            <Reveal index={1}>
              <div className="group relative flex h-full flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[#12141C] p-8 transition-colors hover:bg-[#161823]">
                {/* Visualizer */}
                <div className="relative mb-8 h-32 w-full rounded-xl border border-white/5 bg-[#0A0B10]/50 p-4 flex flex-col justify-center gap-3 overflow-hidden">
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center">
                    <IconTarget className="h-20 w-20 text-white/5" />
                  </div>
                  <div className="flex gap-2 relative z-10">
                    <span className="rounded-full border border-[#2FD699]/30 bg-[#2FD699]/10 px-3 py-1 text-[10px] font-medium tracking-wide text-[#2FD699] ">
                      State: Texas
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-medium tracking-wide text-white/60 ">
                      City: Austin
                    </span>
                  </div>
                  <div className="flex gap-2 relative z-10">
                    <span className="rounded-full border border-[#E8A33D]/30 bg-[#E8A33D]/10 px-3 py-1 text-[10px] font-medium tracking-wide text-[#E8A33D] ">
                      Type: Pre-Foreclosure
                    </span>
                  </div>
                </div>

                <h4 className="text-xl font-semibold text-white mb-3">
                  Hyper-Targeted Buy Box
                </h4>
                <p className="text-[15px] text-white/50 leading-relaxed">
                  Never pay for a lead outside your strike zone. Dictate your
                  exact criteria down to the state, city, property type, and
                  highly-specific seller situations.
                </p>
              </div>
            </Reveal>

            {/* Card 2: Exclusive vs Non-Exclusive */}
            <Reveal index={2}>
              <div className="group relative flex h-full flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[#12141C] p-8 transition-colors hover:bg-[#161823]">
                {/* Visualizer */}
                <div className=" relative mb-8 h-32 w-full rounded-xl border border-white/5 bg-[#0A0B10]/50 p-4 flex items-center justify-center gap-6 overflow-hidden">
                  {/* Exclusive Side */}
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-10 w-10 rounded-full border border-[#A9A0FF]/30 bg-[#6C5CE7]/20 flex items-center justify-center relative">
                      <div className="h-4 w-4 rounded-full bg-[#A9A0FF] shadow-[0_0_15px_#6C5CE7]" />
                    </div>
                    <span className="text-[10px]  tracking-wider text-white/40 font-semibold">
                      Exclusive
                    </span>
                  </div>
                  {/* Divider */}
                  <div className="h-full w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />
                  {/* Non-Exclusive Side */}
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex -space-x-3">
                      <div className="h-10 w-10 rounded-full border border-white/10 bg-[#1A1C29] flex items-center justify-center z-20">
                        <div className="h-3 w-3 rounded-full bg-[#E8A33D]" />
                      </div>
                      <div className="h-10 w-10 rounded-full border border-white/10 bg-[#1A1C29] flex items-center justify-center z-10">
                        <div className="h-3 w-3 rounded-full bg-white/20" />
                      </div>
                    </div>
                    <span className="text-[10px]  tracking-wider text-white/40 font-semibold">
                      Shared (Slots)
                    </span>
                  </div>
                </div>

                <h4 className="text-xl font-semibold text-white mb-3">
                  Strategic Ownership Options
                </h4>
                <p className="text-[15px] text-white/50 leading-relaxed">
                  Own the conversation 100% with Exclusive routing, or stretch
                  your budget further with discounted Non-Exclusive shared
                  leads. Total flexibility to match your acquisition strategy.
                </p>
              </div>
            </Reveal>

            {/* Card 3: Intelligent Ping/Post Engine */}
            <Reveal index={3} className="md:col-span-2">
              <div className="group relative flex flex-col md:flex-row overflow-hidden rounded-[2rem] border border-[#6C5CE7]/30 bg-gradient-to-br from-[#12141C] to-[#161825] p-8 md:p-12 shadow-2xl">
                {/* Text Content */}
                <div className="relative z-10 flex-1 flex flex-col justify-center md:pr-12 mb-10 md:mb-0">
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#A9A0FF]/30 bg-[#6C5CE7]/10 px-3 py-1 mb-6 w-fit">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#A9A0FF]" />
                    <span className="text-[10px] font-bold  tracking-wider text-[#A9A0FF]">
                      Enterprise Grade
                    </span>
                  </div>
                  <h4 className="text-2xl md:text-3xl font-semibold text-white mb-4">
                    Intelligent Ping & Post Network
                  </h4>
                  <p className="text-base text-white/60 leading-relaxed mb-6">
                    Tap directly into live vendor feeds. Our proprietary
                    distribution engine evaluates thousands of real-time pings
                    per second, matching precise market metrics to your active
                    wallet rules—securing you the highest quality posts before
                    the competition even blinks.
                  </p>
                  <ul className="space-y-3">
                    {[
                      "Real-time bid evaluation",
                      "Sub-second webhook CRM delivery",
                      "Automated budget protection",
                    ].map((item, i) => (
                      <li
                        key={i}
                        className="flex items-center gap-3 text-sm text-white/80"
                      >
                        <IconCheck className="h-4 w-4 text-[#2FD699]" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Ping/Post Animation Visualizer */}

                <NetworkGraphic />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section
        id="how-it-works"
        className="relative py-24 bg-[#0A0B10] overflow-hidden"
      >
        {/* Ambient Background Glows */}

        <div className="relative mx-auto max-w-6xl px-6">
          <Reveal>
            <div className="text-center mb-20">
              <h2 className="text-sm font-bold  tracking-[0.2em] text-[#2FD699] mb-4">
                Simple Setup
              </h2>
              <h2
                className="text-3xl md:text-5xl text-white tracking-tight"
                style={{ fontFamily: "var(--font-heading)", fontWeight: 600 }}
              >
                How it works
              </h2>
            </div>
          </Reveal>

          <div className="relative grid gap-16 md:grid-cols-4 md:gap-8">
            {/* Animated Connecting Line */}
            <div
              aria-hidden
              className="absolute left-[12%] right-[12%] top-7 hidden h-[2px] bg-white/5 md:block overflow-hidden rounded-full"
            ></div>

            {STEPS.map((step, i) => {
              const StepIcon = step.icon;
              return (
                <Reveal key={step.title} index={i}>
                  <div className="relative flex flex-col items-center text-center group">
                    {/* Icon Container with Glow & Hover Effects */}
                    <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-[#12141C] text-[#A9A0FF]">
                      <StepIcon className="h-6 w-6 relative z-10" />
                    </div>

                    {/* Step Label */}
                    <div className="mt-8 flex items-center justify-center gap-3">
                      <span className="h-px w-6 bg-gradient-to-r from-transparent to-[#6C5CE7]/50" />
                      <span
                        className="text-[11px] font-bold tracking-[0.2em]  text-[#6C5CE7]"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        Step {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="h-px w-6 bg-gradient-to-l from-transparent to-[#6C5CE7]/50" />
                    </div>

                    {/* Content */}
                    <h3 className="mt-4 text-lg font-semibold text-white transition-colors group-hover:text-[#A9A0FF]">
                      {step.title}
                    </h3>
                    <p className="mt-3 text-[14px] leading-relaxed text-white/50">
                      {step.copy}
                    </p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* Automation & Ping Post Section */}
      <section
        id="automation"
        className="relative border-t border-white/[0.06] bg-[#0D0F16] py-24 overflow-hidden"
        style={{ contentVisibility: "auto", containIntrinsicSize: "1px 800px" }}
      >
        <div className="relative mx-auto max-w-6xl px-6">
          <Reveal>
            <div className="mb-16 md:text-center max-w-3xl mx-auto">
              <h2
                className="text-3xl md:text-5xl tracking-tight mb-6 text-white"
                style={{ fontFamily: "var(--font-heading)", fontWeight: 600 }}
              >
                Put your lead flow on autopilot.
              </h2>
              <p className="text-lg text-white/50 leading-relaxed">
                Unlock $25 discounted autobuy leads with Pro. Set your exact
                limits, define your buy box, and let our distribution engine and
                real-time Ping/Post network route leads directly into your CRM.
              </p>
            </div>
          </Reveal>

          <div className="grid lg:grid-cols-[1.2fr_1fr] gap-6">
            {/* Auto Buy Engine Mockup */}
            <Reveal index={1} className="flex flex-col">
              <div className="flex-1 rounded-[2rem] border border-white/10 bg-[#12141C] p-8 md:p-10 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h3 className="text-xl font-semibold text-white flex items-center gap-3">
                        <IconGauge className="h-5 w-5 text-[#6C5CE7]" />
                        Auto-Buy Engine
                      </h3>
                      <p className="text-sm text-white/40 mt-1">
                        Receive leads automatically based on rules.
                      </p>
                    </div>
                    <div className="h-7 w-12 rounded-full bg-[#2FD699]/20 border border-[#2FD699]/30 flex items-center p-1">
                      <div className="h-5 w-5 rounded-full bg-[#2FD699] transform translate-x-5 shadow-[0_0_10px_#2FD699]" />
                    </div>
                  </div>

                  <div className="space-y-6">
                    {/* Mock Input Row 1 */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-[#1A1C29] border border-white/5 rounded-xl p-4">
                        <span className="block text-xs text-white/40 mb-2  tracking-wide">
                          Max Leads / Day
                        </span>
                        <div className="flex items-center text-lg font-medium text-white">
                          <span className="text-white/30 mr-2">#</span> 15
                        </div>
                      </div>
                      <div className="bg-[#1A1C29] border border-white/5 rounded-xl p-4">
                        <span className="block text-xs text-white/40 mb-2  tracking-wide">
                          Daily Spend Cap
                        </span>
                        <div className="flex items-center text-lg font-medium text-white">
                          <span className="text-white/30 mr-2">$</span> 500
                        </div>
                      </div>
                    </div>

                    {/* Mock Settings Row */}
                    <div className="bg-[#1A1C29] border border-white/5 rounded-xl p-5">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-sm font-medium text-white/80">
                          Market Filters
                        </span>
                        <span className="text-xs text-[#6C5CE7] bg-[#6C5CE7]/10 px-2 py-1 rounded">
                          433 Selected
                        </span>
                      </div>
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-sm font-medium text-white/80">
                          Budget Protection
                        </span>
                        <span className="text-sm text-white/60">
                          Pause below{" "}
                          <strong className="text-white">$100</strong>
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-white/80">
                          Purchase Type
                        </span>
                        <div className="flex gap-2">
                          <span className="text-xs bg-white/10 text-white/70 px-3 py-1 rounded-full text-center align-middle">
                            Exclusive
                          </span>
                          <span className="text-xs bg-white/10 text-white/70 px-3 py-1 rounded-full">
                            Non-Exclusive
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>

            {/* Ping Post Mockup */}
            <Reveal index={2} className="flex flex-col">
              <div className="flex-1 rounded-[2rem] border border-white/10 bg-[#12141C] p-8 md:p-10 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-bl from-[#2FD699]/[0.03] to-transparent pointer-events-none" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h3 className="text-xl font-semibold text-white flex items-center gap-3">
                        <IconZap className="h-5 w-5 text-[#E8A33D]" />
                        Ping / Post System
                      </h3>
                      <p className="text-sm text-white/40 mt-1">
                        Real-time bidding on exclusive network leads.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Rule Card 1 */}
                    <div className="bg-[#1A1C29] border border-white/5 rounded-xl p-5 relative overflow-hidden">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#2FD699]" />
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-sm font-semibold text-white">
                          TX High-Intent Foreclosures
                        </span>
                        <span className="text-[10px]  tracking-wider bg-[#2FD699]/20 text-[#2FD699] px-2 py-1 rounded">
                          Active
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <div>
                          <span className="block text-[11px] text-white/40  mb-1">
                            Max Bid
                          </span>
                          <span className="text-base text-white font-medium">
                            $45.00
                          </span>
                        </div>
                        <div>
                          <span className="block text-[11px] text-white/40  mb-1">
                            Type
                          </span>
                          <span className="text-sm text-white/70">
                            Exclusive Only
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Rule Card 2 */}
                    <div className="bg-[#1A1C29] border border-white/5 rounded-xl p-5 relative opacity-60">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-white/20" />
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-sm font-semibold text-white">
                          National Broad
                        </span>
                        <span className="text-[10px]  tracking-wider bg-white/10 text-white/50 px-2 py-1 rounded">
                          Paused
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <div>
                          <span className="block text-[11px] text-white/40  mb-1">
                            Max Bid
                          </span>
                          <span className="text-base text-white font-medium">
                            $15.00
                          </span>
                        </div>
                        <div>
                          <span className="block text-[11px] text-white/40  mb-1">
                            Type
                          </span>
                          <span className="text-sm text-white/70">Shared</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Pain to outcome */}
      <section
        id="marketplace"
        className="border-t border-white/[0.06] bg-[#0D0F16] py-24"
        style={{ contentVisibility: "auto", containIntrinsicSize: "1px 800px" }}
      >
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <h2
              className="max-w-[24ch] text-3xl leading-tight md:text-4xl text-white"
              style={{ fontFamily: "var(--font-heading)", fontWeight: 600 }}
            >
              The old way of buying leads doesn't scale with you.
            </h2>
          </Reveal>
          <Reveal index={1}>
            <div className="mt-12 grid overflow-hidden rounded-[2rem] border border-white/10 md:grid-cols-2 shadow-2xl">
              <div className="border-b border-white/10 bg-[#0D0F16] p-10 md:border-b-0 md:border-r relative">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-white/[0.02] to-transparent pointer-events-none" />
                <p className="text-xs font-semibold  tracking-wider text-white/40 mb-8">
                  Without Newleey
                </p>
                <ul className="space-y-6">
                  {PAIN.map((row) => (
                    <li
                      key={row.before}
                      className="flex items-start gap-4 text-[15px] text-white/50"
                    >
                      <IconDash className="mt-1 h-5 w-5 text-white/20" />
                      {row.before}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-[#12141C] p-10 relative">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#6C5CE7]/[0.05] to-transparent pointer-events-none" />
                <p className="text-xs font-semibold  tracking-wider text-[#A9A0FF] mb-8">
                  With Newleey
                </p>
                <ul className="space-y-6">
                  {PAIN.map((row) => (
                    <li
                      key={row.after}
                      className="flex items-start gap-4 text-[15px] text-white/90"
                    >
                      <IconCheck className="mt-1 h-5 w-5 text-[#2FD699]" />
                      {row.after}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Features */}
      <section
        className="border-t border-white/[0.06] bg-[#0D0F16] py-24"
        style={{ contentVisibility: "auto", containIntrinsicSize: "1px 800px" }}
      >
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-6 md:grid-cols-3">
            {FEATURES.map((f, i) => {
              const FeatureIcon = f.icon;
              return (
                <Reveal
                  key={f.title}
                  index={i}
                  className={i === 0 ? "md:col-span-2" : ""}
                >
                  <div className="flex h-full flex-col rounded-[2rem] border border-white/10 bg-[#12141C] p-8 md:p-10 transition-colors hover:bg-[#161823]">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#6C5CE7]/15 text-[#A9A0FF] mb-6">
                      <FeatureIcon className="h-5 w-5" />
                    </span>
                    <h3 className="text-xl font-semibold text-white">
                      {f.title}
                    </h3>
                    <p className="mt-3 text-[15px] leading-relaxed text-white/50 flex-1">
                      {f.copy}
                    </p>
                    <div className="mt-8 flex flex-wrap gap-2">
                      {f.chips.map((chip) => (
                        <span
                          key={chip}
                          className={`rounded-full px-3 py-1.5 text-[11px] font-medium tracking-wide  ${chipTone(chip)}`}
                        >
                          {chip}
                        </span>
                      ))}
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* Purchase options */}
      <section
        className="py-24 bg-[#0A0B10]"
        style={{ contentVisibility: "auto", containIntrinsicSize: "1px 800px" }}
      >
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <h2
              className="text-3xl md:text-4xl text-white text-center md:text-left"
              style={{ fontFamily: "var(--font-heading)", fontWeight: 600 }}
            >
              Two ways to buy, always disclosed up front.
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <Reveal>
              <div className="h-full rounded-[2rem] border border-white/10 bg-[#12141C] p-10 relative overflow-hidden">
                <span className="rounded-full bg-[#6C5CE7]/20 px-3 py-1.5 text-xs font-semibold  tracking-wider text-[#A9A0FF]">
                  Exclusive
                </span>
                <p className="mt-6 text-xl font-semibold text-white">
                  One buyer. Full control of the opportunity.
                </p>
                <p className="mt-3 text-[15px] text-white/50 leading-relaxed">
                  You're the only investor who purchases this lead. No competing
                  outreach, highest conversion potential.
                </p>
              </div>
            </Reveal>
            <Reveal index={1}>
              <div className="h-full rounded-[2rem] border border-white/10 bg-[#12141C] p-10 relative overflow-hidden">
                <span className="rounded-full bg-[#E8A33D]/15 px-3 py-1.5 text-xs font-semibold  tracking-wider text-[#E8A33D]">
                  Non Exclusive
                </span>
                <p className="mt-6 text-xl font-semibold text-white">
                  Lower-cost access for Pro members.
                </p>
                <p className="mt-3 text-[15px] text-white/50 leading-relaxed">
                  A limited number of buyer slots per lead. Availability shown
                  before you buy — never disguised as Exclusive.
                </p>
                <p className="mt-6 flex items-center gap-3 text-sm text-white/45 bg-white/5 inline-flex px-4 py-2 rounded-lg">
                  <SlotDots label="2 of 4 open" /> Slots shown before purchase
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section
        id="pro-plan"
        className="scroll-mt-20 border-t border-white/[0.06] bg-[#0D0F16] py-20 md:py-24"
      >
        <div className="mx-auto grid max-w-6xl gap-10 px-6 md:grid-cols-2 md:items-start">
          <div>
            <span className="inline-flex rounded-full border border-[#6C5CE7]/30 bg-[#6C5CE7]/10 px-3 py-1 text-xs font-semibold  tracking-wider text-[#B6AEFF]">
              Simple membership
            </span>
            <h2
              className="mt-5 text-3xl text-white md:text-4xl"
              style={headingStyle}
            >
              One plan. More ways to grow.
            </h2>
            <p className="mt-4 max-w-[44ch] text-lg leading-relaxed text-white/50">
              Free accounts can browse the marketplace and buy Exclusive leads.
              Pro adds shared lead pricing, automatic delivery, and early access
              to new leads.
            </p>
            <p className="mt-6 text-sm text-white/45">
              No long-term commitment. Cancel anytime.
            </p>
          </div>

          <div className="rounded-[2rem] border border-[#6C5CE7]/40 bg-[#12141C] p-7 md:p-8">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-6">
              <div>
                <p className="text-sm font-semibold  tracking-wider text-[#B6AEFF]">
                  Pro
                </p>
                <p className="mt-1 text-sm text-white/45">Billed monthly</p>
              </div>
              <p className="flex items-baseline gap-2">
                <span
                  className="text-4xl font-semibold tracking-tight text-white"
                  style={headingStyle}
                >
                  {proPrice}
                </span>
                <span className="text-sm text-white/50">/ month</span>
              </p>
            </div>

            <ul className="mt-6 space-y-4 text-[15px] text-white/80">
              {[
                <>
                  Non-exclusive inbound leads at {sharedInbound} each (up to 5
                  buyers)
                </>,
                <>
                  Non-exclusive outbound leads at {sharedOutbound} each (up to 3
                  buyers)
                </>,
                <>Early marketplace access to new leads</>,
                <>Auto-delivery of matching leads to your CRM</>,
                <>Cancel anytime</>,
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#2FD699]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <Link
              href="/register"
              className="mt-8 block rounded-lg bg-[#6C5CE7] px-6 py-3 text-center text-[15px] font-semibold text-white transition-colors hover:bg-[#7A6BF0]"
            >
              Create an account to subscribe
            </Link>
          </div>
        </div>
      </section>

      {/* CRM integration */}
      <section
        className="py-24 border-t border-white/[0.06] bg-[#0D0F16]"
        style={{ contentVisibility: "auto", containIntrinsicSize: "1px 800px" }}
      >
        <div className="mx-auto max-w-6xl px-6 grid md:grid-cols-2 gap-16 items-center">
          <Reveal>
            <h2
              className="text-3xl md:text-4xl text-white mb-6"
              style={{ fontFamily: "var(--font-heading)", fontWeight: 600 }}
            >
              Purchased lead delievered to your CRM.
            </h2>
            <p className="text-[15px] text-white/50 leading-relaxed mb-8">
              Any lead purchased goes to the CRM your connect with the app,
              including leads bought by the system's aotumation or the ping/post
              feature.
            </p>
            <div className="flex flex-wrap gap-3">
              {["GoHighLevel", "LeadConnector", "Zapier", "HTTPS Webhook"].map(
                (name) => (
                  <span
                    key={name}
                    className="rounded-full border border-white/10 bg-[#12141C] px-5 py-2.5 text-sm font-medium text-white/70 shadow-sm"
                  >
                    {name}
                  </span>
                ),
              )}
            </div>
          </Reveal>

          <Reveal index={1}>
            <div className="rounded-[2rem] border border-white/10 bg-[#12141C] p-10 relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-[#2FD699]/[0.02] to-transparent pointer-events-none rounded-[2rem]" />

              {/* Connection Animation */}
              <div className="flex items-center justify-center gap-4 mb-8">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1A1C29] border border-white/10 shadow-lg">
                  <IconTarget className="h-6 w-6 text-[#A9A0FF]" />
                </div>
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#2FD699]/50 to-transparent relative"></div>
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1A1C29] border border-white/10 shadow-lg">
                  <IconFlow className="h-6 w-6 text-[#2FD699]" />
                </div>
              </div>

              <p className="text-center text-sm font-medium text-white/40  tracking-wide mb-6">
                Instant CRM Delivery
              </p>

              {/* Simulated CRM Inbox UI (Non-Technical) */}
              <div className="bg-[#0A0B10] border border-white/5 p-4 rounded-2xl shadow-inner relative overflow-hidden">
                {/* Subtle background glow */}

                {/* Mock CRM Header */}
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-white/5 relative z-10">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-[#2FD699]" />
                    <span className="text-[11px] text-white/60 font-medium  tracking-wider">
                      Lead Inbox
                    </span>
                  </div>
                  <span className="text-[10px] text-white/40 bg-white/5 px-2 py-1 rounded-md">
                    Just now
                  </span>
                </div>

                {/* Mock Lead Card */}
                <div className="bg-[#12141C] border border-white/10 rounded-xl p-4 flex items-start gap-4 relative z-10 shadow-lg">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#2FD699] to-[#059669] flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-[0_0_15px_rgba(47,214,153,0.2)]">
                    SJ
                  </div>

                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="text-white text-sm font-semibold">
                        Sarah Jenkins
                      </h4>
                      <span className="bg-[#2FD699]/10 text-[#2FD699] text-[9px] px-2 py-0.5 rounded-full  tracking-wider font-bold border border-[#2FD699]/20">
                        Exclusive
                      </span>
                    </div>

                    {/* Lead Attributes (Structured Data) */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      <span className="text-white/40 text-[9px] bg-white/5 border border-white/5 px-2 py-1 rounded-md  tracking-wider">
                        Source: Ping/Post
                      </span>

                      <span className="text-white/40 text-[9px] bg-white/5 border border-white/5 px-2 py-1 rounded-md  tracking-wider">
                        State: TX
                      </span>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="text-white/40 text-[11px] flex items-center gap-1.5 font-mono">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-3 w-3"
                        >
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                        </svg>
                        (555) 123-****
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 md:px-10 max-w-7xl mx-auto">
        <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#12141C] p-10 md:p-24 text-center shadow-[0_30px_80px_rgba(0,0,0,0.5)] group transition-all duration-500 hover:border-white/20">
          {/* Animated Background Layers */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-[2rem]">
            {/* Top scanning line */}

            {/* Glowing Orbs */}

            {/* Subtle Grid Pattern Overlay */}
            <div
              className="absolute inset-0 opacity-[0.03] mix-blend-overlay"
              style={{
                backgroundImage:
                  "radial-gradient(circle at center, #ffffff 1px, transparent 1px)",
                backgroundSize: "24px 24px",
              }}
            />
          </div>

          <div className="relative z-10 max-w-3xl mx-auto flex flex-col items-center">
            {/* Status Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 mb-8">
              <span className="h-2 w-2 rounded-full bg-[#2FD699]" />
              <span className="text-xs font-semibold  tracking-widest text-white/70">
                Start Closing Today
              </span>
            </div>

            <h2
              className="text-4xl md:text-6xl tracking-tight text-white mb-6"
              style={{ fontFamily: "var(--font-heading)", fontWeight: 600 }}
            >
              Stop hunting for leads. <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#A9A0FF] to-[#2FD699]">
                Put them on autopilot.
              </span>
            </h2>

            <p className="text-lg md:text-xl text-white/50 mb-12 leading-relaxed max-w-2xl">
              Create your free account today. Browse the marketplace, define
              your buy box rules, and watch motivated-seller leads flow directly
              into your CRM.
            </p>

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4 w-full sm:w-auto">
              <Link
                href="/register"
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-[#6C5CE7] px-8 py-4 text-[15px] font-semibold text-white hover:bg-[#7A6BF0]"
              >
                Create Free Account
                <svg
                  className="w-4 h-4 ml-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14 5l7 7m0 0l-7 7m7-7H3"
                  />
                </svg>
              </Link>
              <Link
                href="/pro"
                className="w-full sm:w-auto rounded-xl border border-white/15 bg-white/5 px-8 py-4 text-[15px] font-semibold text-white transition-all duration-300 hover:bg-white/10 hover:text-white"
              >
                Explore Pro Features
              </Link>
            </div>

            {/* Microcopy / Trust signals */}
            <div className="mt-12 flex flex-wrap justify-center items-center gap-6 md:gap-8 text-sm text-white/40">
              <div className="flex items-center gap-2">
                <IconCheck className="h-4 w-4 text-[#2FD699]" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-2">
                <IconCheck className="h-4 w-4 text-[#2FD699]" />
                <span>Cancel anytime</span>
              </div>
              <div className="flex items-center gap-2">
                <IconCheck className="h-4 w-4 text-[#2FD699]" />
                <span>100% free to browse</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] bg-[#0A0B10] py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 text-sm text-white/40 sm:flex-row">
          <div className="flex items-center gap-3">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-gradient-to-br from-[#6C5CE7] to-[#10b981]">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="white" />
              </svg>
            </div>
            <span
              className="font-semibold text-white"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Newleey
            </span>
          </div>
          <span className="text-center sm:text-left">
            © {new Date().getFullYear()} Newleey. Lead prices vary by market and
            configuration.
          </span>
          <div className="flex gap-6">
            <a href="#" className="hover:text-white transition">
              Terms
            </a>
            <a href="#" className="hover:text-white transition">
              Privacy
            </a>
            <a href="#" className="hover:text-white transition">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
