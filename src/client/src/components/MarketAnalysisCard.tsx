import React from "react";

const C = {
  bg: "#2C3930",
  surface: "rgba(255,255,255,0.06)",
  surfaceHover: "rgba(255,255,255,0.10)",
  border: "rgba(255,255,255,0.10)",
  rose: "#A27B5C",
  roseLight: "rgba(162,123,92,0.15)",
  cream: "#DCD7C9",
  creamDim: "rgba(220,215,201,0.55)",
  text: "#DCD7C9",
  muted: "rgba(220,215,201,0.55)",
  bullish: "#4CAF82",
  bullishBg: "rgba(76,175,130,0.15)",
  bearish: "#E05C5C",
  bearishBg: "rgba(224,92,92,0.15)",
  neutral: "#A0A0B0",
  neutralBg: "rgba(160,160,176,0.15)",
};

type MarketMetrics = {
  selic_rate: number | null;
  fed_funds_rate: number | null;
  oil_price_usd: number | null;
  fiscal_health_score: number | null;
  geopolitical_risk_score: number | null;
  political_stability_score: number | null;
  fetched_at: string | null;
};

type MarketAnalysis = {
  prediction: "BULLISH" | "BEARISH" | "NEUTRAL";
  confidence: number;
  thesis: string;
  risk_flags: string[];
  metrics: MarketMetrics;
};

type Props = {
  analysis: MarketAnalysis | undefined;
};

function predictionColors(p: string) {
  if (p === "BULLISH") return { color: C.bullish, bg: C.bullishBg };
  if (p === "BEARISH") return { color: C.bearish, bg: C.bearishBg };
  return { color: C.neutral, bg: C.neutralBg };
}

function fmt(val: number | null, decimals = 2, suffix = "") {
  if (val === null || val === undefined) return "—";
  return `${val.toFixed(decimals)}${suffix}`;
}

export default function MarketAnalysisCard({ analysis }: Props) {
  if (!analysis) {
    return (
      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 16,
          padding: "24px",
          color: C.muted,
          textAlign: "center",
          fontSize: 14,
        }}
      >
        Market analysis not available yet.
      </div>
    );
  }

  const { prediction, confidence, thesis, risk_flags, metrics } = analysis;
  const pc = predictionColors(prediction);
  const pct = Math.round((confidence ?? 0) * 100);

  const metricRows: { label: string; value: string }[] = [
    { label: "SELIC Rate", value: fmt(metrics.selic_rate, 2, "%") },
    { label: "Fed Funds Rate", value: fmt(metrics.fed_funds_rate, 2, "%") },
    { label: "Oil Price", value: metrics.oil_price_usd !== null ? `$${fmt(metrics.oil_price_usd, 2)}` : "—" },
    { label: "Fiscal Health", value: fmt(metrics.fiscal_health_score, 1, "/10") },
    { label: "Geopolitical Risk", value: fmt(metrics.geopolitical_risk_score, 1, "/10") },
    { label: "Political Stability", value: fmt(metrics.political_stability_score, 1, "/10") },
  ];

  const fetchedAt = metrics.fetched_at
    ? new Date(metrics.fetched_at).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 16,
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ color: C.cream, fontWeight: 600, fontSize: 15, letterSpacing: "0.01em" }}>
          Market Analysis
        </span>
        {fetchedAt && (
          <span style={{ color: C.muted, fontSize: 11 }}>Updated {fetchedAt}</span>
        )}
      </div>

      {/* Prediction badge + confidence */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              background: pc.bg,
              color: pc.color,
              border: `1px solid ${pc.color}33`,
              borderRadius: 8,
              padding: "4px 14px",
              fontWeight: 700,
              fontSize: 13,
              letterSpacing: "0.08em",
            }}
          >
            {prediction}
          </span>
          <span style={{ color: C.muted, fontSize: 13 }}>
            Confidence: <span style={{ color: pc.color, fontWeight: 600 }}>{pct}%</span>
          </span>
        </div>

        {/* Confidence bar */}
        <div
          style={{
            height: 6,
            background: "rgba(255,255,255,0.08)",
            borderRadius: 4,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              background: pc.color,
              borderRadius: 4,
              transition: "width 0.6s ease",
            }}
          />
        </div>
      </div>

      {/* Thesis */}
      {thesis && (
        <p
          style={{
            color: C.creamDim,
            fontSize: 13,
            lineHeight: 1.65,
            margin: 0,
            borderLeft: `3px solid ${C.rose}`,
            paddingLeft: 12,
          }}
        >
          {thesis}
        </p>
      )}

      {/* Risk flags */}
      {risk_flags && risk_flags.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ color: C.muted, fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Risk Flags
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {risk_flags.map((flag, i) => (
              <span
                key={i}
                style={{
                  background: C.bearishBg,
                  color: C.bearish,
                  border: `1px solid ${C.bearish}33`,
                  borderRadius: 6,
                  padding: "3px 10px",
                  fontSize: 12,
                }}
              >
                {flag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Metrics grid */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ color: C.muted, fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Key Indicators
        </span>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "8px 16px",
          }}
        >
          {metricRows.map(({ label, value }) => (
            <div
              key={label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 12px",
                background: "rgba(255,255,255,0.04)",
                borderRadius: 8,
                border: `1px solid ${C.border}`,
              }}
            >
              <span style={{ color: C.muted, fontSize: 12 }}>{label}</span>
              <span style={{ color: C.cream, fontSize: 13, fontWeight: 600 }}>{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
