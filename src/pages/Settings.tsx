import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

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

type YearGoal = {
  id: string;
  title: string;
  unit: string;
  target: number;
  progress: number;
  active: boolean;
  sort: number;
};

function unitLabel(unit: HabitUnit) {
  switch (unit) {
    case "done":
      return "done (0/1)";
    case "minutes":
      return "minutes";
    case "hours":
      return "hours";
    case "count":
      return "count";
  }
}

export default function Settings({ user, toast }: { user: any; toast: (m: string) => void }) {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [goals, setGoals] = useState<YearGoal[]>([]);
  const [nutritionEnabled, setNutritionEnabled] = useState(true);
  const [ng, setNg] = useState<NutritionGoals>({ kcal: 2200, protein: 140, fat: 70, carbs: 240 });

  const [newHabit, setNewHabit] = useState<{ id: string; name: string; unit: HabitUnit; target: number }>({
    id: "new_habit",
    name: "New habit",
    unit: "done",
    target: 1,
  });

  const [newGoal, setNewGoal] = useState<{ id: string; title: string; unit: string; target: number }>({
    id: "goal_new",
    title: "New goal",
    unit: "count",
    target: 100,
  });

  const sortedHabits = useMemo(
    () => [...habits].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name)),
    [habits]
  );

  const sortedGoals = useMemo(
    () => [...goals].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.title.localeCompare(b.title)),
    [goals]
  );

  async function ensureUserSettings() {
    const { data } = await supabase.from("user_settings").select("*").eq("user_id", user.id).maybeSingle();
    if (!data) {
      await supabase.from("user_settings").insert({ user_id: user.id, nutrition_enabled: true });
      setNutritionEnabled(true);
    } else {
      setNutritionEnabled(!!data.nutrition_enabled);
    }
  }

  async function loadAll() {
    await ensureUserSettings();

    const { data: h } = await supabase.from("habits").select("*").eq("user_id", user.id);
    setHabits((h ?? []) as any);

    const { data: g } = await supabase.from("year_goals").select("*").eq("user_id", user.id);
    setGoals((g ?? []) as any);

    const { data: ngData } = await supabase.from("nutrition_goals").select("*").eq("user_id", user.id).maybeSingle();
    if (ngData) setNg({ kcal: ngData.kcal, protein: ngData.protein, fat: ngData.fat, carbs: ngData.carbs });
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveNutritionGoals() {
    await supabase.from("nutrition_goals").upsert({ user_id: user.id, ...ng });
    toast("Saved");
  }

  async function saveSettingsToggle(val: boolean) {
    setNutritionEnabled(val);
    await supabase.from("user_settings").upsert({ user_id: user.id, nutrition_enabled: val });
    toast("Saved");
  }

  async function upsertHabit(partial: Partial<Habit> & { id: string }) {
    const h = habits.find((x) => x.id === partial.id);
    if (!h) return;
    const next = { ...h, ...partial };
    setHabits((prev) => prev.map((x) => (x.id === next.id ? next : x)));
    await supabase.from("habits").update(partial).eq("user_id", user.id).eq("id", next.id);
  }

  async function addHabit() {
    const id = newHabit.id.trim();
    if (!id) return toast("Habit id is required");
    const payload = {
      user_id: user.id,
      id,
      name: newHabit.name.trim() || id,
      unit: newHabit.unit,
      target: Number(newHabit.target) || 1,
      active: true,
      sort: Math.max(0, ...habits.map((h) => h.sort ?? 0)) + 10,
    };
    const { error } = await supabase.from("habits").insert(payload);
    if (error) return toast(error.message);
    setHabits((prev) => [...prev, payload as any]);
    toast("Habit added");
  }

  async function removeHabit(id: string) {
    await supabase.from("habits").delete().eq("user_id", user.id).eq("id", id);
    setHabits((prev) => prev.filter((h) => h.id !== id));
    toast("Removed");
  }

  async function addGoal() {
    const id = newGoal.id.trim();
    if (!id) return toast("Goal id is required");
    const payload = {
      user_id: user.id,
      id,
      title: newGoal.title.trim() || id,
      unit: newGoal.unit.trim() || "count",
      target: Number(newGoal.target) || 1,
      progress: 0,
      active: true,
      sort: Math.max(0, ...goals.map((g) => g.sort ?? 0)) + 10,
    };
    const { error } = await supabase.from("year_goals").insert(payload);
    if (error) return toast(error.message);
    setGoals((prev) => [...prev, payload as any]);
    toast("Goal added");
  }

  async function upsertGoal(partial: Partial<YearGoal> & { id: string }) {
    const g = goals.find((x) => x.id === partial.id);
    if (!g) return;
    const next = { ...g, ...partial };
    setGoals((prev) => prev.map((x) => (x.id === next.id ? next : x)));
    await supabase.from("year_goals").update(partial).eq("user_id", user.id).eq("id", next.id);
  }

  async function removeGoal(id: string) {
    await supabase.from("year_goals").delete().eq("user_id", user.id).eq("id", id);
    setGoals((prev) => prev.filter((g) => g.id !== id));
    toast("Removed");
  }

  return (
    <div className="container">
      <div className="grid">
        <div className="card">
          <div className="cardTitle">Features</div>

          <div className="row between" style={{ alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 700 }}>Nutrition</div>
              <div className="muted" style={{ fontSize: 12 }}>
                Show/hide nutrition block on the Dashboard
              </div>
            </div>

            <label className="switch">
              <input type="checkbox" checked={nutritionEnabled} onChange={(e) => saveSettingsToggle(e.target.checked)} />
              <span className="slider" />
            </label>
          </div>
        </div>

        <div className="card">
          <div className="cardTitle">Nutrition goals</div>
          <div className="grid4">
            <div>
              <div className="muted small">kcal</div>
              <input className="input" type="number" value={ng.kcal} onChange={(e) => setNg({ ...ng, kcal: +e.target.value })} />
            </div>
            <div>
              <div className="muted small">protein (g)</div>
              <input className="input" type="number" value={ng.protein} onChange={(e) => setNg({ ...ng, protein: +e.target.value })} />
            </div>
            <div>
              <div className="muted small">fat (g)</div>
              <input className="input" type="number" value={ng.fat} onChange={(e) => setNg({ ...ng, fat: +e.target.value })} />
            </div>
            <div>
              <div className="muted small">carbs (g)</div>
              <input className="input" type="number" value={ng.carbs} onChange={(e) => setNg({ ...ng, carbs: +e.target.value })} />
            </div>
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn" onClick={saveNutritionGoals}>
              Save
            </button>
          </div>
        </div>

        <div className="card">
          <div className="cardTitle">Habits</div>

          <div className="muted small" style={{ marginBottom: 8 }}>
            Add / edit / disable habits. Analytics will work for any unit.
          </div>

          <div className="habitsList">
            {sortedHabits.map((h) => (
              <div key={h.id} className="habitRow">
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{h.name}</div>
                  <div className="muted small">
                    id: <span className="mono">{h.id}</span> • {unitLabel(h.unit)} • target: {h.target}
                  </div>
                </div>

                <button className={"btn tiny " + (h.active ? "" : "ghost")} onClick={() => upsertHabit({ id: h.id, active: !h.active })}>
                  {h.active ? "On" : "Off"}
                </button>

                <button className="btn tiny ghost" onClick={() => removeHabit(h.id)}>
                  Delete
                </button>
              </div>
            ))}
          </div>

          <div className="divider" />

          <div className="row wrap">
            <input className="input" value={newHabit.id} onChange={(e) => setNewHabit({ ...newHabit, id: e.target.value })} placeholder="id (unique)" />
            <input className="input" value={newHabit.name} onChange={(e) => setNewHabit({ ...newHabit, name: e.target.value })} placeholder="name" />
            <select className="input" value={newHabit.unit} onChange={(e) => setNewHabit({ ...newHabit, unit: e.target.value as HabitUnit })}>
              <option value="done">done (0/1)</option>
              <option value="minutes">minutes</option>
              <option value="hours">hours</option>
              <option value="count">count</option>
            </select>
            <input className="input" type="number" value={newHabit.target} onChange={(e) => setNewHabit({ ...newHabit, target: +e.target.value })} placeholder="target" />
            <button className="btn" onClick={addHabit}>
              Add habit
            </button>
          </div>
        </div>

        <div className="card">
          <div className="cardTitle">Year goals</div>

          <div className="muted small" style={{ marginBottom: 8 }}>
            These are big targets for the year. You can update progress on the Dashboard.
          </div>

          <div className="habitsList">
            {sortedGoals.map((g) => (
              <div key={g.id} className="habitRow">
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{g.title}</div>
                  <div className="muted small">
                    id: <span className="mono">{g.id}</span> • unit: {g.unit} • target: {g.target} • progress: {g.progress}
                  </div>
                </div>

                <button className={"btn tiny " + (g.active ? "" : "ghost")} onClick={() => upsertGoal({ id: g.id, active: !g.active })}>
                  {g.active ? "On" : "Off"}
                </button>

                <button className="btn tiny ghost" onClick={() => removeGoal(g.id)}>
                  Delete
                </button>
              </div>
            ))}
          </div>

          <div className="divider" />

          <div className="row wrap">
            <input className="input" value={newGoal.id} onChange={(e) => setNewGoal({ ...newGoal, id: e.target.value })} placeholder="id (unique)" />
            <input className="input" value={newGoal.title} onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })} placeholder="title" />
            <input className="input" value={newGoal.unit} onChange={(e) => setNewGoal({ ...newGoal, unit: e.target.value })} placeholder="unit (words, pages, %, done…)" />
            <input className="input" type="number" value={newGoal.target} onChange={(e) => setNewGoal({ ...newGoal, target: +e.target.value })} placeholder="target" />
            <button className="btn" onClick={addGoal}>
              Add goal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
