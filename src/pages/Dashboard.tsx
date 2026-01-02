import React, { useEffect, useMemo, useRef, useState } from "react";
import { Chart, registerables } from "chart.js";
import { supabase } from "../lib/supabase";

Chart.register(...registerables);

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

type DayEntry = {
  date: string; // YYYY-MM-DD
  user_id: string;
  habits: Record<string, any>;
  nutrition: { kcal: number; protein: number; fat: number; carbs: number };
  notes?: { gratitude?: string; improve?: string };
};

function safeLower(v: unknown): string {
  return (typeof v === "string" ? v : v == null ? "" : String(v)).toLowerCase();
}

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

function fmtISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function Dashboard() {
  const [userEmail, setUserEmail] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(fmtISO(new Date()));
  const [habits, setHabits] = useState<Habit[]>([]);
  const [entry, setEntry] = useState<DayEntry | null>(null);
  const [rangeDays, setRangeDays] = useState<7 | 30 | 365>(7);

  const [nutritionEnabled, setNutritionEnabled] = useState<boolean>(true);
  const [goals, setGoals] = useState<NutritionGoals>({
    kcal: 2200,
    protein: 140,
    fat: 70,
    carbs: 240,
  });

  const sleepChartRef = useRef<HTMLCanvasElement | null>(null);
  const scoreChartRef = useRef<HTMLCanvasElement | null>(null);
  const detailChartRef = useRef<HTMLCanvasElement | null>(null);
  const kcalChartRef = useRef<HTMLCanvasElement | null>(null);

  const charts = useRef<Record<string, Chart | null>>({});

  function destroyCharts() {
    // destroy charts we track
    Object.values(charts.current).forEach((c) => {
      try {
        c?.destroy();
      } catch {}
    });
    charts.current = {};

    // safety: also destroy any chart still bound to canvases (Chart.js keeps a global registry)
    const canvases = [sleepChartRef.current, scoreChartRef.current, detailChartRef.current, kcalChartRef.current];
    for (const canvas of canvases) {
      if (!canvas) continue;
      const existing = Chart.getChart(canvas);
      if (existing) {
        try {
          existing.destroy();
        } catch {}
      }
    }
  }

  useEffect(() => {
    return () => {
      destroyCharts();
    };
  }, []);

  const activeHabits = useMemo(() => habits.filter((h) => h.active), [habits]);

  // --- auth + settings ---
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) return;

      setUserEmail(data.user.email ?? "");

      const { data: s } = await supabase
        .from("settings")
        .select("nutrition_enabled, goals")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (s?.nutrition_enabled !== undefined) setNutritionEnabled(!!s.nutrition_enabled);
      if (s?.goals) setGoals(s.goals as NutritionGoals);
    })();
  }, []);

  // --- load habits ---
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) return;

      const { data: h } = await supabase
        .from("habits")
        .select("*")
        .eq("user_id", data.user.id)
        .order("sort", { ascending: true });

      // ВАЖНО: нормализация + сортировка, чтобы не падать на undefined
      setHabits(sortHabits(h ?? []));
    })();
  }, []);

  // --- load day entry ---
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) return;

      const { data: e } = await supabase
        .from("entries")
        .select("*")
        .eq("user_id", data.user.id)
        .eq("date", selectedDate)
        .maybeSingle();

      if (e) {
        setEntry(e as DayEntry);
      } else {
        setEntry({
          date: selectedDate,
          user_id: data.user.id,
          habits: {},
          nutrition: { kcal: 0, protein: 0, fat: 0, carbs: 0 },
          notes: { gratitude: "", improve: "" },
        });
      }
    })();
  }, [selectedDate]);

  async function saveEntry() {
    if (!entry) return;
    const { data } = await supabase.auth.getUser();
    if (!data?.user) return;

    const payload = { ...entry, user_id: data.user.id };

    await supabase.from("entries").upsert(payload, { onConflict: "user_id,date" });

    await renderCharts(rangeDays);
  }

  async function loadEntries(days: number): Promise<DayEntry[]> {
    const { data } = await supabase.auth.getUser();
    if (!data?.user) return [];

    const end = new Date(selectedDate);
    const start = new Date(end);
    start.setDate(start.getDate() - (days - 1));

    const { data: rows } = await supabase
      .from("entries")
      .select("*")
      .eq("user_id", data.user.id)
      .gte("date", fmtISO(start))
      .lte("date", fmtISO(end))
      .order("date", { ascending: true });

    return (rows ?? []) as DayEntry[];
  }

  async function renderCharts(days: 7 | 30 | 365) {
    destroyCharts();

    const rows = await loadEntries(days);
    const labels = rows.map((r) => r.date.slice(5)); // MM-DD

    // --- Sleep series (try find habit by keywords) ---
    const sleepHabit = activeHabits.find((h) => {
      const n = safeLower(h.name);
      const id = safeLower(h.id);
      return id === "sleep" || n.includes("sleep") || n.includes("сон");
    });

    const sleepValues = rows.map((r) => {
      if (!sleepHabit) return 0;
      const v = r.habits?.[sleepHabit.id];
      return Number(v ?? 0);
    });

    // --- Habits score series (done count / total) ---
    const scoreValues = rows.map((r) => {
      const total = activeHabits.length || 1;
      let done = 0;
      for (const h of activeHabits) {
        const v = r.habits?.[h.id];
        if (h.unit === "done") {
          if (v === true) done += 1;
        } else {
          const num = Number(v ?? 0);
          if (Number.isFinite(num) && num > 0) done += 1;
        }
      }
      return Math.round((done / total) * 100);
    });

    // --- Detailed stacked (top 6 habits only for 365 to avoid кашу) ---
    const topHabits =
      days === 365
        ? [...activeHabits]
            .map((h) => ({
              h,
              sum: rows.reduce((acc, r) => {
                const v = r.habits?.[h.id];
                if (h.unit === "done") return acc + (v === true ? 1 : 0);
                const num = Number(v ?? 0);
                return acc + (Number.isFinite(num) ? num : 0);
              }, 0),
            }))
            .sort((a, b) => b.sum - a.sum)
            .slice(0, 6)
            .map((x) => x.h)
        : activeHabits;

    const nutritionValues = rows.map((r) => Number(r.nutrition?.kcal ?? 0));

    // --- Sleep chart ---
    if (sleepChartRef.current) {
      const ex = Chart.getChart(sleepChartRef.current);
      if (ex) ex.destroy();
      const sleepChart = new Chart(sleepChartRef.current, {
        type: "line",
        data: {
          labels,
          datasets: [{ label: "Sleep (hours)", data: sleepValues }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: true } },
        },
      });
      charts.current.sleep = sleepChart;
    }

    // --- Score chart ---
    if (scoreChartRef.current) {
      const ex = Chart.getChart(scoreChartRef.current);
      if (ex) ex.destroy();
      const scoreChart = new Chart(scoreChartRef.current, {
        type: "line",
        data: {
          labels,
          datasets: [{ label: "Habits score (%)", data: scoreValues }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: true } },
          scales: { y: { min: 0, max: 100 } },
        },
      });
      charts.current.score = scoreChart;
    }

    // --- Detail chart ---
    if (detailChartRef.current) {
      const ex = Chart.getChart(detailChartRef.current);
      if (ex) ex.destroy();
      const datasets = topHabits.map((h) => ({
        label: h.name,
        data: rows.map((r) => {
          const v = r.habits?.[h.id];
          if (h.unit === "done") return v === true ? 1 : 0;
          const num = Number(v ?? 0);
          return Number.isFinite(num) ? num : 0;
        }),
      }));

      const detailChart = new Chart(detailChartRef.current, {
        type: "line",
        data: { labels, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: true } },
        },
      });
      charts.current.detail = detailChart;
    }

    // --- Nutrition chart ---
    if (nutritionEnabled && kcalChartRef.current) {
      const ex = Chart.getChart(kcalChartRef.current);
      if (ex) ex.destroy();
      const kcalChart = new Chart(kcalChartRef.current, {
        type: "bar",
        data: {
          labels,
          datasets: [{ label: "Calories (kcal)", data: nutritionValues }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: true } },
        },
      });
      charts.current.kcal = kcalChart;
    }
  }

  useEffect(() => {
    // redraw when range changes / data likely changed
    (async () => {
      await renderCharts(rangeDays);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeDays, habits, nutritionEnabled, selectedDate]);

  function setHabitValue(habitId: string, value: any) {
    setEntry((prev) => {
      if (!prev) return prev;
      return { ...prev, habits: { ...(prev.habits ?? {}), [habitId]: value } };
    });
  }

  function setNote(key: "gratitude" | "improve", value: string) {
    setEntry((prev) => {
      if (!prev) return prev;
      return { ...prev, notes: { ...(prev.notes ?? {}), [key]: value } };
    });
  }

  if (!entry) return null;

  return (
    <div className="min-h-screen p-6 text-white">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1.25fr_0.75fr] gap-6">
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-2xl font-semibold">HabitLife</div>
                <div className="text-sm text-white/60">profile: {userEmail}</div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="rounded-xl bg-black/30 border border-white/10 px-3 py-2"
                />
                <button
                  onClick={saveEntry}
                  className="rounded-xl px-4 py-2 bg-white/10 hover:bg-white/15 border border-white/10"
                >
                  Save
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-lg font-semibold mb-4">Habits</div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activeHabits.map((h) => {
                const v = entry.habits?.[h.id];

                if (h.unit === "done") {
                  return (
                    <div key={h.id} className="rounded-xl border border-white/10 bg-black/20 p-4 flex items-center justify-between">
                      <div>
                        <div className="font-medium">{h.name}</div>
                        <div className="text-xs text-white/60">type: check</div>
                      </div>
                      <button
                        onClick={() => setHabitValue(h.id, !(v === true))}
                        className="w-12 h-7 rounded-full border border-white/10 bg-white/10 relative"
                        aria-label="toggle"
                      >
                        <span
                          className={`absolute top-0.5 transition-all w-6 h-6 rounded-full bg-white/70 ${
                            v === true ? "left-5" : "left-0.5"
                          }`}
                        />
                      </button>
                    </div>
                  );
                }

                const label =
                  h.unit === "minutes" ? "minutes" : h.unit === "hours" ? "hours" : "count";

                return (
                  <div key={h.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <div className="font-medium">{h.name}</div>
                    <div className="text-xs text-white/60 mb-2">type: {label}</div>
                    <input
                      value={String(v ?? "")}
                      onChange={(e) => setHabitValue(h.id, e.target.value)}
                      className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2"
                      inputMode="numeric"
                      placeholder="0"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {nutritionEnabled && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-lg font-semibold mb-4">Nutrition</div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(["kcal", "protein", "fat", "carbs"] as const).map((k) => (
                  <div key={k} className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <div className="text-sm text-white/70">{k}</div>
                    <input
                      value={String((entry.nutrition as any)?.[k] ?? "")}
                      onChange={(e) =>
                        setEntry((prev) =>
                          prev
                            ? {
                                ...prev,
                                nutrition: {
                                  ...(prev.nutrition ?? { kcal: 0, protein: 0, fat: 0, carbs: 0 }),
                                  [k]: Number(e.target.value || 0),
                                },
                              }
                            : prev
                        )
                      }
                      className="mt-2 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2"
                      inputMode="numeric"
                      placeholder="0"
                    />
                    <div className="mt-2 text-xs text-white/50">goal: {(goals as any)[k]}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-lg font-semibold mb-4">Daily notes</div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-white/70 mb-2">Gratitude today</div>
                <textarea
                  value={entry.notes?.gratitude ?? ""}
                  onChange={(e) => setNote("gratitude", e.target.value)}
                  className="w-full min-h-[120px] rounded-xl bg-black/30 border border-white/10 px-3 py-2"
                  placeholder="3 things I'm grateful for..."
                />
              </div>

              <div>
                <div className="text-sm text-white/70 mb-2">What I would improve</div>
                <textarea
                  value={entry.notes?.improve ?? ""}
                  onChange={(e) => setNote("improve", e.target.value)}
                  className="w-full min-h-[120px] rounded-xl bg-black/30 border border-white/10 px-3 py-2"
                  placeholder="If I lived this day again, I'd..."
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold">Analytics</div>
              <div className="flex gap-2">
                {[7, 30, 365].map((d) => (
                  <button
                    key={d}
                    onClick={() => setRangeDays(d as any)}
                    className={`rounded-xl px-3 py-1.5 border border-white/10 ${
                      rangeDays === d ? "bg-white/15" : "bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 space-y-4">
              <div className="h-52 rounded-xl border border-white/10 bg-black/20 p-3">
                <canvas ref={sleepChartRef} />
              </div>

              <div className="h-52 rounded-xl border border-white/10 bg-black/20 p-3">
                <canvas ref={scoreChartRef} />
              </div>

              <div className="h-64 rounded-xl border border-white/10 bg-black/20 p-3">
                <canvas ref={detailChartRef} />
              </div>

              {nutritionEnabled && (
                <div className="h-52 rounded-xl border border-white/10 bg-black/20 p-3">
                  <canvas ref={kcalChartRef} />
                </div>
              )}

              {rangeDays === 365 && (
                <div className="text-xs text-white/50">
                  For 365 days we show only top habits in the detailed chart to keep it readable.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/70">
            Tip: if you changed settings in GitHub веб-интерфейсе — делай <code>git pull</code> перед работой локально.
          </div>
        </div>
      </div>
    </div>
  );
}
