export function dashboardMomentumCopy(
  avgRecent: number | null,
  streakDays: number,
): string {
  if (avgRecent === null) return "Pick up where you left off.";
  if (streakDays > 0) return "Your reps are warm. Keep the streak alive.";
  return "Your reps are warm. Today is a good day to start a streak.";
}
