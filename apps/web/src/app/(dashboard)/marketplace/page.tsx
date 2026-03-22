"use client";

import Navbar from "@/components/Navbar";
import { useState, useEffect } from "react";

const MOCK_LEADS = [
  { id: "1", title: "Motivated Seller — Dallas, TX", market: "Dallas, TX", type: "Motivated Seller", exclusivity: "exclusive", price_cents: 18500, quality_score: 92, status: "available", metadata: { address: "4821 Maple Ave", bedrooms: 3, condition: "Fair", motivation: "Relocation", days_listed: 1 } },
  { id: "2", title: "Pre-Foreclosure — Phoenix, AZ", market: "Phoenix, AZ", type: "Pre-Foreclosure", exclusivity: "semi_exclusive", price_cents: 9500, quality_score: 78, status: "available", metadata: { address: "291 Cactus Blvd", bedrooms: 4, condition: "Good", motivation: "Financial distress", days_listed: 3 } },
  { id: "3", title: "Probate Lead — Atlanta, GA", market: "Atlanta, GA", type: "Probate", exclusivity: "shared", price_cents: 4500, quality_score: 65, status: "available", metadata: { address: "1103 Peach St", bedrooms: 3, condition: "Poor", motivation: "Estate sale", days_listed: 7 } },
  { id: "4", title: "Absentee Owner — Houston, TX", market: "Houston, TX", type: "Absentee Owner", exclusivity: "exclusive", price_cents: 22000, quality_score: 95, status: "available", metadata: { address: "880 Oak Lane", bedrooms: 5, condition: "Good", motivation: "Out of state", days_listed: 1 } },
  { id: "5", title: "Tax Delinquent — Orlando, FL", market: "Orlando, FL", type: "Tax Delinquent", exclusivity: "semi_exclusive", price_cents: 7500, quality_score: 71, status: "available", metadata: { address: "554 Palm Dr", bedrooms: 2, condition: "Fair", motivation: "Tax default", days_listed: 5 } },
  { id: "6", title: "Vacant Property — Las Vegas, NV", market: "Las Vegas, NV", type: "Vacant", exclusivity: "shared", price_cents: 3500, quality_score: 60, status: "available", metadata: { address: "77 Desert Rd", bedrooms: 3, condition: "Poor", motivation: "Unknown", days_listed: 14 } },
  { id: "7", title: "Divorce Lead — Nashville, TN", market: "Nashville, TN", type: "Divorce", exclusivity: "exclusive", price_cents: 15000, quality_score: 88, status: "available", metadata: { address: "322 Country Ln", bedrooms: 4, condition: "Good", motivation: "Divorce settlement", days_listed: 2 } },
  { id: "8", title: "Motivated Seller — Austin, TX", market: "Austin, TX", type: "Motivated Seller", exclusivity: "semi_exclusive", price_cents: 12500, quality_score: 82, status: "available", metadata: { address: "2010 Tech Blvd", bedrooms: 3, condition: "Good", motivation: "Job transfer", days_listed: 2 } },
  { id: "9", title: "Pre-Foreclosure — Denver, CO", market: "Denver, CO", type: "Pre-Foreclosure", exclusivity: "shared", price_cents: 5500, quality_score: 69, status: "available", metadata: { address: "490 Mountain View", bedrooms: 4, condition: "Fair", motivation: "Mortgage default", days_listed: 9 } },
];

const MARKETS = ["All Markets", "Dallas, TX", "Phoenix, AZ", "Atlanta, GA", "Houston, TX", "Orlando, FL", "Las Vegas, NV", "Nashville, TN", "Austin, TX", "Denver, CO"];
const TYPES = ["All Types", "Motivated Seller", "Pre-Foreclosure", "Probate", "Tax Delinquent", "Absentee Owner", "Vacant", "Divorce"];
const EXCLUSIVITY = ["All", "exclusive", "semi_exclusive", "shared"];

function exclusivityLabel(e: string) {
  return { exclusive: "Exclusive", semi_exclusive: "Semi-Excl.", shared: "Shared" }[e] || e;
}

function exclusivityColor(e: string) {
  return {
    exclusive: { bg: "rgba(99,102,241,0.15)", color: "#a5b4fc", border: "rgba(99,102,241,0.3)" },
    semi_exclusive: { bg: "rgba(16,185,129,0.12)", color: "#6ee7b7", border: "rgba(16,185,129,0.25)" },
    shared: { bg: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.45)", border: "rgba(255,255,255,0.1)" },
  }[e] || { bg: "", color: "", border: "" };
}

function scoreColor(s: number) {
  if (s >= 85) return "#10b981";
  if (s >= 70) return "#f59e0b";
  return "#ef4444";
}

export default function MarketplacePage() {
  const [market, setMarket] = useState("All Markets");
  const [type, setType] = useState("All Types");
  const [excl, setExcl] = useState("All");
  const [maxPrice, setMaxPrice] = useState(25000);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [buying, setBuying] = useState(false);
  const [bought, setBought] = useState<string[]>([]);
  const [walletBalance] = useState(85000); // cents

  const filtered = MOCK_LEADS.filter((l) => {
    if (market !== "All Markets" && l.market !== market) return false;
    if (type !== "All Types" && l.type !== type) return false;
    if (excl !== "All" && l.exclusivity !== excl) return false;
    if (l.price_cents > maxPrice) return false;
    if (search && !l.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  async function buyLead(lead: any) {
    setBuying(true);
    await new Promise((r) => setTimeout(r, 1200));
    setBought((b) => [...b, lead.id]);
    setBuying(false);
    setSelected(null);
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;700;800&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .mp-root {
          min-height: 100vh;
          background: #080a0f;
          color: white;
          font-family: 'DM Sans', sans-serif;
          display: flex;
          flex-direction: column;
        }

        /* top nav */
        .topnav {
          height: 64px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 32px;
          position: sticky;
          top: 0;
          z-index: 50;
          background: rgba(8,10,15,0.95);
          backdrop-filter: blur(12px);
        }

        .nav-left { display: flex; align-items: center; gap: 32px; }

        .brand {
          display: flex; align-items: center; gap: 10px;
        }

        .brand-icon {
          width: 30px; height: 30px;
          background: linear-gradient(135deg, #6366f1, #10b981);
          border-radius: 7px;
          display: flex; align-items: center; justify-content: center;
        }

        .brand-name {
          font-family: 'Syne', sans-serif;
          font-size: 16px;
          font-weight: 700;
        }

        .nav-links { display: flex; gap: 2px; }

        .nav-link {
          padding: 7px 14px;
          border-radius: 8px;
          font-size: 13px;
          color: rgba(255,255,255,0.45);
          cursor: pointer;
          transition: all 0.15s;
          text-decoration: none;
        }

        .nav-link:hover { color: rgba(255,255,255,0.8); background: rgba(255,255,255,0.05); }
        .nav-link.active { color: #fff; background: rgba(255,255,255,0.08); }

        .nav-right { display: flex; align-items: center; gap: 16px; }

        .wallet-pill {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(16,185,129,0.1);
          border: 1px solid rgba(16,185,129,0.2);
          border-radius: 100px;
          padding: 7px 14px;
          font-size: 13px;
          color: #6ee7b7;
          font-weight: 500;
        }

        .avatar {
          width: 34px; height: 34px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }

        /* page layout */
        .page-body {
          flex: 1;
          display: grid;
          grid-template-columns: 260px 1fr;
        }

        /* filters sidebar */
        .filters-sidebar {
          border-right: 1px solid rgba(255,255,255,0.05);
          padding: 28px 20px;
          position: sticky;
          top: 64px;
          height: calc(100vh - 64px);
          overflow-y: auto;
        }

        .filter-section { margin-bottom: 28px; }

        .filter-label {
          font-size: 11px;
          font-weight: 500;
          color: rgba(255,255,255,0.3);
          text-transform: uppercase;
          letter-spacing: 0.8px;
          margin-bottom: 10px;
        }

        .filter-options { display: flex; flex-direction: column; gap: 4px; }

        .filter-opt {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 13px;
          color: rgba(255,255,255,0.5);
          cursor: pointer;
          transition: all 0.15s;
          border: 1px solid transparent;
        }

        .filter-opt:hover { background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.8); }

        .filter-opt.selected {
          background: rgba(99,102,241,0.1);
          border-color: rgba(99,102,241,0.2);
          color: #a5b4fc;
        }
/* Add this inside your <style> tag */
::-webkit-scrollbar {
  width: 6px; /* Slim width */
}

::-webkit-scrollbar-track {
  background: #080a0f; /* Match your background */
}

::-webkit-scrollbar-thumb {
  background: #1a1d26; /* Dark grey/black thumb */
  border-radius: 10px;
}

::-webkit-scrollbar-thumb:hover {
  background: #252936; /* Slightly lighter on hover */
}

/* For Firefox */
* {
  scrollbar-width: thin;
  scrollbar-color: #1a1d26 #080a0f;
}
        .filter-count {
          font-size: 11px;
          background: rgba(255,255,255,0.08);
          border-radius: 4px;
          padding: 2px 7px;
          color: rgba(255,255,255,0.3);
        }

        .price-slider-wrap { padding: 0 2px; }

        .price-range-label {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
          font-size: 13px;
          color: rgba(255,255,255,0.5);
        }

        .price-range-label span:last-child { color: #fff; font-weight: 500; }

        input[type=range] {
          width: 100%;
          -webkit-appearance: none;
          height: 4px;
          background: rgba(255,255,255,0.1);
          border-radius: 2px;
          outline: none;
        }

        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 16px; height: 16px;
          border-radius: 50%;
          background: #6366f1;
          cursor: pointer;
        }

        /* main content */
        .leads-main { padding: 28px 28px; }

        .leads-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }

        .leads-title {
          font-family: 'Syne', sans-serif;
          font-size: 22px;
          font-weight: 700;
          letter-spacing: -0.5px;
        }

        .leads-count {
          font-size: 13px;
          color: rgba(255,255,255,0.35);
          margin-top: 2px;
        }

        .search-bar {
          width: 280px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px;
          padding: 10px 16px 10px 38px;
          font-size: 13px;
          color: #fff;
          outline: none;
          font-family: 'DM Sans', sans-serif;
          position: relative;
        }

        .search-wrap { position: relative; }
        .search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: rgba(255,255,255,0.25);
        }

        .search-bar::placeholder { color: rgba(255,255,255,0.2); }
        .search-bar:focus { border-color: rgba(99,102,241,0.4); background: rgba(99,102,241,0.04); }

        /* lead grid */
        .lead-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(310px, 1fr));
          gap: 14px;
        }

        .lead-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px;
          padding: 20px;
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
          overflow: hidden;
        }

        .lead-card::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(99,102,241,0.04), transparent);
          opacity: 0;
          transition: opacity 0.2s;
        }

        .lead-card:hover { border-color: rgba(99,102,241,0.25); transform: translateY(-2px); }
        .lead-card:hover::before { opacity: 1; }

        .lead-card.bought { opacity: 0.5; pointer-events: none; }

        .card-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 14px;
        }

        .excl-badge {
          font-size: 11px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 100px;
          border: 1px solid;
          letter-spacing: 0.3px;
        }

        .score-badge {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 12px;
          font-weight: 600;
        }

        .score-dot { width: 6px; height: 6px; border-radius: 50%; }

        .lead-title {
          font-family: 'Syne', sans-serif;
          font-size: 15px;
          font-weight: 700;
          color: #fff;
          margin-bottom: 4px;
          line-height: 1.3;
        }

        .lead-address {
          font-size: 12px;
          color: rgba(255,255,255,0.4);
          margin-bottom: 14px;
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .lead-meta {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }

        .meta-tag {
          font-size: 11px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 6px;
          padding: 4px 9px;
          color: rgba(255,255,255,0.45);
        }

        .card-bottom {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .lead-price {
          font-family: 'Syne', sans-serif;
          font-size: 20px;
          font-weight: 800;
          color: #fff;
        }

        .lead-price-sub {
          font-size: 11px;
          color: rgba(255,255,255,0.3);
          margin-top: 2px;
        }

        .buy-btn {
          padding: 9px 18px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border: none;
          border-radius: 9px;
          color: #fff;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          font-family: 'Syne', sans-serif;
          transition: opacity 0.2s, transform 0.15s;
        }

        .buy-btn:hover { opacity: 0.9; transform: scale(1.03); }

        .bought-badge {
          padding: 9px 18px;
          background: rgba(16,185,129,0.1);
          border: 1px solid rgba(16,185,129,0.25);
          border-radius: 9px;
          color: #6ee7b7;
          font-size: 13px;
          font-weight: 600;
        }

        .days-pill {
          position: absolute;
          top: 14px;
          right: 14px;
          font-size: 10px;
          padding: 3px 8px;
          background: rgba(255,255,255,0.05);
          border-radius: 100px;
          color: rgba(255,255,255,0.3);
        }

        /* modal overlay */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.7);
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          backdrop-filter: blur(8px);
          animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        .modal {
          background: #0f1117;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 24px;
          padding: 36px;
          width: 100%;
          max-width: 500px;
          animation: slideUp 0.25s ease both;
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .modal-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }

        .modal-title {
          font-family: 'Syne', sans-serif;
          font-size: 22px;
          font-weight: 700;
          letter-spacing: -0.5px;
          line-height: 1.3;
        }

        .close-btn {
          background: rgba(255,255,255,0.06);
          border: none;
          border-radius: 50%;
          width: 32px; height: 32px;
          cursor: pointer;
          color: rgba(255,255,255,0.5);
          font-size: 18px;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.15s;
        }
        .close-btn:hover { background: rgba(255,255,255,0.1); color: white; }

        .modal-detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 24px; }

        .detail-item {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 10px;
          padding: 14px;
        }

        .detail-label { font-size: 11px; color: rgba(255,255,255,0.3); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
        .detail-val { font-size: 14px; font-weight: 500; color: #fff; }

        .modal-price-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(99,102,241,0.08);
          border: 1px solid rgba(99,102,241,0.2);
          border-radius: 14px;
          padding: 18px 20px;
          margin-bottom: 16px;
        }

        .modal-price-label { font-size: 13px; color: rgba(255,255,255,0.5); }
        .modal-price-val { font-family: 'Syne', sans-serif; font-size: 28px; font-weight: 800; color: #fff; }

        .wallet-remaining {
          font-size: 12px;
          color: rgba(255,255,255,0.3);
          text-align: center;
          margin-bottom: 20px;
        }

        .modal-buy-btn {
          width: 100%;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border: none;
          border-radius: 14px;
          padding: 16px;
          font-size: 16px;
          font-weight: 700;
          color: #fff;
          cursor: pointer;
          font-family: 'Syne', sans-serif;
          transition: opacity 0.2s, transform 0.15s;
        }

        .modal-buy-btn:hover { opacity: 0.9; transform: translateY(-1px); }
        .modal-buy-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

        @keyframes spin { to { transform: rotate(360deg); } }
        .spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; vertical-align: middle; margin-right: 8px; }

        .empty-state {
          grid-column: 1 / -1;
          text-align: center;
          padding: 80px 20px;
          color: rgba(255,255,255,0.25);
        }
        .empty-state div:first-child { font-size: 48px; margin-bottom: 16px; }
        .empty-state p { font-size: 15px; }
      `}</style>

      <div className="mp-root">
        {/* Nav */}
       
        {/* <Navbar /> */}

        <div className="page-body">
          {/* Filters */}
          <aside className="filters-sidebar">
            <div className="filter-section">
              <div className="filter-label">Market</div>
              <div className="filter-options">
                {MARKETS.map((m) => {
                  const cnt = m === "All Markets" ? MOCK_LEADS.length : MOCK_LEADS.filter((l) => l.market === m).length;
                  return (
                    <div key={m} className={`filter-opt ${market === m ? "selected" : ""}`} onClick={() => setMarket(m)}>
                      <span>{m}</span>
                      {cnt > 0 && <span className="filter-count">{cnt}</span>}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="filter-section">
              <div className="filter-label">Lead type</div>
              <div className="filter-options">
                {TYPES.map((t) => (
                  <div key={t} className={`filter-opt ${type === t ? "selected" : ""}`} onClick={() => setType(t)}>
                    <span>{t}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="filter-section">
              <div className="filter-label">Exclusivity</div>
              <div className="filter-options">
                {EXCLUSIVITY.map((e) => (
                  <div key={e} className={`filter-opt ${excl === e ? "selected" : ""}`} onClick={() => setExcl(e)}>
                    <span>{e === "All" ? "All" : exclusivityLabel(e)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="filter-section">
              <div className="filter-label">Max price</div>
              <div className="price-slider-wrap">
                <div className="price-range-label">
                  <span>Up to</span>
                  <span>${(maxPrice / 100).toFixed(0)}</span>
                </div>
                <input type="range" min={2500} max={25000} step={500} value={maxPrice}
                  onChange={(e) => setMaxPrice(+e.target.value)} />
              </div>
            </div>
          </aside>

          {/* Main */}
          <main className="leads-main">
            <div className="leads-header">
              <div>
                <div className="leads-title">Lead Marketplace</div>
                <div className="leads-count">{filtered.length} leads available</div>
              </div>
              <div className="search-wrap">
                <svg className="search-icon" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input className="search-bar" placeholder="Search leads…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>

            <div className="lead-grid">
              {filtered.length === 0 && (
                <div className="empty-state">
                  <div>🔍</div>
                  <p>No leads match your current filters.</p>
                </div>
              )}
              {filtered.map((lead) => {
                const ec = exclusivityColor(lead.exclusivity);
                const isBought = bought.includes(lead.id);
                return (
                  <div key={lead.id} className={`lead-card ${isBought ? "bought" : ""}`} onClick={() => !isBought && setSelected(lead)}>
                    
                    <div className="card-top">
                      <div className="excl-badge" style={{ background: ec.bg, color: ec.color, borderColor: ec.border }}>
                        {exclusivityLabel(lead.exclusivity)}
                      </div>
                      <div className="days-pill">{lead.metadata.days_listed}d ago</div>

                      {/* <div className="score-badge" style={{ color: scoreColor(lead.quality_score) }}>
                        <div className="score-dot" style={{ background: scoreColor(lead.quality_score) }} />
                        {lead.quality_score}
                      </div> */}
                    </div>
                    <div className="days-pill">{lead.metadata.days_listed}d ago</div>
                    <div className="lead-title">{lead.title}</div>
                    <div className="lead-address">
                      <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      </svg>
                      {lead.metadata.address}
                    </div>
                    <div className="lead-meta">
                      <span className="meta-tag">{lead.type}</span>
                      <span className="meta-tag">{lead.metadata.bedrooms} bed</span>
                      <span className="meta-tag">{lead.metadata.condition}</span>
                      <span className="meta-tag">{lead.metadata.motivation}</span>
                    </div>
                    <div className="card-bottom">
                      <div>
                        <div className="lead-price">${(lead.price_cents / 100).toFixed(0)}</div>
                        <div className="lead-price-sub">from wallet</div>
                      </div>
                      {isBought ? (
                        <div className="bought-badge">✓ Purchased</div>
                      ) : (
                        <button className="buy-btn" onClick={(e) => { e.stopPropagation(); setSelected(lead); }}>
                          View & Buy
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </main>
        </div>
      </div>

      {/* Modal */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{selected.title}</div>
              <button className="close-btn" onClick={() => setSelected(null)}>×</button>
            </div>

            <div className="modal-detail-grid">
              {[
                { l: "Market", v: selected.market },
                { l: "Type", v: selected.type },
                { l: "Address", v: selected.metadata.address },
                { l: "Bedrooms", v: selected.metadata.bedrooms },
                { l: "Condition", v: selected.metadata.condition },
                { l: "Motivation", v: selected.metadata.motivation },
                { l: "Quality score", v: `${selected.quality_score} / 100` },
                { l: "Listed", v: `${selected.metadata.days_listed} day(s) ago` },
              ].map((d) => (
                <div key={d.l} className="detail-item">
                  <div className="detail-label">{d.l}</div>
                  <div className="detail-val">{d.v}</div>
                </div>
              ))}
            </div>

            <div className="modal-price-row">
              <div>
                <div className="modal-price-label">Lead price</div>
                <div className="modal-price-val">${(selected.price_cents / 100).toFixed(0)}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="modal-price-label">Exclusivity</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: exclusivityColor(selected.exclusivity).color, marginTop: 4 }}>
                  {exclusivityLabel(selected.exclusivity)}
                </div>
              </div>
            </div>

            <div className="wallet-remaining">
              Wallet balance after purchase: <strong style={{ color: "#fff" }}>${((walletBalance - selected.price_cents) / 100).toFixed(0)}</strong>
            </div>

            <button className="modal-buy-btn" disabled={buying} onClick={() => buyLead(selected)}>
              {buying ? <><span className="spinner" />Processing…</> : `Buy now — $${(selected.price_cents / 100).toFixed(0)}`}
            </button>
          </div>
        </div>
      )}
    </>
  );
}