"use client";

import { useState } from "react";
import { Edit3, Check, X, Plus, Trash2, RefreshCw } from "lucide-react";
import type { TalkingPoints } from "@/lib/ai/talking-points";

type Props = {
  talkingPoints: TalkingPoints;
  onEdit: (newPoints: TalkingPoints) => void;
  onRegenerate?: () => void;
  regenerating?: boolean;
  context?: string;
};

/**
 * Editable structure sidebar for Build a Rep.
 *
 * Two modes:
 *   - Display: read-only structure, with Edit and optional Regenerate buttons
 *   - Edit: inline editable headers + bullets, add/remove bullets per section,
 *           Save/Cancel buttons
 *
 * Per the team spec: talking points must be editable inline without
 * breaking the structure. Users can tweak wording or add their own
 * bullets without rewriting everything.
 */
export function TalkingPointsSidebar({
  talkingPoints,
  onEdit,
  onRegenerate,
  regenerating = false,
  context,
}: Props) {
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<TalkingPoints>(talkingPoints);

  // Sync draft when talkingPoints prop changes externally (e.g., regenerate)
  // This is a deliberate effect-free sync via a key-style check.
  if (!editMode && draft !== talkingPoints) {
    setDraft(talkingPoints);
  }

  function startEdit() {
    setDraft(talkingPoints);
    setEditMode(true);
  }

  function cancelEdit() {
    setDraft(talkingPoints);
    setEditMode(false);
  }

  function saveEdit() {
    onEdit(draft);
    setEditMode(false);
  }

  function updateHeader(sectionIdx: number, header: string) {
    setDraft((prev) => ({
      sections: prev.sections.map((s, i) =>
        i === sectionIdx ? { ...s, header } : s,
      ),
    }));
  }

  function updateBullet(
    sectionIdx: number,
    bulletIdx: number,
    text: string,
  ) {
    setDraft((prev) => ({
      sections: prev.sections.map((s, i) =>
        i === sectionIdx
          ? {
              ...s,
              bullets: s.bullets.map((b, j) => (j === bulletIdx ? text : b)),
            }
          : s,
      ),
    }));
  }

  function addBullet(sectionIdx: number) {
    setDraft((prev) => ({
      sections: prev.sections.map((s, i) =>
        i === sectionIdx ? { ...s, bullets: [...s.bullets, ""] } : s,
      ),
    }));
  }

  function removeBullet(sectionIdx: number, bulletIdx: number) {
    setDraft((prev) => ({
      sections: prev.sections.map((s, i) =>
        i === sectionIdx
          ? { ...s, bullets: s.bullets.filter((_, j) => j !== bulletIdx) }
          : s,
      ),
    }));
  }

  const displayedSections = editMode
    ? draft.sections
    : talkingPoints.sections;

  return (
    <div className="surface-card overflow-hidden">
      <div className="brand-gradient h-1" aria-hidden="true" />
      <div className="p-5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
              Hold this structure
            </p>
            <p className="mt-0.5 text-[10px] text-ink-500">
              {displayedSections.length} sections ·{" "}
              {displayedSections.reduce((n, s) => n + s.bullets.length, 0)}{" "}
              bullets · review before you start
            </p>
          </div>
          {!editMode ? (
            <div className="flex gap-1.5">
              {onRegenerate && (
                <button
                  type="button"
                  onClick={onRegenerate}
                  disabled={regenerating}
                  className="inline-flex items-center gap-1 rounded-full border border-ink-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-ink-700 hover:border-ink-300 hover:bg-ink-50 disabled:opacity-50"
                  aria-label="Generate a different structure — unlimited, free"
                  title="Generate a different structure — unlimited, free"
                >
                  <RefreshCw
                    className={`size-3 ${regenerating ? "animate-spin" : ""}`}
                  />
                  {regenerating ? "…" : "New take"}
                </button>
              )}
              <button
                type="button"
                onClick={startEdit}
                className="inline-flex items-center gap-1 rounded-full border border-ink-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-ink-700 hover:border-ink-300 hover:bg-ink-50"
                aria-label="Edit talking points"
              >
                <Edit3 className="size-3" />
                Edit
              </button>
            </div>
          ) : (
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={cancelEdit}
                className="inline-flex items-center gap-1 rounded-full border border-ink-200 bg-white px-2 py-1 text-[10px] font-semibold text-ink-600 hover:border-ink-300"
              >
                <X className="size-3" />
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEdit}
                className="brand-gradient inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold text-white shadow-sm"
              >
                <Check className="size-3" strokeWidth={3} />
                Save
              </button>
            </div>
          )}
        </div>

        <ol className="mt-4 space-y-4">
          {displayedSections.map((section, sIdx) => (
            <li
              key={sIdx}
              className="border-l-2 border-brand-purple/30 pl-3"
            >
              {editMode ? (
                <input
                  type="text"
                  value={section.header}
                  onChange={(e) => updateHeader(sIdx, e.target.value)}
                  className="w-full rounded border border-ink-200 bg-white px-2 py-1 text-sm font-bold text-ink-900 focus:border-ink-400 focus:outline-none focus:ring-1 focus:ring-ink-900/10"
                />
              ) : (
                <p className="text-sm font-bold text-ink-900">
                  {section.header}
                </p>
              )}
              <ul className="mt-2 space-y-1.5">
                {section.bullets.map((bullet, bIdx) => (
                  <li key={bIdx} className="flex items-start gap-2">
                    <span
                      className="mt-[7px] size-1 shrink-0 rounded-full bg-ink-400"
                      aria-hidden="true"
                    />
                    {editMode ? (
                      <div className="flex flex-1 items-center gap-1">
                        <input
                          type="text"
                          value={bullet}
                          onChange={(e) =>
                            updateBullet(sIdx, bIdx, e.target.value)
                          }
                          className="flex-1 rounded border border-ink-200 bg-white px-2 py-0.5 text-xs text-ink-700 focus:border-ink-400 focus:outline-none focus:ring-1 focus:ring-ink-900/10"
                        />
                        <button
                          type="button"
                          onClick={() => removeBullet(sIdx, bIdx)}
                          className="shrink-0 text-ink-400 hover:text-red-500"
                          aria-label="Remove bullet"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    ) : (
                      <p className="flex-1 text-xs leading-relaxed text-ink-600">
                        {bullet}
                      </p>
                    )}
                  </li>
                ))}
                {editMode && (
                  <li>
                    <button
                      type="button"
                      onClick={() => addBullet(sIdx)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-purple hover:text-brand-magenta"
                    >
                      <Plus className="size-3" />
                      Add bullet
                    </button>
                  </li>
                )}
              </ul>
            </li>
          ))}
        </ol>

        {context && !editMode && (
          <div className="mt-5 border-t border-ink-200/60 pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
              Your context
            </p>
            <p className="mt-1 text-xs leading-relaxed text-ink-500">
              {context}
            </p>
          </div>
        )}

        {!editMode && (
          <p className="mt-5 text-[10px] italic text-ink-400">
            Not a script — a structure to hold in mind while you speak.
          </p>
        )}
      </div>
    </div>
  );
}
