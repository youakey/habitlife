import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type HabitUnit = "done" | "minutes" | "hours" | "count";

type Habit = {
  id: string;
  name: string;
  unit: HabitUnit;
  target: number;
  active: boolean;
  sort?: number;
};

type NutritionGoals = {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
};

function normalizeHabit(raw: any): Habit {
  const unitRaw = raw?.unit;
  const unit: HabitUnit =
    unitRaw === "done" || unitRaw === "minutes" || unitRaw === "hours" || unitRaw === "count"
      ? unitRaw
      : "done";

  const id = raw?.id != null ? String(raw.id) : crypto.randomUUID();
  const name = raw?.name != null ? String(raw.name) : id;

  const targetNum = Number(raw?.target);
  const sortNum = Number(raw?.sort);

  return {
    id,
    name,
    unit,
    target: Number.isFinite(targetNum) && targetNum >= 0 ? targetNum : unit === "done" ? 1 : 0,
    active: raw?.active === false ? false : true,
    sort: Number.isFinite(sortNum) ? sortNum : 0,
  };
}

function sortHabits(list: any[]): Habit[] {
  return (list ?? [])
    .map(normalizeHabit)
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name));
}

function unitLabel(u: HabitUnit) {
  if (u === "done") return "Check";
  if (u === "minutes") return "Minutes";
  if (u === "hours") return "Hours";
  return "Count";
}

export default function Settings() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [nutritionEnabled, setNutritionEnabled] = useState<boolean>(true);
  const [goals, setGoals] = useState<NutritionGoals>({ kcal: 2200, protein: 140, fat: 70, carbs: 240 });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) return;

      const { data: h } = await supabase
        .from("habits")
        .select("*")
        .eq("user_id", data.user.id)
        .order("sort", { ascending: true });

      setHabits(sortHabits(h ?? []));

      const { data: s } = await supabase
        .from("settings")
        .select("nutrition_enabled, goals")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (s?.nutrition_enabled !== undefined) setNutritionEnabled(!!s.nutrition_enabled);
      if (s?.goals) setGoals(s.goals as NutritionGoals);
    })();
  }, []);

  async function saveSettings() {
    const { data } = await supabase.auth.getUser();
    if (!data?.user) return;

    await supabase.from("settings").upsert(
      { user_id: data.user.id, nutrition_enabled: nutritionEnabled, goals },
      { onConflict: "user_id" }
    );
  }

  async function saveHabits() {
    const { data } = await supabase.auth.getUser();
    if (!data?.user) return;

    const payload = habits.map((h, idx) => ({
      ...h,
      user_id: data.user.id,
      sort: idx,
    }));

    await supabase.from("habits").upsert(payload, { onConflict: "user_id,id" });
  }

  const sorted = useMemo(() => sortHabits(habits), [habits]);

  return (
    <div className="min-h-screen p-6 text-white">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 flex items-center justify-between">
          <div>
            <div className="text-2xl font-semibold">Settings</div>
            <div className="text-sm text-white/60">Manage habits & goals</div>
          </div>

          <button
            onClick={async () => {
              await saveHabits();
              await saveSettings();
            }}
            className="rounded-xl px-4 py-2 bg-white/10 hover:bg-white/15 border border-white/10"
          >
            Save
          </button>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold">Nutrition</div>
            <button
              onClick={() => setNutritionEnabled((v) => !v)}
              className={`rounded-xl px-3 py-1.5 border border-white/10 ${nutritionEnabled ? "bg-white/15" : "bg-white/5 hover:bg-white/10"}`}
            >
              {nutritionEnabled ? "Enabled" : "Disabled"}
            </button>
          </div>

          {nutritionEnabled && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(["kcal", "protein", "fat", "carbs"] as const).map((k) => (
                <div key={k} className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="text-sm text-white/70">{k}</div>
                  <input
                    value={String((goals as any)[k] ?? "")}
                    onChange={(e) => setGoals((g) => ({ ...g, [k]: Number(e.target.value || 0) }))}
                    className="mt-2 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2"
                    inputMode="numeric"
                    placeholder="0"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-lg font-semibold mb-4">Habits</div>

          <div className="space-y-3">
            {sorted.map((h, idx) => (
              <div key={h.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="flex flex-wrap gap-3 items-center justify-between">
                  <div className="min-w-[220px]">
                    <div className="font-medium">{h.name}</div>
                    <div className="text-xs text-white/60">{unitLabel(h.unit)}</div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        setHabits((prev) => {
                          const copy = [...prev];
                          copy[idx] = { ...copy[idx], active: !copy[idx].active };
                          return copy;
                        })
                      }
                      className={`rounded-xl px-3 py-1.5 border border-white/10 ${h.active ? "bg-white/15" : "bg-white/5 hover:bg-white/10"}`}
                    >
                      {h.active ? "Active" : "Hidden"}
                    </button>

                    <button
                      onClick={() =>
                        setHabits((prev) => {
                          if (idx === 0) return prev;
                          const copy = [...prev];
                          [copy[idx - 1], copy[idx]] = [copy[idx], copy[idx - 1]];
                          return copy;
                        })
                      }
                      className="rounded-xl px-3 py-1.5 border border-white/10 bg-white/5 hover:bg-white/10"
                    >
                      ↑
                    </button>

                    <button
                      onClick={() =>
                        setHabits((prev) => {
                          if (idx === prev.length - 1) return prev;
                          const copy = [...prev];
                          [copy[idx + 1], copy[idx]] = [copy[idx], copy[idx + 1]];
                          return copy;
                        })
                      }
                      className="rounded-xl px-3 py-1.5 border border-white/10 bg-white/5 hover:bg-white/10"
                    >
                      ↓
                    </button>
                  </div>
                </div>

                {h.unit !== "done" && (
                  <div className="mt-3">
                    <div className="text-xs text-white/60 mb-1">Target</div>
                    <input
                      value={String(h.target ?? 0)}
                      onChange={(e) =>
                        setHabits((prev) => {
                          const copy = [...prev];
                          copy[idx] = { ...copy[idx], target: Number(e.target.value || 0) };
                          return copy;
                        })
                      }
                      className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2"
                      inputMode="numeric"
                      placeholder="0"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4">
            <button
              onClick={saveHabits}
              className="rounded-xl px-4 py-2 bg-white/10 hover:bg-white/15 border border-white/10"
            >
              Save habits order
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
