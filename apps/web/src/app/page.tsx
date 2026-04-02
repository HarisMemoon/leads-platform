import Link from "next/link";

export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(1200px 700px at 10% -10%, rgba(99,102,241,0.25), transparent 60%), radial-gradient(900px 500px at 100% 0%, rgba(16,185,129,0.18), transparent 55%), #080a0f",
        color: "#fff",
        fontFamily: "'DM Sans', sans-serif",
        display: "grid",
        placeItems: "center",
        padding: "24px",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 900,
          borderRadius: 24,
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(7,10,18,0.82)",
          backdropFilter: "blur(8px)",
          boxShadow: "0 20px 80px rgba(0,0,0,0.45)",
          padding: "48px 40px",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 12,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "rgba(165,180,252,0.9)",
            fontWeight: 700,
          }}
        >
          Newleey Platform
        </p>
        <h1
          style={{
            marginTop: 14,
            marginBottom: 12,
            fontSize: "clamp(32px, 5vw, 54px)",
            lineHeight: 1.08,
            letterSpacing: -1.2,
            fontFamily: "'Syne', sans-serif",
            fontWeight: 800,
          }}
        >
          Buy better leads.{" "}
          <span style={{ color: "rgba(165,180,252,0.95)" }}>
            Convert faster.
          </span>
        </h1>
        <p
          style={{
            margin: 0,
            maxWidth: 640,
            color: "rgba(255,255,255,0.63)",
            fontSize: 16,
            lineHeight: 1.7,
          }}
        >
          Sign in to access your dashboard, wallet, marketplace, subscriptions, and all
          lead distribution tools. If you are new, create an account to get started.
        </p>

        <div style={{ display: "flex", gap: 12, marginTop: 30, flexWrap: "wrap" }}>
          <Link
            href="/login"
            style={{
              textDecoration: "none",
              padding: "12px 20px",
              borderRadius: 12,
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              color: "#fff",
              fontWeight: 700,
              fontSize: 14,
              boxShadow: "0 10px 30px rgba(99,102,241,0.35)",
            }}
          >
            Sign In
          </Link>
          <Link
            href="/register"
            style={{
              textDecoration: "none",
              padding: "12px 20px",
              borderRadius: 12,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.16)",
              color: "rgba(255,255,255,0.92)",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            Create Account
          </Link>
        </div>

        <div
          style={{
            marginTop: 26,
            paddingTop: 18,
            borderTop: "1px solid rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.46)",
            fontSize: 13,
          }}
        >
          Protected pages require sign-in: dashboard, onboarding, wallet, distribution,
          marketplace, leads, subscriptions, market alerts, and admin console.
        </div>
      </section>
    </main>
  );
}
