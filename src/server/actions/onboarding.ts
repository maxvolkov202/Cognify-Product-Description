"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/session/current-user";
import {
  setUserVertical,
  setUserPersonas,
  setUserImprovementGoals,
  setUserAudioRetention,
  setUserCommunicationStage,
  markUserOnboarded,
  setUserReminderEmails,
} from "@/lib/db/queries/user";
import {
  isVerticalId,
  isPersonaId,
  isImprovementGoalId,
  isCommunicationStage,
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

/**
 * Atomic "save preferences" wrapper — wraps the three individual setters in
 * a single Promise.all so the Settings page can have one Save button. If
 * any individual write fails we surface the first error; partial success
 * is acceptable (writes are independent rows).
 */
export async function setUserPreferencesAction(input: {
  vertical: string | null;
  personas: string[];
  goals: string[];
}): Promise<ActionResult> {
  const user = await currentUser();
  if (!user) return { ok: false, error: "no_user" };

  // Validate goals up-front (must have ≥1).
  const validGoals: ImprovementGoalId[] = [];
  for (const id of input.goals) {
    if (isImprovementGoalId(id)) validGoals.push(id);
  }
  if (validGoals.length === 0) {
    return { ok: false, error: "need_at_least_one" };
  }

  const validPersonas: PersonaId[] = [];
  for (const id of input.personas) {
    if (isPersonaId(id)) validPersonas.push(id);
  }

  if (input.vertical !== null && !isVerticalId(input.vertical)) {
    return { ok: false, error: "invalid_input" };
  }

  const writes: Promise<boolean>[] = [
    setUserPersonas(user.id, validPersonas),
    setUserImprovementGoals(user.id, validGoals),
  ];
  if (input.vertical) {
    writes.unshift(setUserVertical(user.id, input.vertical));
  }
  const results = await Promise.all(writes);
  if (results.some((ok) => !ok)) {
    return { ok: false, error: "db_error" };
  }
  return { ok: true };
}

/** PRD v3 Phase 3 (PRD §8.2) — Communication Stage. Career-stage context
 *  for personalization only; never touches scoring. Stage ids live in
 *  lib/onboarding/constants.ts ("use server" files may only export
 *  async functions). */
export async function setCommunicationStageAction(
  stage: string | null,
): Promise<ActionResult> {
  if (stage !== null && !isCommunicationStage(stage)) {
    return { ok: false, error: "invalid_input" };
  }
  const user = await currentUser();
  if (!user) return { ok: false, error: "no_user" };
  const ok = await setUserCommunicationStage(user.id, stage);
  if (!ok) return { ok: false, error: "db_error" };
  return { ok: true };
}

/** PRD v3 Phase 6.8 — committed-day reminder emails toggle. */
export async function setReminderEmailsAction(
  enabled: boolean,
): Promise<ActionResult> {
  if (typeof enabled !== "boolean") return { ok: false, error: "invalid_input" };
  const user = await currentUser();
  if (!user) return { ok: false, error: "no_user" };
  const ok = await setUserReminderEmails(user.id, enabled);
  if (!ok) return { ok: false, error: "db_error" };
  return { ok: true };
}

/** Privacy → audio retention. Accepts 30 | 90 | 180 | null (= keep forever). */
export async function setAudioRetentionAction(
  days: number | null,
): Promise<ActionResult> {
  if (days !== null && !(days === 30 || days === 90 || days === 180)) {
    return { ok: false, error: "invalid_input" };
  }
  const user = await currentUser();
  if (!user) return { ok: false, error: "no_user" };
  const ok = await setUserAudioRetention(user.id, days);
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
