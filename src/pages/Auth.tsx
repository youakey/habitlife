import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function signIn() {
    setLoading(true);
    setMsg(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    setLoading(false);
    if (error) setMsg(error.message);
  }

  async function signUp() {
    setLoading(true);
    setMsg(null);
    const { error } = await supabase.auth.signUp({ email, password: pass });
    setLoading(false);
    if (error) setMsg(error.message);
    else setMsg("Account created. You can sign in.");
  }

  return (
    <div className="center">
      <div className="card auth">
        <div className="title">Sign in</div>
        <div className="row">
          <input
            className="input"
            placeholder="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="input"
            placeholder="password"
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
          />
        </div>
        <div className="row">
          <button className="btn" onClick={signIn} disabled={loading}>
            Sign in
          </button>
          <button className="btn ghost" onClick={signUp} disabled={loading}>
            Sign up
          </button>
        </div>
        {msg && <div className="hint">{msg}</div>}
      </div>
    </div>
  );
}
