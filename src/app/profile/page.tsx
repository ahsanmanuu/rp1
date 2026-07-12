"use client";

import { useSession } from "@/lib/pb-auth-react";
import { useState, useEffect } from "react";

export default function ProfilePage() {
  const { data: session, update } = useSession({ required: true });
  const [name, setName] = useState("");
  const [theme, setTheme] = useState("dark");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (session?.user && !initialized) {
      setName(session.user.name || "");
      setTheme(session.user.theme || "dark");
      setInitialized(true);
    }
  }, [session, initialized]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, theme }),
      });

      if (!res.ok) throw new Error("Failed to update profile");
      
      // Update local session
      await update({ name, theme });
      setMessage("Profile updated successfully");
      
      if (theme !== session?.user?.theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
      }
    } catch (err: any) {
      setMessage(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (!session) return <div>Loading...</div>;

  return (
    <div className="container" style={{ padding: '3rem 1.5rem', maxWidth: '800px' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '2rem' }}>Your Profile</h1>
      
      <div className="card glass">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', color: 'white', fontWeight: 'bold' }}>
            {session.user.name?.[0]?.toUpperCase() || session.user.email?.[0]?.toUpperCase()}
          </div>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>{session.user.name || "User"}</h2>
            <p style={{ color: 'var(--text-secondary)' }}>{session.user.email}</p>
            <div style={{ display: 'inline-block', marginTop: '0.5rem', background: 'var(--bg-tertiary)', padding: '0.25rem 0.75rem', borderRadius: '99px', fontSize: '0.875rem' }}>
              <span style={{ color: 'var(--warning)', fontWeight: 600 }}>★</span> {session.user.points} points available
            </div>
          </div>
        </div>

        {message && (
          <div style={{ padding: '0.75rem', borderRadius: '6px', marginBottom: '1.5rem', background: message.includes('success') ? 'var(--success)' : 'var(--error)', color: 'white', opacity: 0.9 }}>
            {message}
          </div>
        )}

        <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Display Name</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field" 
            />
          </div>
          
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Default Editor Theme</label>
            <select 
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="input-field"
            >
              <option value="dark">Dark Theme (vs-dark)</option>
              <option value="light">Light Theme (vs)</option>
            </select>
          </div>

          <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }} disabled={loading}>
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </div>
    </div>
  );
}
