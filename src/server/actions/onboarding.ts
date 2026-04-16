"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/session/current-user";
import {
  setUserVertical,
  setUserPersonas,
  setUserImprovementGoals,
  markUserOnboarded,
} from "@/lib/db/queries/user";
import {
  isVerticalId,
  isPersonaId,
  isImprovementGoalId,
  type PersonaId,
  type ImprovementGoalId,
} from "@/lib/onboarding/constants";

type ActionResult =
  | { ok: true }
  | {
      ok: false;
      error:
        | "no_user"
        | "invalid_input"
        | "need_at_least_one"
        | "db_error";
    };

export async function setVerticalAction(
  verticalId: string,
): Promise<ActionResult> {
  if (!isVerticalId(verticalId)) {
    return { ok: false, error: "invalid_input" };
  }
  const user = await currentUser();
  if (!user) return { ok: false, error: "no_user" };
  const ok = await setUserVertical(user.id, verticalId);
  if (!ok) return { ok: false, error: "db_error" };
  return { ok: true };
}

export async function setPersonasAction(
  personaIds: string[],
): Promise<ActionResult> {
  const valid: PersonaId[] = [];
  for (const id of personaIds) {
    if (isPersonaId(id)) valid.push(id);
  }
  const user = await currentUser();
  if (!user) return { ok: false, error: "no_user" };
  const ok = await setUserPersonas(user.id, valid);
  if (!ok) return { ok: false, error: "db_error" };
  return { ok: true };
}

export async function setImprovementGoalsAction(
  goalIds: string[],
): Promise<ActionResult> {
  const valid: ImprovementGoalId[] = [];
  for (const id of goalIds) {
    if (isImprovementGoalId(id)) valid.push(id);
  }
  if (valid.length === 0) {
    return { ok: false, error: "need_at_least_one" };
  }
  const user = await currentUser();
  if (!user) return { ok: false, error: "no_user" };
  const ok = await setUserImprovementGoals(user.id, valid);
  if (!ok) return { ok: false, error: "db_error" };
  return { ok: true };
}

export async function completeOnboardingAction(): Promise<ActionResult> {
  const user = await currentUser();
  if (!user) return { ok: false, error: "no_user" };
  const ok = await markUserOnboarded(user.id);
  if (!ok) return { ok: false, error: "db_error" };
  // Invalidate the (app) layout cache so the onboarding gate re-reads
  // the user's onboardedAt status and lets them through.
  revalidatePath("/", "layout");
  return { ok: true };
}
