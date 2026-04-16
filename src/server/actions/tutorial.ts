"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/session/current-user";
import { markTutorialSeen } from "@/lib/db/queries/user";

export async function markTutorialSeenAction(): Promise<
  { ok: true } | { ok: false; error: "no_user" }
> {
  const user = await currentUser();
  if (!user) return { ok: false, error: "no_user" };
  await markTutorialSeen(user.id);
  revalidatePath("/dashboard");
  revalidatePath("/tutorial");
  return { ok: true };
}
