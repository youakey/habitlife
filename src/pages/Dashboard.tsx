import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import Chart from "chart.js/auto";

type HabitUnit = "done" | "minutes" | "hours" | "count";

type Habit = {
  id: string;
  name: string;
  unit: HabitUnit;
  target: number;
  active: boolean;
  sort: number;
};

type NutritionGoals = { kcal: number; protein: number; fat: number; carbs: number };
type NutritionLog = { kcal: number; protein: number; fat: number; carbs: number };

type DayNote = { gratitude: string; redo: string };

type YearGoal = {
  id: string;
  title: string;
  unit: string;
  target: number;
  progress: number;
  active: boolean;
  sort: number;
};

type Range = 7 | 30 | 365;

function isoDay(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function clamp01(x: number) {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function unitLabel(unit: HabitUnit) {
  switch (unit) {
    case "done":
      return "done";
    case "minutes":
      return "minutes";
    case "hours":
      return "hours";
    case "count":
      return "count";
  }
}

function niceDayLabel(s: string) {
  // "YYYY-MM-DD" -> "MM-DD"
  return s.slice(5);
}

export default function Dashboard({ user, toast }: { user: any; toast: (m: string) => void }) {
  const [day, setDay] = useState(isoDay(new Date()));

  const [habits, setHabits] = useState<Habit[]>([]);
  const activeHabits = useMemo(() => habits.filter((h) => h.active), [habits]);

  const [habitValues, setHabitValues] = useState<Record<string, number>>({});
  const [nutritionEnabled, setNutritionEnabled] = useState(true);
  const [ng, setNg] = useState<NutritionGoals>({ kcal: 2200, protein: 140, fat: 70, carbs: 240 });
  const [nl, setNl] = useState<NutritionLog>({ kcal: 0, protein: 0, fat: 0, carbs: 0 });

  const [notes, setNotes] = useState<DayNote>({ gratitude: "", redo: "" });

  const [yearGoals, setYearGoals] = useState<YearGoal[]>([]);

  const [range, setRange] = useState<Range>(7);
  const [detailHabitId, setDetailHabitId] = useState<string>("");

  const sleepChartRef = useRef<HTMLCanvasElement | null>(null);
  const scoreChartRef = useRef<HTMLCanvasElement | null>(null);
  const kcalChartRef = useRef<HTMLCanvasElement | null>(null);
  const detailChartRef = useRef<HTMLCanvasElement | null>(null);

  const charts = useRef<{ sleep?: Chart; score?: Chart; kcal?: Chart; detail?: Chart }>({});

  const sleepHabit = useMemo(() => activeHabits.find((h) => h.id.toLowerCase().includes("sleep") || h.name.toLowerCase().includes("сон")), [activeHabits]);

  async function ensureDefaults() {
    // user_settings
    const { data: us } = await supabase.from("user_settings").select("*").eq("user_id", user.id).maybeSingle();
    if (!us) {
      await supabase.from("user_settings").insert({ user_id: user.id, nutrition_enabled: true });
      setNutritionEnabled(true);
    } else {
      setNutritionEnabled(!!us.nutrition_enabled);
    }

    // habits
    const { data: existingHabits } = await supabase.from("habits").select("*").eq("user_id", user.id);
    if (!existingHabits || existingHabits.length === 0) {
      const defaults: Habit[] = [
        { id: "training", name: "Тренировка", unit: "done", target: 1, active: true, sort: 10 },
        { id: "prayer", name: "Молитва", unit: "done", target: 1, active: true, sort: 20 },
        { id: "code_2h", name: "Прога (2 часа)", unit: "done", target: 1, active: true, sort: 30 },
        { id: "english_30m", name: "Английский (30 мин)", unit: "done", target: 1, active: true, sort: 40 },
        { id: "ministry", name: "Служение", unit: "minutes", target: 60, active: true, sort: 50 },
        { id: "sleep", name: "Сон", unit: "hours", target: 7, active: true, sort: 60 },
        { id: "no_screen_1h_before_sleep", name: "1ч до сна без экрана", unit: "done", target: 1, active: true, sort: 70 },
        { id: "no_screen_1h_after_wake", name: "1ч после подъёма без экрана", unit: "done", target: 1, active: true, sort: 80 },
        { id: "friends_time", name: "Общение с друзьями", unit: "hours", target: 1, active: true, sort: 90 },
      ];
      await supabase.from("habits").insert(defaults.map((h) => ({ ...h, user_id: user.id })));
    }

    // nutrition goals
    const { data: ngData } = await supabase.from("nutrition_goals").select("*").eq("user_id", user.id).maybeSingle();
    if (!ngData) {
      await supabase.from("nutrition_goals").insert({ user_id: user.id, ...ng });
    } else {
      setNg({ kcal: ngData.kcal, protein: ngData.protein, fat: ngData.fat, carbs: ngData.carbs });
    }

    // year goals
    const { data: g } = await supabase.from("year_goals").select("*").eq("user_id", user.id);
    if (!g || g.length === 0) {
      const defaults: YearGoal[] = [
        { id: "words_3_daily", title: "Learn 3 English words daily", unit: "words", target: 1095, progress: 0, active: true, sort: 10 },
        { id: "bible_plan", title: "Bible plan (OT x1, NT x2)", unit: "%", target: 100, progress: 0, active: true, sort: 20 },
        { id: "hebrews_memory", title: "Memorize Hebrews", unit: "verses", target: 300, progress: 0, active: true, sort: 30 },
        { id: "read_books", title: "Read books", unit: "pages", target: 7300, progress: 0, active: true, sort: 40 },
        { id: "trip_georgia", title: "Trip to Georgia", unit: "done", target: 1, progress: 0, active: true, sort: 50 },
        { id: "get_job", title: "Get a job", unit: "done", target: 1, progress: 0, active: true, sort: 60 },
      ];
      await supabase.from("year_goals").insert(defaults.map((x) => ({ ...x, user_id: user.id })));
    }
  }

  async function loadHabitsAndGoals() {
    const { data: h } = await supabase.from("habits").select("*").eq("user_id", user.id);
    setHabits(((h ?? []) as any).sort((a: Habit, b: Habit) => (a.sort ?? 0) - (b.sort ?? 0)));

    const { data: us } = await supabase.from("user_settings").select("*").eq("user_id", user.id).maybeSingle();
    setNutritionEnabled(us ? !!us.nutrition_enabled : true);

    const { data: g } = await supabase.from("year_goals").select("*").eq("user_id", user.id);
    setYearGoals(((g ?? []) as any).sort((a: YearGoal, b: YearGoal) => (a.sort ?? 0) - (b.sort ?? 0)));
  }

  async function loadForDay(d: string) {
    const { data: hl } = await supabase.from("habit_logs").select("*").eq("user_id", user.id).eq("day", d);
    const map: Record<string, number> = {};
    (hl ?? []).forEach((r: any) => (map[r.habit_id] = Number(r.value ?? 0)));
    setHabitValues(map);

    const { data: nld } = await supabase.from("nutrition_logs").select("*").eq("user_id", user.id).eq("day", d).maybeSingle();
    if (nld) setNl({ kcal: nld.kcal ?? 0, protein: nld.protein ?? 0, fat: nld.fat ?? 0, carbs: nld.carbs ?? 0 });
    else setNl({ kcal: 0, protein: 0, fat: 0, carbs: 0 });

    const { data: nd } = await supabase.from("day_notes").select("*").eq("user_id", user.id).eq("day", d).maybeSingle();
    if (nd) setNotes({ gratitude: nd.gratitude ?? "", redo: nd.redo ?? "" });
    else setNotes({ gratitude: "", redo: "" });
  }

  async function saveDay() {
    // habits
    const rows = activeHabits.map((h) => ({
      user_id: user.id,
      day,
      habit_id: h.id,
      value: Number(habitValues[h.id] ?? 0),
    }));
    if (rows.length) await supabase.from("habit_logs").upsert(rows);

    // nutrition
    if (nutritionEnabled) {
      await supabase
        .from("nutrition_logs")
        .upsert({ user_id: user.id, day, kcal: +nl.kcal || 0, protein: +nl.protein || 0, fat: +nl.fat || 0, carbs: +nl.carbs || 0 });
    }

    // notes
    await supabase.from("day_notes").upsert({ user_id: user.id, day, gratitude: notes.gratitude, redo: notes.redo });

    toast("Saved");
    renderCharts(range);
  }

  function destroyCharts() {
    Object.values(charts.current).forEach((c) => c?.destroy());
    charts.current = {};
  }

  function makeLabels(days: string[]) {
    if (days.length <= 40) return days.map(niceDayLabel);
    return days.map((d) => d.slice(2, 10)); // "YY-MM-DD"
  }

  function weekBuckets(days: string[]) {
    const buckets: { label: string; days: string[] }[] = [];
    for (let i = 0; i < days.length; i += 7) {
      const slice = days.slice(i, i + 7);
      if (!slice.length) continue;
      const label = `${niceDayLabel(slice[0])}…${niceDayLabel(slice[slice.length - 1])}`;
      buckets.push({ label, days: slice });
    }
    return buckets;
  }

  async function renderCharts(daysCount: Range) {
    destroyCharts();

    const end = new Date(day + "T12:00:00");
    const start = new Date(end);
    start.setDate(start.getDate() - (daysCount - 1));

    const daysArr: string[] = [];
    for (let i = 0; i < daysCount; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      daysArr.push(isoDay(d));
    }

    // fetch habit logs and nutrition logs for range
    const { data: hl } = await supabase
      .from("habit_logs")
      .select("*")
      .eq("user_id", user.id)
      .gte("day", daysArr[0])
      .lte("day", daysArr[daysArr.length - 1]);

    const { data: nlRows } = await supabase
      .from("nutrition_logs")
      .select("*")
      .eq("user_id", user.id)
      .gte("day", daysArr[0])
      .lte("day", daysArr[daysArr.length - 1]);

    const byDay: Record<string, Record<string, number>> = {};
    (hl ?? []).forEach((r: any) => {
      if (!byDay[r.day]) byDay[r.day] = {};
      byDay[r.day][r.habit_id] = Number(r.value ?? 0);
    });

    const nutByDay: Record<string, NutritionLog> = {};
    (nlRows ?? []).forEach((r: any) => {
      nutByDay[r.day] = { kcal: r.kcal ?? 0, protein: r.protein ?? 0, fat: r.fat ?? 0, carbs: r.carbs ?? 0 };
    });

    const habitsNow = activeHabits;

    // daily score [0..100]
    const scoreDaily = daysArr.map((d) => {
      const dayMap = byDay[d] ?? {};
      const parts = habitsNow.map((h) => {
        const v = Number(dayMap[h.id] ?? 0);
        const target = Math.max(1, Number(h.target ?? 1));
        const ratio = h.unit === "done" ? (v >= 1 ? 1 : 0) : v / target;
        return clamp01(ratio);
      });
      if (!parts.length) return 0;
      return Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100);
    });

    const sleepDaily = daysArr.map((d) => {
      const dayMap = byDay[d] ?? {};
      if (!sleepHabit) return 0;
      return Number(dayMap[sleepHabit.id] ?? 0);
    });

    const kcalDaily = daysArr.map((d) => Number((nutByDay[d]?.kcal ?? 0)));

    const useWeekly = daysCount === 365;
    const labels = useWeekly ? weekBuckets(daysArr).map((b) => b.label) : makeLabels(daysArr);

    function aggWeekly(values: number[]) {
      const out: number[] = [];
      const buckets = weekBuckets(daysArr);
      for (let bi = 0; bi < buckets.length; bi++) {
        const b = buckets[bi];
        const idx0 = daysArr.indexOf(b.days[0]);
        const idx1 = idx0 + b.days.length;
        const slice = values.slice(idx0, idx1);
        const avg = slice.length ? slice.reduce((a, b) => a + b, 0) / slice.length : 0;
        out.push(Math.round(avg * 10) / 10);
      }
      return out;
    }

    const scoreSeries = useWeekly ? aggWeekly(scoreDaily) : scoreDaily;
    const sleepSeries = useWeekly ? aggWeekly(sleepDaily) : sleepDaily;
    const kcalSeries = useWeekly ? aggWeekly(kcalDaily) : kcalDaily;

    // Sleep
    if (sleepChartRef.current) {
      charts.current.sleep = new Chart(sleepChartRef.current, {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "Sleep (hours)",
              data: sleepSeries,
              tension: 0.35,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: true } },
          scales: { y: { beginAtZero: true } },
        },
      });
    }

    // Score
    if (scoreChartRef.current) {
      charts.current.score = new Chart(scoreChartRef.current, {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "Habits score (%)",
              data: scoreSeries,
              tension: 0.35,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: true } },
          scales: { y: { beginAtZero: true, max: 100 } },
        },
      });
    }

    // Nutrition kcal
    if (nutritionEnabled && kcalChartRef.current) {
      charts.current.kcal = new Chart(kcalChartRef.current, {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "Nutrition (kcal)",
              data: kcalSeries,
              tension: 0.35,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: true } },
          scales: { y: { beginAtZero: true } },
        },
      });
    }

    // Detail habit (optional)
    if (detailHabitId && detailChartRef.current) {
      const h = habitsNow.find((x) => x.id === detailHabitId);
      if (h) {
        const daily = daysArr.map((d) => Number((byDay[d] ?? {})[h.id] ?? 0));
        const series = useWeekly ? aggWeekly(daily) : daily;
        charts.current.detail = new Chart(detailChartRef.current, {
          type: h.unit === "done" ? "bar" : "line",
          data: {
            labels,
            datasets: [
              {
                label: `${h.name} (${unitLabel(h.unit)})`,
                data: series,
                tension: 0.35,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: true } },
            scales: { y: { beginAtZero: true } },
          },
        });
      }
    }
  }

  async function updateGoalProgress(id: string, nextProgress: number) {
    const g = yearGoals.find((x) => x.id === id);
    if (!g) return;
    const safe = Math.max(0, Number(nextProgress) || 0);
    setYearGoals((prev) => prev.map((x) => (x.id === id ? { ...x, progress: safe } : x)));
    await supabase.from("year_goals").update({ progress: safe }).eq("user_id", user.id).eq("id", id);
  }

  useEffect(() => {
    (async () => {
      await ensureDefaults();
      await loadHabitsAndGoals();
      await loadForDay(day);
      await renderCharts(range);
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadForDay(day);
    renderCharts(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  useEffect(() => {
    renderCharts(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, nutritionEnabled, detailHabitId, activeHabits.length]);

  const yearGoalsActive = useMemo(() => yearGoals.filter((g) => g.active), [yearGoals]);

  return (
    <div className="container">
      <div className="grid2">
        <div className="card">
          <div className="row between">
            <div className="cardTitle">Today</div>
            <div className="row">
              <button className="btn" onClick={saveDay}>
                Save
              </button>
              <button className="btn ghost" onClick={() => loadForDay(day)}>
                Refresh
              </button>
            </div>
          </div>

          <div className="row wrap" style={{ marginTop: 10 }}>
            <div style={{ minWidth: 220 }}>
              <div className="muted small">Day</div>
              <input className="input" type="date" value={day} onChange={(e) => setDay(e.target.value)} />
            </div>
          </div>

          <div className="divider" />

          <div className="sectionTitle">Habits</div>
          <div className="habitsGrid">
            {activeHabits.map((h) => (
              <div key={h.id} className="habitCard">
                <div className="habitName">{h.name}</div>
                <div className="muted small">
                  {unitLabel(h.unit)} • target: {h.target}
                </div>

                {h.unit === "done" ? (
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={(habitValues[h.id] ?? 0) >= 1}
                      onChange={(e) => setHabitValues((prev) => ({ ...prev, [h.id]: e.target.checked ? 1 : 0 }))}
                    />
                    <span />
                  </label>
                ) : (
                  <input
                    className="input"
                    type="number"
                    value={habitValues[h.id] ?? 0}
                    onChange={(e) => setHabitValues((prev) => ({ ...prev, [h.id]: +e.target.value }))}
                  />
                )}
              </div>
            ))}
          </div>

          {nutritionEnabled && (
            <>
              <div className="divider" />
              <div className="sectionTitle">Nutrition (KBJU)</div>

              <div className="grid4">
                <input className="input" type="number" value={nl.kcal} onChange={(e) => setNl({ ...nl, kcal: +e.target.value })} placeholder="kcal" />
                <input className="input" type="number" value={nl.protein} onChange={(e) => setNl({ ...nl, protein: +e.target.value })} placeholder="protein" />
                <input className="input" type="number" value={nl.fat} onChange={(e) => setNl({ ...nl, fat: +e.target.value })} placeholder="fat" />
                <input className="input" type="number" value={nl.carbs} onChange={(e) => setNl({ ...nl, carbs: +e.target.value })} placeholder="carbs" />
              </div>

              <div className="grid4" style={{ marginTop: 8 }}>
                <div className="progressCard">
                  <div className="muted small">kcal</div>
                  <div className="progressText">
                    {nl.kcal} / {ng.kcal}
                  </div>
                  <div className="bar">
                    <div className="barIn" style={{ width: `${Math.min(100, (nl.kcal / ng.kcal) * 100)}%` }} />
                  </div>
                </div>
                <div className="progressCard">
                  <div className="muted small">protein</div>
                  <div className="progressText">
                    {nl.protein} / {ng.protein}
                  </div>
                  <div className="bar">
                    <div className="barIn" style={{ width: `${Math.min(100, (nl.protein / ng.protein) * 100)}%` }} />
                  </div>
                </div>
                <div className="progressCard">
                  <div className="muted small">fat</div>
                  <div className="progressText">
                    {nl.fat} / {ng.fat}
                  </div>
                  <div className="bar">
                    <div className="barIn" style={{ width: `${Math.min(100, (nl.fat / ng.fat) * 100)}%` }} />
                  </div>
                </div>
                <div className="progressCard">
                  <div className="muted small">carbs</div>
                  <div className="progressText">
                    {nl.carbs} / {ng.carbs}
                  </div>
                  <div className="bar">
                    <div className="barIn" style={{ width: `${Math.min(100, (nl.carbs / ng.carbs) * 100)}%` }} />
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="divider" />

          <div className="sectionTitle">Daily reflection</div>
          <div className="notesGrid">
            <div>
              <div className="muted small">Gratitude today</div>
              <textarea className="input textarea" value={notes.gratitude} onChange={(e) => setNotes({ ...notes, gratitude: e.target.value })} />
            </div>
            <div>
              <div className="muted small">If I could live this day again, I would…</div>
              <textarea className="input textarea" value={notes.redo} onChange={(e) => setNotes({ ...notes, redo: e.target.value })} />
            </div>
          </div>

          <div className="divider" />

          <div className="sectionTitle">Year goals</div>
          <div className="goalsList">
            {yearGoalsActive.map((g) => {
              const target = Math.max(1, Number(g.target) || 1);
              const pct = Math.min(100, (Number(g.progress ?? 0) / target) * 100);
              const isDone = g.unit === "done" || target === 1;
              return (
                <div key={g.id} className="goalRow">
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800 }}>{g.title}</div>
                    <div className="muted small">
                      {g.progress} / {g.target} {g.unit}
                    </div>
                    <div className="bar" style={{ marginTop: 6 }}>
                      <div className="barIn" style={{ width: `${pct}%` }} />
                    </div>
                  </div>

                  {isDone ? (
                    <label className="toggle">
                      <input type="checkbox" checked={Number(g.progress) >= 1} onChange={(e) => updateGoalProgress(g.id, e.target.checked ? 1 : 0)} />
                      <span />
                    </label>
                  ) : (
                    <div className="row" style={{ gap: 8 }}>
                      <button className="btn tiny ghost" onClick={() => updateGoalProgress(g.id, Number(g.progress ?? 0) + 1)}>
                        +1
                      </button>
                      <button className="btn tiny ghost" onClick={() => updateGoalProgress(g.id, Number(g.progress ?? 0) + 10)}>
                        +10
                      </button>
                      <input
                        className="input tinyInput"
                        type="number"
                        value={g.progress ?? 0}
                        onChange={(e) => updateGoalProgress(g.id, +e.target.value)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <div className="row between">
            <div className="cardTitle">Analytics</div>
            <div className="row">
              <button className={"btn tiny " + (range === 7 ? "" : "ghost")} onClick={() => setRange(7)}>
                7D
              </button>
              <button className={"btn tiny " + (range === 30 ? "" : "ghost")} onClick={() => setRange(30)}>
                30D
              </button>
              <button className={"btn tiny " + (range === 365 ? "" : "ghost")} onClick={() => setRange(365)}>
                365D
              </button>
            </div>
          </div>

          <div className="muted small" style={{ marginTop: 6 }}>
            For 365D we show weekly averages to keep it readable.
          </div>

          <div className="divider" />

          <div className="chartBlock">
            <div className="chartTitle">Sleep</div>
            <div className="chartWrap">
              <canvas ref={sleepChartRef} />
            </div>
          </div>

          <div className="chartBlock">
            <div className="chartTitle">Habits score</div>
            <div className="chartWrap">
              <canvas ref={scoreChartRef} />
            </div>
          </div>

          {nutritionEnabled && (
            <div className="chartBlock">
              <div className="chartTitle">Nutrition</div>
              <div className="chartWrap">
                <canvas ref={kcalChartRef} />
              </div>
            </div>
          )}

          <div className="divider" />

          <div className="row wrap" style={{ gap: 10 }}>
            <div style={{ minWidth: 240 }}>
              <div className="muted small">Detail habit</div>
              <select className="input" value={detailHabitId} onChange={(e) => setDetailHabitId(e.target.value)}>
                <option value="">— none —</option>
                {activeHabits.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {detailHabitId && (
            <div className="chartBlock" style={{ marginTop: 10 }}>
              <div className="chartTitle">Selected habit</div>
              <div className="chartWrap">
                <canvas ref={detailChartRef} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
