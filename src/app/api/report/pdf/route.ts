import { renderToBuffer } from "@react-pdf/renderer";
import { currentUser } from "@/lib/session/current-user";
import {
  getSkillTrends,
  getCurrentSkillScores,
  getActivityHeatmap,
  getRecentReps,
  getPressureRepStats,
  getDailyCompositeTrend,
  getUserDimensionMaxes,
  getWeeklyRepSummary,
} from "@/lib/db/queries/progress";
import { getStreakStatus } from "@/lib/db/queries/streak-freeze";
import { ReportPdf } from "@/components/report/ReportPdf";

// PDF generation uses @react-pdf/renderer which requires a full Node.js
// runtime — not compatible with Edge. maxDuration bump gives headroom
// for large reports (up to ~150 rep rows across 90 days).
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const user = await currentUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const [
    _trends,
    _currentScores,
    activity,
    recentReps,
    streakStatus,
    pressureStats,
    dailyCompositeTrend,
    dimensionMaxes,
    weeklySummary,
  ] = await Promise.all([
    getSkillTrends(user.id, 90),
    getCurrentSkillScores(user.id),
    getActivityHeatmap(user.id, 90),
    getRecentReps(user.id, 20),
    getStreakStatus(user.id),
    getPressureRepStats(user.id, 90),
    getDailyCompositeTrend(user.id, 90),
    getUserDimensionMaxes(user.id),
    getWeeklyRepSummary(user.id),
  ]);
  void _trends;
  void _currentScores;

  const totalReps = activity.reduce((sum, a) => sum + a.count, 0);
  const avgComposite =
    recentReps.length > 0
      ? Math.round(
          recentReps.reduce((s, r) => s + r.compositeScore, 0) /
            recentReps.length,
        )
      : "—";
  const peakComposite =
    dailyCompositeTrend.reduce((m, p) => Math.max(m, p.composite), 0) || "—";

  const displayName = user.name || user.email || "Trainee";

  const buffer = await renderToBuffer(
    ReportPdf({
      displayName,
      generatedAtIso: new Date().toISOString(),
      totals: {
        totalReps,
        streakDays: streakStatus.streakDays,
        averageComposite: avgComposite,
        peakComposite,
      },
      dailyCompositeTrend,
      dimensionMaxes,
      weeklySummary: {
        weekStartISO: weeklySummary.weekStartISO,
        weekEndISO: weeklySummary.weekEndISO,
        repCount: weeklySummary.repCount,
        averageComposite: weeklySummary.averageComposite,
        weakestDimension: weeklySummary.weakestDimension,
        dimensions: [...weeklySummary.dimensions],
      },
      pressureStats,
      recentReps,
    }),
  );

  const filename = `cognify-report-${new Date().toISOString().slice(0, 10)}.pdf`;
  // node Buffer → ArrayBuffer so Response picks up the right length
  const body = new Uint8Array(buffer);
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
