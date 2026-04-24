import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from "@react-pdf/renderer";
import { RUBRIC_VERSION } from "@/lib/scoring/rubric";
import { DIMENSION_LABELS } from "@/types/domain";
import type { SkillDimension } from "@/types/domain";
import type {
  DailyCompositePoint,
  PressureRepStats,
  RecentRep,
} from "@/lib/db/queries/progress";

/**
 * Typed props mirror the shape the server passes in — same data the
 * HTML /report page consumes, flattened to primitives so react-pdf can
 * serialize without choking on unsupported nodes (no SVG / no animations).
 */
export type ReportPdfProps = {
  displayName: string;
  generatedAtIso: string;
  totals: {
    totalReps: number;
    streakDays: number;
    averageComposite: number | string;
    peakComposite: number | string;
  };
  dailyCompositeTrend: DailyCompositePoint[];
  dimensionMaxes: Partial<Record<SkillDimension, number | null>>;
  weeklySummary: {
    weekStartISO: string;
    weekEndISO: string;
    repCount: number;
    averageComposite: number;
    weakestDimension: SkillDimension | null;
    dimensions: {
      dimension: SkillDimension;
      avg: number | null;
      delta: number | null;
    }[];
  };
  pressureStats: PressureRepStats;
  recentReps: RecentRep[];
};

const COLORS = {
  ink900: "#0F172A",
  ink700: "#334155",
  ink500: "#64748B",
  ink300: "#CBD5E1",
  ink100: "#F1F5F9",
  brand: "#8B5CF6",
  emerald: "#047857",
  amber: "#B45309",
};

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: COLORS.ink900,
    paddingTop: 42,
    paddingBottom: 42,
    paddingHorizontal: 48,
  },
  kicker: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: COLORS.brand,
  },
  h1: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    marginTop: 6,
  },
  subtext: {
    marginTop: 3,
    fontSize: 9,
    color: COLORS.ink500,
  },
  sectionSpacer: {
    marginTop: 20,
  },
  divider: {
    marginTop: 14,
    marginBottom: 14,
    height: 1,
    backgroundColor: COLORS.ink300,
  },
  row: {
    flexDirection: "row",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.ink300,
    borderRadius: 6,
    padding: 10,
    backgroundColor: "#F8FAFC",
  },
  statLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1.3,
    textTransform: "uppercase",
    color: COLORS.ink500,
  },
  statValue: {
    marginTop: 4,
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
  },
  h2: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  listItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.ink100,
  },
  bold: { fontFamily: "Helvetica-Bold" },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.ink300,
    paddingBottom: 4,
    marginTop: 6,
  },
  th: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1.3,
    textTransform: "uppercase",
    color: COLORS.ink500,
  },
  td: {
    fontSize: 9,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.ink100,
  },
  footer: {
    marginTop: 26,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.ink300,
    fontSize: 7,
    color: COLORS.ink500,
    lineHeight: 1.4,
  },
});

export function ReportPdf({
  displayName,
  generatedAtIso,
  totals,
  dailyCompositeTrend,
  dimensionMaxes,
  weeklySummary,
  pressureStats,
  recentReps,
}: ReportPdfProps) {
  const generated = new Date(generatedAtIso);
  return (
    <Document
      title={`Cognify Progress Report — ${displayName}`}
      author="Cognify"
    >
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.kicker}>Cognify · Progress report</Text>
        <Text style={styles.h1}>{displayName}</Text>
        <Text style={styles.subtext}>
          Generated{" "}
          {generated.toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}{" "}
          · Rubric {RUBRIC_VERSION}
        </Text>

        <View style={styles.statsRow}>
          <StatCard label="Total reps" value={totals.totalReps} />
          <StatCard label="Streak" value={`${totals.streakDays}d`} />
          <StatCard
            label="Recent avg composite"
            value={totals.averageComposite}
          />
          <StatCard label="Peak composite" value={totals.peakComposite} />
        </View>

        {dailyCompositeTrend.length > 0 && (
          <View style={styles.sectionSpacer}>
            <Text style={styles.h2}>Daily composite (last 14 days)</Text>
            <Text style={styles.subtext}>
              One row per day the user trained; blanks mean no reps.
            </Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, { flex: 2 }]}>Date</Text>
              <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>
                Reps
              </Text>
              <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>
                Composite
              </Text>
            </View>
            {dailyCompositeTrend.slice(-14).map((p) => (
              <View
                key={p.date}
                style={[styles.td, { flexDirection: "row", borderBottomWidth: 1 }]}
              >
                <Text style={{ flex: 2 }}>{p.date}</Text>
                <Text style={{ flex: 1, textAlign: "right" }}>
                  {p.repCount}
                </Text>
                <Text
                  style={{ flex: 1, textAlign: "right", fontFamily: "Helvetica-Bold" }}
                >
                  {p.composite}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.sectionSpacer}>
          <Text style={styles.h2}>Per-dimension personal bests</Text>
          <Text style={styles.subtext}>
            Highest single-rep score ever recorded on each dimension.
          </Text>
          {(Object.keys(dimensionMaxes) as SkillDimension[]).map((d) => (
            <View style={styles.listItem} key={d}>
              <Text>{DIMENSION_LABELS[d]}</Text>
              <Text style={styles.bold}>{dimensionMaxes[d] ?? "—"}</Text>
            </View>
          ))}
        </View>

        {weeklySummary.repCount > 0 && (
          <View style={styles.sectionSpacer}>
            <Text style={styles.h2}>
              This week · {weeklySummary.weekStartISO} →{" "}
              {weeklySummary.weekEndISO}
            </Text>
            <Text style={styles.subtext}>
              {weeklySummary.repCount} reps · avg composite{" "}
              {weeklySummary.averageComposite}
              {weeklySummary.weakestDimension &&
                ` · weakest ${DIMENSION_LABELS[weeklySummary.weakestDimension]}`}
            </Text>
            {weeklySummary.dimensions
              .filter((d) => d.delta !== null)
              .map((d) => (
                <View style={styles.listItem} key={d.dimension}>
                  <Text>{DIMENSION_LABELS[d.dimension]}</Text>
                  <Text style={styles.bold}>
                    {d.avg ?? "—"}
                    {d.delta !== null &&
                      ` (${d.delta >= 0 ? "+" : ""}${d.delta} vs prior week)`}
                  </Text>
                </View>
              ))}
          </View>
        )}

        {pressureStats.count > 0 && (
          <View style={styles.sectionSpacer}>
            <Text style={styles.h2}>Pressure performance</Text>
            <Text style={styles.subtext}>
              {pressureStats.count} pressure reps · avg composite{" "}
              {pressureStats.avgComposite ?? "—"}
            </Text>
            {pressureStats.byArchetype.map((a) => (
              <View style={styles.listItem} key={a.archetypeName}>
                <Text>{a.archetypeName}</Text>
                <Text style={styles.bold}>
                  {a.avgComposite} · {a.count} rep{a.count === 1 ? "" : "s"}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.sectionSpacer} wrap={false}>
          <Text style={styles.h2}>Recent reps</Text>
          <Text style={styles.subtext}>
            Latest {recentReps.length}, newest first.
          </Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, { flex: 1 }]}>Date</Text>
            <Text style={[styles.th, { flex: 4 }]}>Prompt</Text>
            <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>
              Composite
            </Text>
          </View>
          {recentReps.map((r) => (
            <View
              key={r.id}
              style={[styles.td, { flexDirection: "row", borderBottomWidth: 1 }]}
            >
              <Text style={{ flex: 1 }}>
                {new Date(r.createdAt).toLocaleDateString()}
              </Text>
              <Text style={{ flex: 4 }}>{r.promptText}</Text>
              <Text
                style={{ flex: 1, textAlign: "right", fontFamily: "Helvetica-Bold" }}
              >
                {Math.round(r.compositeScore)}
              </Text>
            </View>
          ))}
        </View>

        <Text style={styles.footer}>
          Generated by Cognify · Rubric {RUBRIC_VERSION}. Trend data
          reflects the last 90 days of reps. Personal bests are all-time
          maxima. All scoring is transcript-anchored and per-rep pinned to
          the rubric version above so historical scores stay stable when
          the rubric is tuned.
        </Text>
      </Page>
    </Document>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{String(value)}</Text>
    </View>
  );
}
