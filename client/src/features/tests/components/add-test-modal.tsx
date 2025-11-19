import { useCallback, useEffect, useMemo, useState } from "react";
import { Library, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/cn";

import type {
  CreateTestPayload,
  TestDifficultyDistribution,
  TestDifficultyKey,
  TestEntryAllocation,
  TestLibraryEntry,
  TestQuestionOrderItem,
} from "../types";
import { LibrarySelectorModal } from "./library-selector-modal.tsx";

type ControlMode = "percentage" | "count";

interface TestBuilderEntry extends TestEntryAllocation {
  controlMode: ControlMode;
  lockedDifficulties: TestDifficultyKey[];
}

interface AddTestModalProps {
  open: boolean;
  onClose: () => void;
  onCreate?: (payload: CreateTestPayload) => void;
}

const DEFAULT_TOTAL_QUESTIONS = 20;
const DEFAULT_TITLE = "Untitled test";
const DEFAULT_DIFFICULTY: TestDifficultyDistribution = { easy: 34, medium: 33, hard: 33 };
const DIFFICULTY_KEYS: TestDifficultyKey[] = ["hard", "medium", "easy"];

export function AddTestModal({ open, onClose, onCreate }: AddTestModalProps) {
  const [entries, setEntries] = useState<TestBuilderEntry[]>([]);
  const [totalQuestions, setTotalQuestions] = useState<number>(DEFAULT_TOTAL_QUESTIONS);
  const [isLibraryOpen, setLibraryOpen] = useState(false);
  const [draftInputs, setDraftInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) {
      setLibraryOpen(false);
      setDraftInputs((prev) => (Object.keys(prev).length ? {} : prev));
    }
  }, [open]);

  const getDisplayValue = useCallback(
    (key: string, fallback: number) => {
      const draft = draftInputs[key];
      return draft !== undefined ? draft : fallback.toString();
    },
    [draftInputs]
  );

  const handleNumberFieldChange = useCallback(
    (key: string, raw: string, apply: (value: number) => void) => {
      setDraftInputs((prev) => {
        const current = prev[key];
        if (current === raw) {
          return prev;
        }
        return { ...prev, [key]: raw };
      });

      const numeric = raw === "" ? 0 : Number(raw);
      apply(Number.isNaN(numeric) ? 0 : numeric);
    },
    [setDraftInputs]
  );

  const clearDraftValue = useCallback(
    (key: string) => {
      setDraftInputs((prev) => {
        if (prev[key] === undefined) {
          return prev;
        }
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    [setDraftInputs]
  );

  const selectedEntriesForModal = useMemo<TestLibraryEntry[]>(
    () =>
      entries.map((entry) => ({
        id: entry.id,
        type: entry.type,
        name: entry.name,
        bookId: entry.bookId,
        chapterId: entry.chapterId,
        subchapterId: entry.subchapterId,
      })),
    [entries]
  );

  const questionOrder = useMemo<TestQuestionOrderItem[]>(
    () => buildQuestionOrder(entries),
    [entries]
  );

  const handleLibraryApply = useCallback(
    (selection: TestLibraryEntry[]) => {
      setEntries((prev) => {
        if (!selection.length) {
          return [];
        }

        const previousById = new Map(prev.map((entry) => [entry.id, entry]));
        const defaults = distributeEvenly(selection.length);

        const next: TestBuilderEntry[] = selection.map((item, index) => {
          const existing = previousById.get(item.id);
          if (existing) {
            return {
              ...existing,
              ...item,
              difficulty: { ...existing.difficulty },
              lockedDifficulties: [...(existing.lockedDifficulties ?? [])],
            };
          }

          return {
            ...item,
            questionCount: 0,
            questionPercentage: defaults[index] ?? Math.floor(100 / selection.length),
            difficulty: cloneDifficulty(DEFAULT_DIFFICULTY),
            controlMode: "percentage",
            lockedDifficulties: [],
          };
        });

        const normalized = normalizePercentages(next);
        return recalcCountsFromPercentages(normalized, totalQuestions);
      });

      setDraftInputs((prev) => {
        if (!selection.length) {
          const next: Record<string, string> = {};
          if (prev["total-questions"] !== undefined) {
            next["total-questions"] = prev["total-questions"];
          }
          return Object.keys(next).length === Object.keys(prev).length ? prev : next;
        }

        const activeIds = new Set(selection.map((item) => item.id));
        let mutated = false;
        const next: Record<string, string> = {};

        Object.entries(prev).forEach(([key, value]) => {
          if (key === "total-questions") {
            next[key] = value;
            return;
          }
          const [entryId] = key.split(":");
          if (activeIds.has(entryId)) {
            next[key] = value;
          } else {
            mutated = true;
          }
        });

        if (!mutated && Object.keys(prev).length === Object.keys(next).length) {
          return prev;
        }

        return next;
      });
    },
    [setDraftInputs, totalQuestions]
  );

  const handlePercentageChange = useCallback(
    (entryId: string, value: number) => {
      setEntries((prev) => {
        if (!prev.length) return prev;
        const next = cloneEntryList(prev);
        const target = next.find((entry) => entry.id === entryId);
        if (!target) return prev;

        const clamped = clampInt(value, 0, 100);
        target.controlMode = "percentage";
        target.questionPercentage = clamped;

        const others = next.filter((entry) => entry.id !== entryId);
        redistributePercentages(target, others);
        const normalized = normalizePercentages(next);
        const withCounts = recalcCountsFromPercentages(normalized, totalQuestions);
        return withCounts;
      });
    },
    [totalQuestions]
  );

  const handleCountChange = useCallback((entryId: string, value: number) => {
    setEntries((prev) => {
      if (!prev.length) return prev;
      const next = cloneEntryList(prev);
      const target = next.find((entry) => entry.id === entryId);
      if (!target) return prev;

      target.controlMode = "count";
      target.questionCount = clampInt(value, 0, Number.MAX_SAFE_INTEGER);

      const newTotal = next.reduce((sum, entry) => sum + entry.questionCount, 0);
      setTotalQuestions(newTotal);

      if (newTotal <= 0) {
        next.forEach((entry) => {
          entry.questionPercentage = 0;
        });
        return next;
      }

      return recalcPercentagesFromCounts(next, newTotal);
    });
  }, []);

  const handleTotalQuestionsChange = useCallback(
    (value: number) => {
      const nextTotal = clampInt(value, 0, Number.MAX_SAFE_INTEGER);
      setTotalQuestions(nextTotal);
      if (nextTotal <= 0) {
        setEntries((prev) => prev.map((entry) => ({ ...entry, questionCount: 0 })));
        return;
      }

      setEntries((prev) => {
        if (!prev.length) return prev;
        const next = cloneEntryList(prev);
        return recalcCountsFromPercentages(next, nextTotal);
      });
    },
    []
  );

  const handleControlModeChange = useCallback((entryId: string, mode: ControlMode) => {
    setDraftInputs((prev) => {
      const removalKey = mode === "percentage" ? `${entryId}:count` : `${entryId}:percentage`;
      if (prev[removalKey] === undefined) {
        return prev;
      }
      const next = { ...prev };
      delete next[removalKey];
      return next;
    });

    setEntries((prev) =>
      prev.map((entry) =>
        entry.id === entryId
          ? {
              ...entry,
              controlMode: mode,
            }
          : entry
      )
    );
  }, [setDraftInputs]);

  const handleDifficultyChange = useCallback(
    (entryId: string, key: TestDifficultyKey, value: number) => {
      setEntries((prev) => {
        const next = cloneEntryList(prev);
        const target = next.find((entry) => entry.id === entryId);
        if (!target) return prev;

        const clamped = clampInt(value, 0, 100);
        redistributeDifficulty(target.difficulty, key, clamped, target.lockedDifficulties);
        enforceLockedDifficulty(target);
        return next;
      });
    },
    []
  );

  const handleDifficultyLockToggle = useCallback(
    (entryId: string, key: TestDifficultyKey) => {
      let didUpdate = false;

      setEntries((prev) => {
        const next = cloneEntryList(prev);
        const target = next.find((entry) => entry.id === entryId);
        if (!target) return prev;

        const isLocked = target.lockedDifficulties.includes(key);

        if (isLocked) {
          target.lockedDifficulties = target.lockedDifficulties.filter((locked) => locked !== key);
          enforceLockedDifficulty(target);
          didUpdate = true;
          return next;
        }

        if (target.lockedDifficulties.length >= 2) {
          return prev;
        }

        target.lockedDifficulties = [...target.lockedDifficulties, key];
        enforceLockedDifficulty(target);
        didUpdate = true;
        return next;
      });

      if (didUpdate) {
        setDraftInputs((prev) => {
          const fieldKey = `${entryId}:difficulty-${key}`;
          if (prev[fieldKey] === undefined) {
            return prev;
          }
          const next = { ...prev };
          delete next[fieldKey];
          return next;
        });
      }
    },
    [setDraftInputs]
  );

  const handleCreateTest = useCallback(() => {
    if (!entries.length || totalQuestions <= 0) return;
    const payload = buildTestPayload(entries, totalQuestions);
    onCreate?.(payload);
  }, [entries, onCreate, totalQuestions]);

  const disableCreate = entries.length === 0 || totalQuestions <= 0;

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Draft a new test"
        description="Assemble books, chapters, or subchapters and balance how questions are distributed."
        className="max-w-5xl"
      >
        <div className="flex flex-col gap-6">
          <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            <div className="space-y-4">
              <section className="rounded-xl border border-slate-800/70 bg-slate-950/50 p-3">
                <header className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-white">Included material</h3>
                    <p className="text-xs text-slate-400">
                      Entries inherit their position based on your library ordering.
                    </p>
                  </div>
                  <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-400">
                    {entries.length} selected
                  </span>
                </header>

                {entries.length === 0 ? (
                  <div className="mt-6 rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-6 text-center text-sm text-slate-400">
                    Choose content from your library to start configuring a test.
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {entries.map((entry) => {
                      const percentageKey = `${entry.id}:percentage`;
                      const countKey = `${entry.id}:count`;
                      const lockedKeys = entry.lockedDifficulties;
                      const lockLimitReached = lockedKeys.length >= 2;

                      return (
                        <div
                          key={entry.id}
                          className="rounded-lg border border-slate-800/60 bg-slate-900/30 p-3"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="space-y-1">
                              <p className="text-sm font-semibold text-white">{entry.name}</p>
                              <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide text-slate-500">
                                <span className="capitalize">{entry.type}</span>
                                <span className="h-3 w-px bg-slate-800/70" />
                                <span className="text-slate-300">{entry.questionCount} questions</span>
                                <span className="h-3 w-px bg-slate-800/70" />
                                <span className="text-slate-300">{entry.questionPercentage}% share</span>
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-wide text-slate-500">
                            <div className="flex items-center gap-2">
                              <span>Mode</span>
                              <div className="inline-flex overflow-hidden rounded-md border border-slate-800 bg-slate-950/70">
                                <button
                                  type="button"
                                  onClick={() => handleControlModeChange(entry.id, "percentage")}
                                  className={cn(
                                    "px-2 py-1 text-[11px] font-medium transition",
                                    entry.controlMode === "percentage"
                                      ? "bg-brand/20 text-brand"
                                      : "text-slate-400 hover:text-slate-300"
                                  )}
                                >
                                  By %
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleControlModeChange(entry.id, "count")}
                                  className={cn(
                                    "px-2 py-1 text-[11px] font-medium transition",
                                    entry.controlMode === "count"
                                      ? "bg-brand/20 text-brand"
                                      : "text-slate-400 hover:text-slate-300"
                                  )}
                                >
                                  By count
                                </button>
                              </div>
                            </div>
                            <span className="hidden h-5 w-px bg-slate-800/70 sm:block" />
                            <label className="flex items-center gap-2 text-slate-400">
                              <span>% share</span>
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                value={getDisplayValue(percentageKey, entry.questionPercentage)}
                                inputMode="numeric"
                                pattern="[0-9]*"
                                disabled={entry.controlMode !== "percentage"}
                                onChange={(event) =>
                                  handleNumberFieldChange(percentageKey, event.currentTarget.value, (val) =>
                                    handlePercentageChange(entry.id, val)
                                  )
                                }
                                onBlur={() => clearDraftValue(percentageKey)}
                                className="h-8 w-20 text-right text-sm"
                              />
                            </label>
                            <label className="flex items-center gap-2 text-slate-400">
                              <span>Questions</span>
                              <Input
                                type="number"
                                min={0}
                                value={getDisplayValue(countKey, entry.questionCount)}
                                inputMode="numeric"
                                pattern="[0-9]*"
                                disabled={entry.controlMode !== "count"}
                                onChange={(event) =>
                                  handleNumberFieldChange(countKey, event.currentTarget.value, (val) =>
                                    handleCountChange(entry.id, val)
                                  )
                                }
                                onBlur={() => clearDraftValue(countKey)}
                                className="h-8 w-24 text-right text-sm"
                              />
                            </label>
                          </div>

                          <DifficultyEditor
                            entryId={entry.id}
                            distribution={entry.difficulty}
                            getValue={getDisplayValue}
                            onFieldChange={handleNumberFieldChange}
                            onFieldBlur={clearDraftValue}
                            onDifficultyChange={handleDifficultyChange}
                            lockedKeys={lockedKeys}
                            lockLimitReached={lockLimitReached}
                            onToggleLock={handleDifficultyLockToggle}
                            questionCount={entry.questionCount}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            <aside className="rounded-2xl border border-slate-800/70 bg-slate-950/60 p-4">
              <header className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">Preview order</h3>
                  <p className="text-xs text-slate-400">
                    Draft sequence is generated from your current allocation.
                  </p>
                </div>
                <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-400">
                  {questionOrder.length} questions
                </span>
              </header>

              {questionOrder.length === 0 ? (
                <p className="mt-6 text-sm text-slate-400">
                  Add material to preview how the questions may be delivered.
                </p>
              ) : (
                <div className="mt-4 min-h-[20rem] max-h-[28rem] space-y-2 overflow-y-auto pr-1">
                  {questionOrder.map((item) => {
                    const displayName = truncateLabel(item.entryName);
                    return (
                      <div
                        key={`${item.questionNumber}-${item.entryId}-${item.difficulty}`}
                        className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-900/60 px-3 py-2 text-sm"
                      >
                        <span className="text-slate-100">Question {item.questionNumber}</span>
                        <span className="text-xs text-slate-400">
                          {displayName} • {formatDifficultyLabel(item.difficulty)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </aside>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-slate-800/70 bg-slate-950/70 p-4 md:flex-row md:items-center md:justify-between">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              leftIcon={<Library className="h-4 w-4" />}
              onClick={() => setLibraryOpen(true)}
            >
              Add from library
            </Button>

            <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
              <Label htmlFor="total-questions" className="text-xs uppercase text-slate-400">
                Number of questions
              </Label>
              <Input
                id="total-questions"
                type="number"
                min={0}
                value={getDisplayValue("total-questions", totalQuestions)}
                inputMode="numeric"
                pattern="[0-9]*"
                onChange={(event) =>
                  handleNumberFieldChange(
                    "total-questions",
                    event.currentTarget.value,
                    handleTotalQuestionsChange
                  )
                }
                onBlur={() => clearDraftValue("total-questions")}
                className="w-36"
              />
            </div>

            <Button
              type="button"
              size="sm"
              leftIcon={<Plus className="h-4 w-4" />}
              disabled={disableCreate}
              onClick={handleCreateTest}
            >
              Create test
            </Button>
          </div>
        </div>
      </Modal>

      <LibrarySelectorModal
        open={isLibraryOpen}
        onClose={() => setLibraryOpen(false)}
        selectedEntries={selectedEntriesForModal}
        onApply={handleLibraryApply}
      />
    </>
  );
}

interface DifficultyEditorProps {
  entryId: string;
  distribution: TestDifficultyDistribution;
  questionCount: number;
  getValue: (fieldKey: string, fallback: number) => string;
  onFieldChange: (fieldKey: string, raw: string, apply: (value: number) => void) => void;
  onFieldBlur: (fieldKey: string) => void;
  onDifficultyChange: (entryId: string, key: TestDifficultyKey, value: number) => void;
  lockedKeys: TestDifficultyKey[];
  lockLimitReached: boolean;
  onToggleLock: (entryId: string, key: TestDifficultyKey) => void;
}

function DifficultyEditor({
  entryId,
  distribution,
  questionCount,
  getValue,
  onFieldChange,
  onFieldBlur,
  onDifficultyChange,
  lockedKeys,
  lockLimitReached,
  onToggleLock,
}: DifficultyEditorProps) {
  const questionShares = allocateByPercentage(questionCount, [
    distribution.hard,
    distribution.medium,
    distribution.easy,
  ]);

  return (
    <div className="mt-3 rounded-lg border border-slate-800/60 bg-slate-950/60 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Difficulty distribution</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {DIFFICULTY_KEYS.map((key) => {
          const fieldKey = `${entryId}:difficulty-${key}`;
          const isLocked = lockedKeys.includes(key);
          const difficultyIndex = DIFFICULTY_KEYS.indexOf(key);
          const questionShare = questionShares[difficultyIndex] ?? 0;

          return (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between text-[11px] uppercase tracking-wide">
                <span className="text-slate-300">{formatDifficultyLabel(key)}</span>
                <span className="text-slate-500">{questionShare} q</span>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={getValue(fieldKey, distribution[key])}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  data-locked={isLocked || undefined}
                  onChange={(event) =>
                    onFieldChange(fieldKey, event.currentTarget.value, (val) =>
                      onDifficultyChange(entryId, key, val)
                    )
                  }
                  onBlur={() => onFieldBlur(fieldKey)}
                  className={cn(
                    "h-8 w-full text-right text-sm",
                    isLocked && "border-slate-700 bg-slate-900/70 focus-visible:ring-0"
                  )}
                />
                <label className="flex items-center gap-1 text-[11px] uppercase text-slate-400">
                  <input
                    type="checkbox"
                    checked={isLocked}
                    disabled={!isLocked && lockLimitReached}
                    onChange={() => {
                      if (!isLocked && lockLimitReached) {
                        return;
                      }
                      onToggleLock(entryId, key);
                    }}
                    className="h-3.5 w-3.5 rounded border border-slate-600 bg-slate-900 text-brand focus:outline-none"
                  />
                  Lock
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function buildTestPayload(entries: TestBuilderEntry[], totalQuestions: number): CreateTestPayload {
  const sanitizedEntries: TestEntryAllocation[] = entries.map((entry) => ({
    id: entry.id,
    type: entry.type,
    name: entry.name,
    bookId: entry.bookId,
    chapterId: entry.chapterId,
    subchapterId: entry.subchapterId,
    questionCount: entry.questionCount,
    questionPercentage: entry.questionPercentage,
    difficulty: { ...entry.difficulty },
  }));

  return {
    title: DEFAULT_TITLE,
    totalQuestions,
    entries: sanitizedEntries,
    questionOrder: buildQuestionOrder(entries),
  };
}

function buildQuestionOrder(entries: TestBuilderEntry[]): TestQuestionOrderItem[] {
  const order: TestQuestionOrderItem[] = [];
  let counter = 1;

  entries.forEach((entry) => {
    const difficulties = expandDifficultySequence(entry.questionCount, entry.difficulty);
    difficulties.forEach((difficulty) => {
      order.push({
        questionNumber: counter,
        entryId: entry.id,
        entryName: entry.name,
        difficulty,
      });
      counter += 1;
    });
  });

  return order;
}

function expandDifficultySequence(
  total: number,
  distribution: TestDifficultyDistribution
): TestDifficultyKey[] {
  if (total <= 0) return [];

  const counts = allocateByPercentage(total, [distribution.hard, distribution.medium, distribution.easy]);
  const sequence: TestDifficultyKey[] = [];

  counts.forEach((count, index) => {
    const key = DIFFICULTY_KEYS[index];
    for (let i = 0; i < count; i += 1) {
      sequence.push(key);
    }
  });

  return sequence;
}

function allocateByPercentage(total: number, percentages: number[]): number[] {
  if (total <= 0 || !percentages.length) {
    return percentages.map(() => 0);
  }

  const raw = percentages.map((percent) => (percent / 100) * total);
  const rounded = raw.map((value) => Math.round(value));
  let diff = total - rounded.reduce((sum, value) => sum + value, 0);

  if (diff === 0) {
    return rounded;
  }

  const indexed = raw.map((value, index) => ({ index, fraction: value - Math.floor(value) }));

  if (diff > 0) {
    indexed.sort((a, b) => b.fraction - a.fraction);
    let cursor = 0;
    while (diff > 0 && indexed.length) {
      const target = indexed[cursor % indexed.length];
      rounded[target.index] += 1;
      diff -= 1;
      cursor += 1;
    }
  } else {
    indexed.sort((a, b) => a.fraction - b.fraction);
    let cursor = 0;
    while (diff < 0 && indexed.length) {
      const target = indexed[cursor % indexed.length];
      if (rounded[target.index] > 0) {
        rounded[target.index] -= 1;
        diff += 1;
      }
      cursor += 1;
    }
  }

  return rounded;
}

// Rebalances other entries so the percentage sum remains 100 after editing one entry.
function redistributePercentages(target: TestBuilderEntry, others: TestBuilderEntry[]): void {
  const remaining = clampInt(100 - target.questionPercentage, 0, 100);
  if (!others.length) {
    target.questionPercentage = remaining === 100 ? 100 : target.questionPercentage;
    return;
  }

  if (remaining <= 0) {
    others.forEach((entry) => {
      entry.questionPercentage = 0;
    });
    return;
  }

  const sumOthers = others.reduce((sum, entry) => sum + entry.questionPercentage, 0);

  if (sumOthers <= 0) {
    const share = distributeEvenly(others.length, remaining);
    others.forEach((entry, index) => {
      entry.questionPercentage = share[index] ?? 0;
    });
    return;
  }

  let allocated = 0;
  others.forEach((entry, index) => {
    if (index === others.length - 1) {
      entry.questionPercentage = clampInt(remaining - allocated, 0, 100);
    } else {
      const scaled = Math.round((entry.questionPercentage / sumOthers) * remaining);
      entry.questionPercentage = clampInt(scaled, 0, 100);
      allocated += entry.questionPercentage;
    }
  });

  const diff = remaining - others.reduce((sum, entry) => sum + entry.questionPercentage, 0);
  if (diff !== 0) {
    const last = others[others.length - 1];
    last.questionPercentage = clampInt(last.questionPercentage + diff, 0, 100);
  }
}

function normalizePercentages(entries: TestBuilderEntry[]): TestBuilderEntry[] {
  const total = entries.reduce((sum, entry) => sum + entry.questionPercentage, 0);
  if (entries.length === 0) return entries;

  if (total === 100) {
    return entries;
  }

  if (total === 0) {
    const even = distributeEvenly(entries.length, 100);
    return entries.map((entry, index) => ({
      ...entry,
      questionPercentage: even[index] ?? 0,
    }));
  }

  const scaled = entries.map((entry) => ({
    entry,
    raw: (entry.questionPercentage / total) * 100,
  }));

  const rounded = scaled.map(({ entry, raw }) => ({
    entry,
    value: Math.round(raw),
    fraction: raw - Math.floor(raw),
  }));

  const sum = rounded.reduce((acc, item) => acc + item.value, 0);
  const result = rounded.map(({ entry, value }) => ({
    ...entry,
    questionPercentage: clampInt(value, 0, 100),
  }));

  if (sum === 100) {
    return result;
  }

  const adjustList = rounded.map((item, index) => ({
    index,
    fraction: item.fraction,
  }));

  if (sum < 100) {
    adjustList.sort((a, b) => b.fraction - a.fraction);
    let diff = 100 - sum;
    let cursor = 0;
    while (diff > 0 && adjustList.length) {
      const target = adjustList[cursor % adjustList.length];
      result[target.index] = {
        ...result[target.index],
        questionPercentage: clampInt(result[target.index].questionPercentage + 1, 0, 100),
      };
      diff -= 1;
      cursor += 1;
    }
  } else {
    adjustList.sort((a, b) => a.fraction - b.fraction);
    let diff = sum - 100;
    let cursor = 0;
    while (diff > 0 && adjustList.length) {
      const target = adjustList[cursor % adjustList.length];
      const current = result[target.index];
      if (current.questionPercentage > 0) {
        result[target.index] = {
          ...current,
          questionPercentage: clampInt(current.questionPercentage - 1, 0, 100),
        };
        diff -= 1;
      }
      cursor += 1;
    }
  }

  return result;
}

// Converts percentage allocations to discrete question counts while matching the total.
function recalcCountsFromPercentages(
  entries: TestBuilderEntry[],
  totalQuestions: number
): TestBuilderEntry[] {
  if (entries.length === 0) return entries;
  if (totalQuestions <= 0) {
    return entries.map((entry) => ({
      ...entry,
      questionCount: 0,
    }));
  }

  const raw = entries.map((entry) => ({
    raw: (entry.questionPercentage / 100) * totalQuestions,
  }));

  const rounded = raw.map((item) => Math.round(item.raw));
  const sum = rounded.reduce((acc, value) => acc + value, 0);

  const result = entries.map((entry, index) => ({
    ...entry,
    questionCount: rounded[index],
  }));

  if (sum === totalQuestions) {
    return result;
  }

  const fractional = raw.map((item, index) => ({
    index,
    fraction: item.raw - Math.floor(item.raw),
  }));

  if (sum < totalQuestions) {
    fractional.sort((a, b) => b.fraction - a.fraction);
    let diff = totalQuestions - sum;
    let cursor = 0;
    while (diff > 0 && fractional.length) {
      const target = fractional[cursor % fractional.length];
      result[target.index] = {
        ...result[target.index],
        questionCount: result[target.index].questionCount + 1,
      };
      diff -= 1;
      cursor += 1;
    }
  } else {
    fractional.sort((a, b) => a.fraction - b.fraction);
    let diff = sum - totalQuestions;
    let cursor = 0;
    while (diff > 0 && fractional.length) {
      const target = fractional[cursor % fractional.length];
      if (result[target.index].questionCount > 0) {
        result[target.index] = {
          ...result[target.index],
          questionCount: result[target.index].questionCount - 1,
        };
        diff -= 1;
      }
      cursor += 1;
    }
  }

  return result;
}

// Derives percentage values from explicit question counts for each entry.
function recalcPercentagesFromCounts(
  entries: TestBuilderEntry[],
  totalQuestions: number
): TestBuilderEntry[] {
  if (entries.length === 0 || totalQuestions <= 0) {
    return entries.map((entry) => ({ ...entry, questionPercentage: 0 }));
  }

  const raw = entries.map((entry) => ({
    raw: (entry.questionCount / totalQuestions) * 100,
  }));

  const rounded = raw.map((item) => Math.round(item.raw));
  const sum = rounded.reduce((acc, value) => acc + value, 0);

  const result = entries.map((entry, index) => ({
    ...entry,
    questionPercentage: clampInt(rounded[index], 0, 100),
  }));

  if (sum === 100) {
    return result;
  }

  const fractional = raw.map((item, index) => ({
    index,
    fraction: item.raw - Math.floor(item.raw),
  }));

  if (sum < 100) {
    fractional.sort((a, b) => b.fraction - a.fraction);
    let diff = 100 - sum;
    let cursor = 0;
    while (diff > 0 && fractional.length) {
      const target = fractional[cursor % fractional.length];
      result[target.index] = {
        ...result[target.index],
        questionPercentage: clampInt(result[target.index].questionPercentage + 1, 0, 100),
      };
      diff -= 1;
      cursor += 1;
    }
  } else {
    fractional.sort((a, b) => a.fraction - b.fraction);
    let diff = sum - 100;
    let cursor = 0;
    while (diff > 0 && fractional.length) {
      const target = fractional[cursor % fractional.length];
      if (result[target.index].questionPercentage > 0) {
        result[target.index] = {
          ...result[target.index],
          questionPercentage: clampInt(result[target.index].questionPercentage - 1, 0, 100),
        };
        diff -= 1;
      }
      cursor += 1;
    }
  }

  return result;
}

// Keeps difficulty shares within 0-100 while reacting to a single-field change.
function redistributeDifficulty(
  distribution: TestDifficultyDistribution,
  changedKey: TestDifficultyKey,
  value: number,
  lockedKeys: TestDifficultyKey[]
) {
  const lockedSet = new Set<TestDifficultyKey>(lockedKeys);
  const lockedSumExcludingChanged = DIFFICULTY_KEYS.reduce((sum, key) => {
    if (key === changedKey || !lockedSet.has(key)) {
      return sum;
    }
    return sum + distribution[key];
  }, 0);

  const maxForChanged = Math.max(0, 100 - lockedSumExcludingChanged);
  const clampedValue = clampInt(value, 0, maxForChanged);
  distribution[changedKey] = clampedValue;

  const adjustableKeys = DIFFICULTY_KEYS.filter(
    (key) => key !== changedKey && !lockedSet.has(key)
  );

  if (!adjustableKeys.length) {
    const total = lockedSumExcludingChanged + distribution[changedKey];
    const diff = 100 - total;
    if (lockedSet.has(changedKey)) {
      distribution[changedKey] = clampInt(distribution[changedKey] + diff, 0, 100);
    } else if (lockedSet.size) {
      const adjustKey = lockedKeys.find((key) => key !== changedKey) ?? changedKey;
      distribution[adjustKey] = clampInt(distribution[adjustKey] + diff, 0, 100);
    } else {
      distribution[changedKey] = clampInt(distribution[changedKey] + diff, 0, 100);
    }
    return;
  }

  let remaining = 100 - lockedSumExcludingChanged - distribution[changedKey];
  remaining = clampInt(remaining, 0, 100);

  if (remaining === 0) {
    adjustableKeys.forEach((key) => {
      distribution[key] = 0;
    });
    return;
  }

  const currentSum = adjustableKeys.reduce((sum, key) => sum + distribution[key], 0);

  if (currentSum <= 0) {
    const share = distributeEvenly(adjustableKeys.length, remaining);
    adjustableKeys.forEach((key, index) => {
      distribution[key] = share[index] ?? 0;
    });
    return;
  }

  let allocated = 0;
  adjustableKeys.forEach((key, index) => {
    if (index === adjustableKeys.length - 1) {
      distribution[key] = clampInt(remaining - allocated, 0, 100);
    } else {
      const scaled = Math.round((distribution[key] / currentSum) * remaining);
      distribution[key] = clampInt(scaled, 0, 100);
      allocated += distribution[key];
    }
  });

  const diff = remaining - adjustableKeys.reduce((sum, key) => sum + distribution[key], 0);
  if (diff !== 0) {
    const adjustKey = adjustableKeys[adjustableKeys.length - 1];
    distribution[adjustKey] = clampInt(distribution[adjustKey] + diff, 0, 100);
  }
}

function enforceLockedDifficulty(entry: TestBuilderEntry): void {
  const lockedSet = new Set(entry.lockedDifficulties);
  const lockedSum = entry.lockedDifficulties.reduce(
    (sum, key) => sum + entry.difficulty[key],
    0
  );

  const adjustableKeys = DIFFICULTY_KEYS.filter((key) => !lockedSet.has(key));
  const remaining = clampInt(100 - lockedSum, 0, 100);

  if (!adjustableKeys.length) {
    if (lockedSet.size) {
      const adjustKey = entry.lockedDifficulties[entry.lockedDifficulties.length - 1];
      entry.difficulty[adjustKey] = clampInt(entry.difficulty[adjustKey] + (100 - lockedSum), 0, 100);
    }
    return;
  }

  if (remaining === 0) {
    adjustableKeys.forEach((key) => {
      entry.difficulty[key] = 0;
    });
    if (lockedSet.size) {
      const adjustKey = entry.lockedDifficulties[entry.lockedDifficulties.length - 1];
      entry.difficulty[adjustKey] = clampInt(entry.difficulty[adjustKey] + (100 - lockedSum), 0, 100);
    }
    return;
  }

  const currentSum = adjustableKeys.reduce((sum, key) => sum + entry.difficulty[key], 0);

  if (currentSum <= 0) {
    const share = distributeEvenly(adjustableKeys.length, remaining);
    adjustableKeys.forEach((key, index) => {
      entry.difficulty[key] = share[index] ?? 0;
    });
    return;
  }

  let allocated = 0;
  adjustableKeys.forEach((key, index) => {
    if (index === adjustableKeys.length - 1) {
      entry.difficulty[key] = clampInt(remaining - allocated, 0, 100);
    } else {
      const scaled = Math.round((entry.difficulty[key] / currentSum) * remaining);
      entry.difficulty[key] = clampInt(scaled, 0, 100);
      allocated += entry.difficulty[key];
    }
  });

  const diff = remaining - adjustableKeys.reduce((sum, key) => sum + entry.difficulty[key], 0);
  if (diff !== 0) {
    const adjustKey = adjustableKeys[adjustableKeys.length - 1];
    entry.difficulty[adjustKey] = clampInt(entry.difficulty[adjustKey] + diff, 0, 100);
  }

  const total = DIFFICULTY_KEYS.reduce((sum, key) => sum + entry.difficulty[key], 0);
  if (total !== 100) {
    const fallbackKeys = adjustableKeys.length
      ? adjustableKeys
      : entry.lockedDifficulties.length
        ? [entry.lockedDifficulties[entry.lockedDifficulties.length - 1]]
        : DIFFICULTY_KEYS;
    const adjustKey = fallbackKeys[fallbackKeys.length - 1];
    entry.difficulty[adjustKey] = clampInt(entry.difficulty[adjustKey] + (100 - total), 0, 100);
  }
}

function distributeEvenly(count: number, total = 100): number[] {
  if (count <= 0) return [];
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

function clampInt(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(Math.round(value), min), max);
}

function cloneDifficulty(difficulty: TestDifficultyDistribution): TestDifficultyDistribution {
  return {
    easy: difficulty.easy,
    medium: difficulty.medium,
    hard: difficulty.hard,
  };
}

function cloneEntryList(entries: TestBuilderEntry[]): TestBuilderEntry[] {
  return entries.map((entry) => ({
    ...entry,
    difficulty: cloneDifficulty(entry.difficulty),
    lockedDifficulties: [...entry.lockedDifficulties],
  }));
}

function truncateLabel(value: string, limit = 20): string {
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, limit).trimEnd()}...`;
}

function formatDifficultyLabel(value: TestDifficultyKey): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
