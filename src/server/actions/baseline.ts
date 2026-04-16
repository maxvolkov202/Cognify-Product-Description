"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/session/current-user";
import { setBaselineRep } from "@/lib/db/queries/user";

export async function markBaselineRepAction(
  repId: string,
): Promise<{ ok: true } | { ok: false; error: "no_user" | "db_error" }> {
  const user = await currentUser();
  if (!user) return { ok: false, error: "no_user" };
  const ok = await setBaselineRep(user.id, repId);
  if (!ok) return { ok: false, error: "db_error" };
  revalidatePath("/dashboard");
  revalidatePath("/progress");
  return { ok: true };
}
