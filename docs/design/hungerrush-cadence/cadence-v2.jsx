import { useState, useEffect, useMemo } from "react";

/* ================================================================
   CADENCE v2 — 1:1 briefings for HungerRush support leads
   ----------------------------------------------------------------
   What's new in this pass:
   1. HONEST CHARTS — every metric declares a fixed domain, so
      sparklines share a stable scale. Small wiggles look small.
      Band metrics (occupancy) render their healthy range.
   2. COACHING ENGINE — talking points now synthesize metric flags
      with each person's context (workload, growth, ramping) into
      suggested opening questions, ordered by priority. The top
      point is flagged "start here."
   3. REAL-WORLD STATES — sources load async with skeletons,
      degrade gracefully on outage (cached data + warning), and
      handle new hires with too little history for trend math.
      A demo toggle in the footer simulates an Assembled outage.

   ARCHITECTURE: sources are adapters in SOURCES. Add one object
   { id, name, fetch(employeeId), normalize(raw) -> Metric[] }
   to integrate a new system. The UI never sees raw API shapes.
   ================================================================ */

/* ---------------- Mock payloads (shaped like real API responses) --- */

const ZENDESK_RAW = {
  maya:   { csat: [93, 94, 92, 95, 96, 95, 97, 96], solved: [48, 52, 50, 55, 53, 58, 61, 60], first_reply_min: [22, 20, 21, 18, 17, 18, 15, 14] },
  dario:  { csat: [91, 90, 89, 88, 86, 84, 83, 81], solved: [44, 46, 43, 41, 38, 36, 35, 33], first_reply_min: [25, 26, 28, 31, 33, 36, 38, 41] },
  priya:  { csat: [89, 90, 90, 91, 90, 91, 91, 92], solved: [51, 50, 52, 51, 53, 52, 54, 53], first_reply_min: [20, 19, 20, 19, 19, 18, 19, 18] },
  tom:    { csat: [78, 80, 82, 84, 85, 87, 88, 90], solved: [18, 24, 29, 33, 38, 41, 45, 47], first_reply_min: [45, 40, 36, 32, 29, 26, 24, 22] },
  jordan: { csat: [74, 79], solved: [6, 11], first_reply_min: [58, 51] },
};

const ASSEMBLED_RAW = {
  maya:   { adherence: [94, 95, 93, 96, 95, 96, 97, 96], occupancy: [78, 80, 79, 81, 80, 82, 81, 82] },
  dario:  { adherence: [92, 91, 89, 87, 85, 82, 80, 78], occupancy: [84, 86, 88, 89, 91, 93, 94, 95] },
  priya:  { adherence: [90, 91, 91, 92, 91, 92, 92, 93], occupancy: [79, 80, 79, 80, 81, 80, 81, 80] },
  tom:    { adherence: [82, 85, 86, 88, 89, 91, 92, 93], occupancy: [70, 72, 74, 75, 77, 78, 79, 80] },
  jordan: { adherence: [80, 84], occupancy: [62, 66] },
};

/* ---------------- Source adapters (the pluggable layer) ------------ */
/* Each metric declares a fixed `domain` so charts are honest:       */
/* a 1-point CSAT wiggle should never look like a 12-point collapse. */

const zendeskSource = {
  id: "zendesk",
  name: "Zendesk",
  fetch: (employeeId) =>
    new Promise((resolve) => setTimeout(() => resolve(ZENDESK_RAW[employeeId]), 300 + Math.random() * 250)),
  normalize: (raw) => [
    { key: "csat", label: "CSAT", trend: raw.csat, goodDirection: "up", domain: [70, 100], format: (v) => `${v}%` },
    { key: "solved", label: "Tickets solved / wk", trend: raw.solved, goodDirection: "up", domain: [0, 70], format: (v) => `${v}` },
    { key: "frt", label: "First reply time", trend: raw.first_reply_min, goodDirection: "down", domain: [0, 60], format: (v) => `${v}m` },
  ],
};

const assembledSource = {
  id: "assembled",
  name: "Assembled",
  fetch: (employeeId) =>
    new Promise((resolve) => setTimeout(() => resolve(ASSEMBLED_RAW[employeeId]), 300 + Math.random() * 250)),
  normalize: (raw) => [
    { key: "adherence", label: "Schedule adherence", trend: raw.adherence, goodDirection: "up", domain: [60, 100], format: (v) => `${v}%` },
    { key: "occupancy", label: "Occupancy", trend: raw.occupancy, goodDirection: "band", band: [75, 88], domain: [55, 100], format: (v) => `${v}%` },
  ],
};

const SOURCES = [zendeskSource, assembledSource]; // ← add new adapters here

/* ---------------- People + context --------------------------------- */
/* `context` feeds the coaching engine: it pairs what the data shows  */
/* with what the manager knows, to suggest better opening questions.  */

const EMPLOYEES = [
  { id: "maya", name: "Maya Okafor", role: "Senior Support Specialist", tenure: "3y 4m", next: "Thu · 10:00",
    context: { growth: "Interested in the team-lead track" },
    actions: ["Share mentorship program details", "Review escalation SOP draft together"] },
  { id: "dario", name: "Dario Reyes", role: "Support Specialist", tenure: "1y 9m", next: "Thu · 11:00",
    context: { workload: "Covering two queues since March" },
    actions: ["Revisit queue coverage split", "Check in on workload"] },
  { id: "priya", name: "Priya Nair", role: "Support Specialist II", tenure: "2y 1m", next: "Fri · 09:30",
    context: { personal: "Work anniversary next week" },
    actions: ["Confirm Q3 goal wording"] },
  { id: "tom", name: "Tom Whitaker", role: "Support Specialist", tenure: "0y 4m", next: "Fri · 14:00",
    context: { ramping: "Week 16 of onboarding" },
    actions: ["Assign first solo escalation", "Schedule product deep-dive"] },
  { id: "jordan", name: "Jordan Lee", role: "Support Specialist", tenure: "0y 1m", next: "Mon · 13:00",
    context: { ramping: "Week 2 — first full week on queue" },
    actions: ["Pair on five tickets together", "Introduce to escalation buddy"] },
];

/* ---------------- Insight + coaching engine ------------------------ */

function delta(trend) {
  const cur = trend[trend.length - 1];
  if (trend.length < 4) {
    const first = trend[0];
    return { cur, change: cur - first, pct: ((cur - first) / first) * 100, sparse: true };
  }
  const prior = trend.slice(0, 4).reduce((a, b) => a + b, 0) / 4;
  return { cur, change: cur - prior, pct: ((cur - prior) / prior) * 100, sparse: false };
}

function assess(metric) {
  const d = delta(metric.trend);
  if (d.sparse) return { tone: "new", d };
  if (metric.goodDirection === "band") {
    const [lo, hi] = metric.band;
    if (d.cur > hi || d.cur < lo) return { tone: "watch", d };
    return { tone: "steady", d };
  }
  const signed = metric.goodDirection === "down" ? -d.pct : d.pct;
  if (signed >= 6) return { tone: "win", d };
  if (signed <= -6) return { tone: "watch", d };
  return { tone: "steady", d };
}

/* Points are ordered: discuss → celebrate → notes. Each carries a
   suggested question that blends the data with the person's context. */
function talkingPoints(metrics, emp) {
  const discuss = [], celebrate = [], notes = [];
  const ctx = emp.context || {};

  metrics.forEach(({ metric, source }) => {
    const { tone, d } = assess(metric);
    const dir = d.change > 0 ? "up" : "down";
    if (tone === "watch") {
      if (metric.key === "occupancy" && d.cur > (metric.band?.[1] ?? 100)) {
        discuss.push({
          kind: "discuss",
          text: `Occupancy ${d.cur}% — burnout risk.${ctx.workload ? ` ${ctx.workload}.` : ""}`,
          ask: ctx.workload
            ? `“If you could hand off one thing this month, what would it be?”`
            : `“How is the pace feeling lately — honestly?”`,
        });
      } else {
        discuss.push({
          kind: "discuss",
          text: `${metric.label} ${dir} ${Math.abs(d.pct).toFixed(0)}% — ${metric.format(d.cur)} now.`,
          ask: `“What's changed in your queue lately that I might not see from my side?”`,
        });
      }
    }
    if (tone === "win") {
      celebrate.push({
        kind: "celebrate",
        text: `${metric.label} ${dir} ${Math.abs(d.pct).toFixed(0)}% vs. last month.`,
        ask: `“What's working here that we should protect?”`,
      });
    }
  });

  if (ctx.growth) notes.push({ kind: "growth", text: ctx.growth + ".", ask: `“What would you want your first stretch project to be?”` });
  if (ctx.personal) notes.push({ kind: "note", text: ctx.personal + "." });
  if (ctx.ramping) notes.push({ kind: "ramping", text: ctx.ramping + ".", ask: `“What's been most confusing so far?”` });

  // Keep asks from repeating: only the first discuss + first celebrate keep theirs.
  discuss.slice(1).forEach((p) => delete p.ask);
  celebrate.slice(1).forEach((p) => delete p.ask);

  return [...discuss, ...celebrate, ...notes];
}

/* ---------------- HungerRush brand tokens --------------------------- */

const T = {
  navy: "#0C1443", navySoft: "#3A3F6B",
  teal: "#3B8272",      // brand teal (sampled from logo)
  tealTint: "#EAF3F0",
  coral: "#C4553A",     // alert — warm, distinct from brand
  bg: "#F6F7F9", card: "#FFFFFF", line: "#E3E6EE",
  gray: "#5C607E", grayLight: "#9EA2BC",
  amber: "#E9930F",
  heading: "'Montserrat', system-ui, sans-serif",
  body: "'Inter', system-ui, sans-serif",
  mono: "'IBM Plex Mono', monospace",
  radius: 12,
  shadow: "0 1px 3px rgba(12,20,67,0.08), 0 4px 16px rgba(12,20,67,0.06)",
};

const TONE = {
  win: { color: T.teal, word: "win" },
  watch: { color: T.coral, word: "discuss" },
  steady: { color: T.grayLight, word: "steady" },
  new: { color: T.grayLight, word: "new" },
};

/* ---------------- Small pieces ------------------------------------- */

/* Anchored sparkline: scales to metric.domain (not min/max of the
   data), optionally shades a healthy band. Honest by construction. */
function Sparkline({ trend, domain, band, color, width = 100, height = 32 }) {
  const [lo, hi] = domain;
  const span = hi - lo || 1;
  const y = (v) => height - 3 - ((v - lo) / span) * (height - 6);
  const step = width / Math.max(trend.length - 1, 1);
  const pts = trend.map((v, i) => `${i * step},${y(v)}`).join(" ");
  const lastPt = pts.split(" ").pop().split(",");
  const label = `Trend over ${trend.length} weeks, from ${trend[0]} to ${trend[trend.length - 1]}, on a fixed ${lo}–${hi} scale`;
  return (
    <svg width={width} height={height} style={{ overflow: "visible" }} role="img" aria-label={label}>
      {band && <rect x="0" y={y(band[1])} width={width} height={Math.max(y(band[0]) - y(band[1]), 0)} fill={T.teal} opacity="0.12" rx="2" />}
      <line x1="0" y1={y(lo)} x2={width} y2={y(lo)} stroke={T.line} strokeWidth="1" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastPt[0]} cy={lastPt[1]} r="3.2" fill={color} />
    </svg>
  );
}

function ToneDot({ tone }) {
  return <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 99, background: TONE[tone].color, flexShrink: 0 }} aria-hidden="true" />;
}

function Eyebrow({ children, color = T.navySoft }) {
  return (
    <div style={{ fontFamily: T.heading, fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color, marginBottom: 10 }}>
      {children}
    </div>
  );
}

function Skeleton({ h = 16, w = "100%", style }) {
  return <div className="skel" style={{ height: h, width: w, borderRadius: 6, ...style }} aria-hidden="true" />;
}

/* ---------------- Metric row ---------------------------------------- */

function MetricRow({ metric }) {
  const { tone, d } = assess(metric);
  const { color } = TONE[tone];
  const arrow = d.change > 0 ? "↑" : d.change < 0 ? "↓" : "→";
  const sub = tone === "new"
    ? `wk ${metric.trend.length}`
    : `${arrow} ${Math.abs(d.pct).toFixed(1)}%`;
  return (
    <div className="metric-row" style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 0", borderBottom: `1px solid ${T.line}` }}>
      <ToneDot tone={tone} />
      <div style={{ flex: 1, minWidth: 130 }}>
        <div style={{ fontFamily: T.body, fontSize: 13.5, color: T.navy, fontWeight: 600 }}>{metric.label}</div>
        <div style={{ fontFamily: T.mono, fontSize: 11, color }}>{sub}</div>
      </div>
      <div className="metric-right" style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <Sparkline trend={metric.trend} domain={metric.domain} band={metric.band} color={color} />
        <div style={{ fontFamily: T.heading, fontWeight: 700, fontSize: 22, color: T.navy, minWidth: 58, textAlign: "right" }}>
          {metric.format(d.cur)}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Data loading hook --------------------------------- */
/* Loads every source for one employee. Per-source status means a
   Zendesk outage never takes down the Assembled panel, and vice versa.
   On failure we fall back to the last synced payload with a warning. */

function useSourceData(empId, simulateOutage) {
  const [state, setState] = useState({ loading: true, results: [] });
  useEffect(() => {
    let alive = true;
    setState({ loading: true, results: [] });
    Promise.all(
      SOURCES.map(async (source) => {
        try {
          if (simulateOutage && source.id === "assembled") throw new Error("503 Service Unavailable");
          const raw = await source.fetch(empId);
          return { source, status: "ok", metrics: source.normalize(raw) };
        } catch (e) {
          // Real app: read from local cache. Demo: reuse the payload as "last synced".
          const cached = source.id === "assembled" ? ASSEMBLED_RAW[empId] : ZENDESK_RAW[empId];
          return { source, status: "stale", metrics: source.normalize(cached), syncedAt: "yesterday, 11:04 PM" };
        }
      })
    ).then((results) => alive && setState({ loading: false, results }));
    return () => { alive = false; };
  }, [empId, simulateOutage]);
  return state;
}

/* ---------------- Scorecard ----------------------------------------- */

function Scorecard({ emp, simulateOutage }) {
  const [done, setDone] = useState({});
  const [note, setNote] = useState("");
  const { loading, results } = useSourceData(emp.id, simulateOutage);

  const flat = useMemo(
    () => results.flatMap(({ source, metrics }) => metrics.map((metric) => ({ metric, source }))),
    [results]
  );
  const points = loading ? [] : talkingPoints(flat, emp);
  const wins = flat.filter((m) => assess(m.metric).tone === "win").length;
  const watches = flat.filter((m) => assess(m.metric).tone === "watch").length;
  const isNewHire = flat.length > 0 && flat.every((m) => assess(m.metric).tone === "new");

  return (
    <div>
      {/* Header */}
      <div style={{ background: T.card, borderRadius: T.radius, boxShadow: T.shadow, overflow: "hidden", marginBottom: 20 }}>
        <div style={{ height: 5, background: T.teal }} />
        <div style={{ padding: "20px 22px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontFamily: T.heading, fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: T.navySoft, marginBottom: 6 }}>
              1:1 · {emp.next}
            </div>
            <h1 style={{ fontFamily: T.heading, fontSize: "clamp(26px, 5.5vw, 36px)", fontWeight: 800, color: T.navy, margin: 0, lineHeight: 1.1 }}>
              {emp.name}
            </h1>
            <div style={{ fontFamily: T.body, fontSize: 13.5, color: T.gray, marginTop: 5 }}>
              {emp.role} · {emp.tenure} tenure
            </div>
          </div>
          <div style={{ display: "flex", gap: 22 }}>
            {loading ? <Skeleton h={40} w={110} /> : (
              <>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: T.heading, fontWeight: 800, fontSize: 24, color: T.teal }}>{wins}</div>
                  <div style={{ fontFamily: T.body, fontSize: 11, color: T.gray }}>wins</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: T.heading, fontWeight: 800, fontSize: 24, color: watches ? T.coral : T.grayLight }}>{watches}</div>
                  <div style={{ fontFamily: T.body, fontSize: 11, color: T.gray }}>to discuss</div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }} className="md:grid-cols-2">
        {/* Talking points */}
        <section style={{ background: T.card, borderRadius: T.radius, boxShadow: T.shadow, padding: "20px 22px" }}>
          <Eyebrow>Talking points</Eyebrow>

          {loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Skeleton h={72} /><Skeleton h={56} /><Skeleton h={56} />
            </div>
          )}

          {!loading && isNewHire && (
            <div style={{ background: T.bg, borderRadius: 8, padding: "16px 16px", marginBottom: 10 }}>
              <div style={{ fontFamily: T.body, fontSize: 13, color: T.gray, lineHeight: 1.55 }}>
                Under a month of history — trends unlock at week 4. Keep this one about onboarding.
              </div>
            </div>
          )}

          {!loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {points.map((p, i) => {
                const c = p.kind === "discuss" ? T.coral : p.kind === "celebrate" ? T.teal : p.kind === "growth" ? T.teal : T.amber;
                const lead = i === 0 && (p.kind === "discuss" || p.kind === "celebrate");
                return (
                  <div key={i} style={{
                    background: lead ? (p.kind === "discuss" ? "#FBF1EE" : T.tealTint) : T.bg,
                    border: lead ? `1px solid ${c}33` : "none",
                    borderLeft: `3px solid ${c}`,
                    borderRadius: 8, padding: lead ? "14px 16px" : "11px 14px",
                  }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "baseline", marginBottom: 4 }}>
                      <span style={{ fontFamily: T.heading, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: c }}>
                        {p.kind}
                      </span>
                      {lead && (
                        <span style={{ fontFamily: T.heading, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#FFFFFF", background: c, borderRadius: 4, padding: "2px 7px" }}>
                          start here
                        </span>
                      )}
                    </div>
                    <div style={{ fontFamily: T.body, fontSize: lead ? 14 : 13.5, color: T.navy, lineHeight: 1.5 }}>{p.text}</div>
                    {p.ask && (
                      <div style={{ fontFamily: T.body, fontSize: 13, color: T.navySoft, marginTop: 6, fontStyle: "italic" }}>
                        Ask: {p.ask}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ marginTop: 24 }}>
            <Eyebrow>Action items</Eyebrow>
            {emp.actions.map((a, i) => (
              <label key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "7px 0", cursor: "pointer", fontFamily: T.body, fontSize: 13.5, color: done[i] ? T.grayLight : T.navy, textDecoration: done[i] ? "line-through" : "none" }}>
                <input type="checkbox" checked={!!done[i]} onChange={() => setDone((d) => ({ ...d, [i]: !d[i] }))} style={{ accentColor: T.teal, marginTop: 2 }} />
                {a}
              </label>
            ))}
          </div>

          <div style={{ marginTop: 24 }}>
            <Eyebrow>Notes</Eyebrow>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Notes…"
              rows={4}
              style={{ width: "100%", boxSizing: "border-box", background: T.bg, border: `1px solid ${T.line}`, borderRadius: 8, padding: 12, fontFamily: T.body, fontSize: 13.5, color: T.navy, resize: "vertical", outlineColor: T.navy }}
            />
          </div>
        </section>

        {/* Metrics grouped by source, with per-source status */}
        <section style={{ background: T.card, borderRadius: T.radius, boxShadow: T.shadow, padding: "20px 22px", alignSelf: "start" }}>
          {loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Skeleton h={14} w={90} /><Skeleton h={48} /><Skeleton h={48} /><Skeleton h={48} />
              <Skeleton h={14} w={90} style={{ marginTop: 10 }} /><Skeleton h={48} /><Skeleton h={48} />
            </div>
          )}
          {!loading && results.map(({ source, metrics, status, syncedAt }) => (
            <div key={source.id} style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <Eyebrow>{source.name}</Eyebrow>
                <span style={{ fontFamily: T.mono, fontSize: 10, color: T.grayLight }}>{metrics[0].trend.length} wk</span>
              </div>
              {status === "stale" && (
                <div role="status" style={{ background: "#FDF4E3", border: `1px solid ${T.amber}55`, borderRadius: 8, padding: "9px 12px", marginBottom: 8, fontFamily: T.body, fontSize: 12, color: "#8A5A0B", lineHeight: 1.45 }}>
                  {source.name} unreachable — showing last sync ({syncedAt}).
                </div>
              )}
              <div style={{ borderTop: `1px solid ${T.line}`, opacity: status === "stale" ? 0.75 : 1 }}>
                {metrics.map((m) => <MetricRow key={m.key} metric={m} />)}
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

/* ---------------- Roster + shell ------------------------------------ */

function attentionOf(empId) {
  const flat = SOURCES.flatMap((s) => {
    const raw = s.id === "zendesk" ? ZENDESK_RAW[empId] : ASSEMBLED_RAW[empId];
    return s.normalize(raw);
  });
  const watches = flat.filter((m) => assess(m).tone === "watch").length;
  if (flat.every((m) => assess(m).tone === "new")) return "new";
  return watches >= 2 ? "watch" : watches === 1 ? "steady" : "win";
}

const ATTN_LABEL = { win: "on track", steady: "one flag", watch: "needs attention this week", new: "ramping" };

export default function App() {
  const [sel, setSel] = useState(EMPLOYEES[0].id);
  const [outage, setOutage] = useState(false);
  const emp = EMPLOYEES.find((e) => e.id === sel);

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.navy }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
        * { -webkit-font-smoothing: antialiased; }
        .roster-btn { transition: transform .12s ease, box-shadow .12s ease; }
        .roster-btn:hover { transform: translateY(-1px); box-shadow: ${T.shadow}; }
        .roster-btn:focus-visible { outline: 2px solid ${T.teal}; outline-offset: 2px; }
        .skel { background: linear-gradient(90deg, #ECEEF5 25%, #F6F7FB 50%, #ECEEF5 75%); background-size: 200% 100%; animation: shimmer 1.4s infinite; }
        @keyframes shimmer { to { background-position: -200% 0; } }
        @media (max-width: 520px) {
          .metric-row { flex-wrap: wrap; }
          .metric-right { width: 100%; justify-content: space-between; padding-left: 22px; }
        }
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
      `}</style>

      <header style={{ background: T.navy }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontFamily: T.heading, fontWeight: 800, fontSize: 19, color: "#FFFFFF", letterSpacing: "-0.01em", display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="26" height="19" viewBox="0 0 30 22" aria-hidden="true">
              <path d="M8 20 A6.5 6.5 0 0 1 8.5 7.2 A8.5 8.5 0 0 1 24.5 9.5 A5.5 5.5 0 0 1 23.5 20 Z" fill="none" stroke="#3B8272" strokeWidth="2.4" strokeLinejoin="round" />
              <path d="M12.5 20 v-7 M18.5 20 v-7 M12.5 16.5 h6" stroke="#3B8272" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
            <span>Hunger<span style={{ color: T.teal }}>Rush</span></span>
            <span style={{ fontWeight: 600, color: "#AEB3CE", fontSize: 14, marginLeft: 8 }}>Cadence</span>
          </div>
          {outage && (
            <div style={{ fontFamily: T.body, fontSize: 11.5, color: T.amber, display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: 99, background: T.amber, display: "inline-block" }} aria-hidden="true" />
              Assembled degraded
            </div>
          )}
        </div>
      </header>

      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "24px 20px 40px" }}>
        <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 16, marginBottom: 12 }}>
          {EMPLOYEES.map((e) => {
            const h = attentionOf(e.id);
            const active = e.id === sel;
            return (
              <button
                key={e.id}
                className="roster-btn"
                onClick={() => setSel(e.id)}
                aria-label={`${e.name}, ${ATTN_LABEL[h]}, 1:1 ${e.next}`}
                style={{
                  flexShrink: 0, textAlign: "left", cursor: "pointer",
                  background: active ? T.navy : T.card,
                  color: active ? "#FFFFFF" : T.navy,
                  border: `1px solid ${active ? T.navy : T.line}`,
                  borderTop: `3px solid ${active ? T.teal : "transparent"}`,
                  borderRadius: 10, padding: "11px 14px", minWidth: 168,
                  boxShadow: active ? T.shadow : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                  <ToneDot tone={h} />
                  <span style={{ fontFamily: T.heading, fontSize: 14, fontWeight: 700 }}>{e.name}</span>
                </div>
                <div style={{ fontFamily: T.body, fontSize: 11, color: active ? "#AEB3CE" : T.gray }}>{e.next}</div>
              </button>
            );
          })}
        </div>

        <Scorecard emp={emp} simulateOutage={outage} />

        {/* Demo controls — remove before shipping */}
        <div style={{ marginTop: 28, paddingTop: 14, borderTop: `1px dashed ${T.line}`, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: T.mono, fontSize: 10.5, color: T.grayLight }}>DEMO</span>
          <button
            onClick={() => setOutage(!outage)}
            style={{ fontFamily: T.body, fontSize: 12, fontWeight: 600, cursor: "pointer", color: outage ? "#8A5A0B" : T.gray, background: outage ? "#FDF4E3" : T.card, border: `1px solid ${outage ? T.amber : T.line}`, borderRadius: 8, padding: "6px 12px" }}
          >
            {outage ? "Outage on — restore" : "Simulate outage"}
          </button>
        </div>
      </main>
    </div>
  );
}
