import { useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock3,
  Fingerprint,
  ChevronRight,
} from "lucide-react";

const C = {
  bg: "#2C3930",
  surface: "rgba(63,79,68,0.18)",
  surfaceStrong: "rgba(63,79,68,0.28)",
  border: "rgba(162,123,92,0.10)",
  rose: "#A27B5C",
  cream: "#DCD7C9",
  muted: "rgba(220,215,201,0.50)",
  mutedStrong: "rgba(220,215,201,0.72)",
  success: "#34d399",
  danger: "#f87171",
  warning: "#fbbf24",
};

type AuditStatus = "verified" | "pending" | "failed";
type DecisionOutcome = "CONVERT" | "WAIT";

type TrustDecision = {
  id: string;
  created_at: string;
  pair: string;
  amount: number;
  source_currency: string;
  target_currency: string;
  decision: DecisionOutcome;
  confidence: number;
  reason_codes: string[];
  payload_hash: string;
  tx_hash: string;
  block_number?: number;
  network: string;
  status: AuditStatus;
  estimated_rate: number;
  fee_usd: number;
  due_date: string;
};

const MOCK_DECISIONS: TrustDecision[] = [
  {
    id: "dec_1042",
    created_at: "2026-04-01T13:42:00Z",
    pair: "BRL / USD",
    amount: 2400,
    source_currency: "BRL",
    target_currency: "USD",
    decision: "CONVERT",
    confidence: 0.87,
    reason_codes: ["RATE_TARGET_HIT", "DUE_DATE_SOON", "SAFE_ROUTE"],
    payload_hash: "8f3af17b91dc422ce17ab912f8ca0da23af09f2b19",
    tx_hash: "0xabc12391f02b8a1d45f7e992ad081ce784bf19ef0",
    block_number: 4821931,
    network: "Base Sepolia",
    status: "verified",
    estimated_rate: 5.0214,
    fee_usd: 12,
    due_date: "2026-04-05",
  },
  {
    id: "dec_1041",
    created_at: "2026-04-01T10:15:00Z",
    pair: "BRL / USD",
    amount: 1250,
    source_currency: "BRL",
    target_currency: "USD",
    decision: "WAIT",
    confidence: 0.78,
    reason_codes: ["RATE_BELOW_TARGET", "LOW_URGENCY"],
    payload_hash: "1d7be1aa02ce441af2ab5519af730dc77a880f0a19",
    tx_hash: "0x7bf292ad991ce72fe1a0d5a73dbe20fa8ad1ce0bd2",
    block_number: 4821029,
    network: "Base Sepolia",
    status: "verified",
    estimated_rate: 4.9821,
    fee_usd: 8,
    due_date: "2026-04-14",
  },
  {
    id: "dec_1040",
    created_at: "2026-03-31T21:08:00Z",
    pair: "USD / BRL",
    amount: 900,
    source_currency: "USD",
    target_currency: "BRL",
    decision: "CONVERT",
    confidence: 0.81,
    reason_codes: ["FAST_SETTLEMENT_REQUIRED", "SAFE_ROUTE"],
    payload_hash: "5ca1b80d113fe013ab920fc7700da9981dce772ab3",
    tx_hash: "0x8aa12ce19f1ab007cde912afdb7810ca55bfac8e10",
    network: "Base Sepolia",
    status: "pending",
    estimated_rate: 5.1138,
    fee_usd: 0,
    due_date: "2026-04-02",
  },
  {
    id: "dec_1039",
    created_at: "2026-03-31T16:50:00Z",
    pair: "BRL / USD",
    amount: 3100,
    source_currency: "BRL",
    target_currency: "USD",
    decision: "CONVERT",
    confidence: 0.65,
    reason_codes: ["MANUAL_OVERRIDE_REVIEW"],
    payload_hash: "29bf17d0a930f102b91cc2a8f7ac00bd9118ef0123",
    tx_hash: "0x51ac82bf12a0f8cd7129ce005ba1289dfe0192ca10",
    network: "Base Sepolia",
    status: "failed",
    estimated_rate: 5.0004,
    fee_usd: 25,
    due_date: "2026-04-03",
  },
];

type TabKey = "summary" | "inputs" | "decision" | "proof";

function shortHash(value: string, start = 6, end = 4) {
  if (value.length <= start + end) return value;
  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

function fmtDate(date: string) {
  return new Date(date).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtMoney(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function getStatusBadge(status: AuditStatus) {
  if (status === "verified") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
        style={{ background: "rgba(52,211,153,0.15)", color: C.success }}
      >
        <CheckCircle2 className="h-3 w-3" />
        Verified
      </span>
    );
  }

  if (status === "pending") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
        style={{ background: "rgba(251,191,36,0.15)", color: C.warning }}
      >
        <Clock3 className="h-3 w-3" />
        Pending
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
      style={{ background: "rgba(248,113,113,0.15)", color: C.danger }}
    >
      <AlertTriangle className="h-3 w-3" />
      Failed
    </span>
  );
}

export default function AuditPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("summary");
  const [selectedId, setSelectedId] = useState<string>(MOCK_DECISIONS[0].id);

  const selectedDecision = useMemo(
    () => MOCK_DECISIONS.find((d) => d.id === selectedId) ?? MOCK_DECISIONS[0],
    [selectedId]
  );

  const verificationLabel =
    selectedDecision.status === "verified"
      ? "Payload matches on-chain commitment"
      : selectedDecision.status === "pending"
      ? "Waiting for chain confirmation"
      : "Proof could not be confirmed";

  const tabs: { key: TabKey; label: string }[] = [
    { key: "summary", label: "Summary" },
    { key: "inputs", label: "Inputs" },
    { key: "decision", label: "Decision" },
    { key: "proof", label: "Proof" },
  ];

  return (
    <div className="font-sans antialiased" style={{ background: C.bg, color: C.cream }}>
      <div className="flex h-screen overflow-hidden">
        <Navbar />

        <main className="flex-1 overflow-y-auto" style={{ background: C.bg }}>
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
              <section
                className="overflow-hidden rounded-2xl xl:col-span-8"
                style={{ background: C.surface, border: `1px solid ${C.border}` }}
              >
                <div
                  className="flex flex-col gap-4 px-6 py-5 lg:flex-row lg:items-center lg:justify-between"
                  style={{ borderBottom: `1px solid ${C.border}` }}
                >
                  <div className="overflow-x-auto">
                    <div className="flex min-w-max gap-6">
                      {tabs.map((tab) => {
                        const active = activeTab === tab.key;
                        return (
                          <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className="border-b-2 pb-3 text-sm font-bold transition-colors"
                            style={{
                              borderColor: active ? C.rose : "transparent",
                              color: active ? C.rose : C.muted,
                            }}
                          >
                            {tab.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs" style={{ color: C.muted }}>
                    <Fingerprint className="h-4 w-4" />
                    <code>{shortHash(selectedDecision.tx_hash, 8, 6)}</code>
                  </div>
                </div>

                <div className="p-6">
                  {activeTab === "summary" && (
                    <>
                      <div className="mb-8">
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: C.muted }}>
                          Decision Overview
                        </p>
                        <h3 className="text-3xl font-black tracking-tight" style={{ color: C.cream }}>
                          {selectedDecision.decision === "CONVERT"
                            ? "Conversion Approved"
                            : "Conversion Delayed"}
                        </h3>
                        <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: C.mutedStrong }}>
                          This entry shows the trust agent’s final decision, the confidence
                          attached to that recommendation, and the proof record used to make
                          the result tamper-evident.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: C.muted }}>
                            Currency Pair
                          </p>
                          <p className="mt-1 text-2xl font-black" style={{ color: C.cream }}>
                            {selectedDecision.pair}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: C.muted }}>
                            Amount
                          </p>
                          <p className="mt-1 text-2xl font-black" style={{ color: C.cream }}>
                            {fmtMoney(selectedDecision.amount, selectedDecision.target_currency)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: C.muted }}>
                            Confidence
                          </p>
                          <p className="mt-1 text-2xl font-black" style={{ color: C.rose }}>
                            {(selectedDecision.confidence * 100).toFixed(0)}%
                          </p>
                        </div>
                      </div>

                      <div
                        className="mt-8 rounded-2xl p-5"
                        style={{ background: "rgba(63,79,68,0.16)", border: `1px solid ${C.border}` }}
                      >
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: C.muted }}>
                          Current Verification State
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          {getStatusBadge(selectedDecision.status)}
                          <span className="text-sm" style={{ color: C.mutedStrong }}>
                            {verificationLabel}
                          </span>
                        </div>
                      </div>
                    </>
                  )}

                  {activeTab === "inputs" && (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {[
                        ["Source Currency", selectedDecision.source_currency],
                        ["Target Currency", selectedDecision.target_currency],
                        ["Amount", fmtMoney(selectedDecision.amount, selectedDecision.target_currency)],
                        ["Estimated Rate", `1 USD = ${selectedDecision.estimated_rate.toFixed(4)} BRL`],
                        ["Processing Fee", `$${selectedDecision.fee_usd.toFixed(2)}`],
                        ["Due Date", selectedDecision.due_date],
                        ["Decision ID", selectedDecision.id],
                        ["Timestamp", fmtDate(selectedDecision.created_at)],
                      ].map(([label, value]) => (
                        <div
                          key={label}
                          className="rounded-2xl p-4"
                          style={{ background: "rgba(63,79,68,0.14)", border: `1px solid ${C.border}` }}
                        >
                          <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: C.muted }}>
                            {label}
                          </p>
                          <p className="mt-2 text-sm font-semibold" style={{ color: C.cream }}>
                            {value}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeTab === "decision" && (
                    <>
                      <div className="mb-5">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: C.muted }}>
                          Outcome
                        </p>
                        <p className="mt-2 text-3xl font-black" style={{ color: selectedDecision.decision === "CONVERT" ? C.rose : C.cream }}>
                          {selectedDecision.decision === "CONVERT" ? "Convert Now" : "Wait for Better Conditions"}
                        </p>
                      </div>

                      <div className="space-y-3">
                        {selectedDecision.reason_codes.map((reason) => (
                          <div
                            key={reason}
                            className="flex items-center gap-3 rounded-xl px-4 py-3"
                            style={{ background: "rgba(63,79,68,0.14)", border: `1px solid ${C.border}` }}
                          >
                            <ChevronRight className="h-4 w-4" style={{ color: C.rose }} />
                            <span className="text-sm font-medium" style={{ color: C.cream }}>
                              {reason.replaceAll("_", " ")}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {activeTab === "proof" && (
                    <div className="space-y-4">
                      {[
                        ["Payload Hash", selectedDecision.payload_hash],
                        ["Transaction Hash", selectedDecision.tx_hash],
                        ["Blockchain Network", selectedDecision.network],
                        ["Block Number", selectedDecision.block_number ? String(selectedDecision.block_number) : "Pending"],
                      ].map(([label, value]) => (
                        <div
                          key={label}
                          className="rounded-2xl p-4"
                          style={{ background: "rgba(63,79,68,0.14)", border: `1px solid ${C.border}` }}
                        >
                          <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: C.muted }}>
                            {label}
                          </p>
                          <code
                            className="mt-2 block break-all text-sm"
                            style={{ color: C.cream, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
                          >
                            {value}
                          </code>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <aside className="space-y-6 xl:col-span-4">
                <div
                  className="rounded-2xl p-6"
                  style={{ background: C.surface, border: `1px solid ${C.border}` }}
                >
                  <div className="mb-6 flex items-center gap-3">
                    <ShieldCheck className="h-5 w-5" style={{ color: C.success }} />
                    <h3 className="text-sm font-bold uppercase tracking-widest" style={{ color: C.cream }}>
                      Ledger Integrity
                    </h3>
                  </div>

                  <div className="mb-8">
                    <div
                      className="text-4xl font-black"
                      style={{
                        color:
                          selectedDecision.status === "verified"
                            ? C.success
                            : selectedDecision.status === "pending"
                            ? C.warning
                            : C.danger,
                      }}
                    >
                      {selectedDecision.status === "verified"
                        ? "VERIFIED"
                        : selectedDecision.status === "pending"
                        ? "PENDING"
                        : "FAILED"}
                    </div>
                    <p className="mt-2 text-xs uppercase tracking-wider" style={{ color: C.muted }}>
                      {verificationLabel}
                    </p>
                  </div>

                  <div className="space-y-5">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: C.muted }}>
                        Audit Log ID
                      </p>
                      <code className="mt-1 block text-sm" style={{ color: C.cream }}>
                        {selectedDecision.id}
                      </code>
                    </div>

                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: C.muted }}>
                        State Hash
                      </p>
                      <code className="mt-1 block text-sm break-all" style={{ color: C.cream }}>
                        {selectedDecision.payload_hash}
                      </code>
                    </div>

                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: C.muted }}>
                        Transaction
                      </p>
                      <code className="mt-1 block text-sm break-all" style={{ color: C.cream }}>
                        {selectedDecision.tx_hash}
                      </code>
                    </div>
                  </div>

                  <button
                    className="mt-8 w-full rounded-xl px-4 py-3 text-sm font-bold transition-all hover:opacity-90"
                    style={{ background: C.rose, color: C.bg }}
                  >
                    Run Manual Audit
                  </button>
                </div>

                <div
                  className="rounded-2xl p-6"
                  style={{
                    background: "rgba(162,123,92,0.10)",
                    border: `1px solid rgba(162,123,92,0.18)`,
                  }}
                >
                  <h4 className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: C.rose }}>
                    Governance Note
                  </h4>
                  <p className="mt-3 text-sm italic leading-relaxed" style={{ color: C.cream }}>
                    Sensitive user data stays off-chain. Only the canonical decision
                    record hash is anchored, so the audit trail is tamper-evident
                    without exposing private financial details.
                  </p>
                </div>
              </aside>
            </div>

            <section className="mt-10">
              <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-2xl font-bold" style={{ color: C.cream }}>
                    Decision History
                  </h3>
                  <p className="mt-1 text-sm" style={{ color: C.muted }}>
                    Recent trust-agent decisions and their current audit status.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    className="rounded-xl px-4 py-2 text-xs font-bold transition-colors"
                    style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.mutedStrong }}
                  >
                    Export CSV
                  </button>
                  <button
                    className="rounded-xl px-4 py-2 text-xs font-bold transition-colors"
                    style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.mutedStrong }}
                  >
                    Filter
                  </button>
                </div>
              </div>

              <div
                className="overflow-hidden rounded-2xl"
                style={{ background: C.surface, border: `1px solid ${C.border}` }}
              >
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-left">
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${C.border}`, background: "rgba(63,79,68,0.25)" }}>
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider" style={{ color: C.muted }}>
                          Decision ID
                        </th>
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider" style={{ color: C.muted }}>
                          Time
                        </th>
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider" style={{ color: C.muted }}>
                          Pair
                        </th>
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider" style={{ color: C.muted }}>
                          Amount
                        </th>
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider" style={{ color: C.muted }}>
                          Outcome
                        </th>
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider" style={{ color: C.muted }}>
                          Confidence
                        </th>
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider" style={{ color: C.rose }}>
                          Hash
                        </th>
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider" style={{ color: C.muted }}>
                          Status
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {MOCK_DECISIONS.map((decision) => {
                        const selected = decision.id === selectedDecision.id;

                        return (
                          <tr
                            key={decision.id}
                            onClick={() => setSelectedId(decision.id)}
                            className="cursor-pointer transition-colors"
                            style={{
                              borderTop: `1px solid ${C.border}`,
                              background: selected ? "rgba(162,123,92,0.08)" : "transparent",
                            }}
                          >
                            <td className="px-6 py-4 text-sm font-semibold" style={{ color: selected ? C.rose : C.cream }}>
                              {decision.id}
                            </td>
                            <td className="px-6 py-4 text-sm" style={{ color: C.mutedStrong }}>
                              {fmtDate(decision.created_at)}
                            </td>
                            <td className="px-6 py-4 text-sm font-semibold" style={{ color: C.cream }}>
                              {decision.pair}
                            </td>
                            <td className="px-6 py-4 text-sm" style={{ color: C.cream }}>
                              {fmtMoney(decision.amount, decision.target_currency)}
                            </td>
                            <td className="px-6 py-4 text-sm font-semibold" style={{ color: C.cream }}>
                              {decision.decision}
                            </td>
                            <td className="px-6 py-4 text-sm font-bold" style={{ color: C.rose }}>
                              {(decision.confidence * 100).toFixed(0)}%
                            </td>
                            <td
                              className="px-6 py-4 text-sm"
                              style={{
                                color: C.rose,
                                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                              }}
                            >
                              {shortHash(decision.payload_hash, 8, 6)}
                            </td>
                            <td className="px-6 py-4">{getStatusBadge(decision.status)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}