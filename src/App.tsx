import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "./lib/supabase";
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";
import Auth from "./pages/Auth";

type Tab = "dashboard" | "settings";

function Logo() {
  return (
    <div className="logo">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M8.2 12.6l2.3 2.6L16.8 8"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string>("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  if (loading) return <div className="center muted">Loading…</div>;
  if (!user) return <Auth />;

  return (
    <div className="app">
      <header className="topbar">
        <div className="row" style={{ gap: 14 }}>
          <Logo />
          <div>
            <h1>HabitLife</h1>
            <div className="muted" style={{ fontSize: 12 }}>
              profile: {user.email}
            </div>
          </div>
        </div>

        <div className="row">
          <button className={"btn " + (tab === "dashboard" ? "" : "ghost")} onClick={() => setTab("dashboard")}>
            Dashboard
          </button>
          <button className={"btn " + (tab === "settings" ? "" : "ghost")} onClick={() => setTab("settings")}>
            Settings
          </button>
          <button
            className="btn ghost"
            onClick={async () => {
              await supabase.auth.signOut();
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {tab === "dashboard" ? (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            <Dashboard user={user} toast={(m) => setToast(m)} />
          </motion.div>
        ) : (
          <motion.div
            key="settings"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            <Settings user={user} toast={(m) => setToast(m)} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            className="toast"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.18 }}
            onAnimationComplete={() => {
              setTimeout(() => setToast(""), 1800);
            }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
