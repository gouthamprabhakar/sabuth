'use client';
import {useCallback, useEffect, useState, type ReactNode} from 'react';
import {ShieldCheck, Loader2, LogOut} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';

export function TeamLogin({children}: {children: ReactNode}) {
  const [user, setUser] = useState<{username: string} | null>(null);
  const [checking, setChecking] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const check = useCallback(async () => {
    try {
      const response = await fetch('/api/session', {cache: 'no-store'});
      const result = await response.json() as {user: {username: string} | null; error?: string};
      if (!response.ok) throw new Error(result.error || 'Sign-in is temporarily unavailable.');
      setUser(result.user);
      setError('');
    } catch (error) { setError((error as Error).message); }
    finally { setChecking(false); }
  }, []);
  useEffect(() => {
    void check();
    const expired = () => {setUser(null); setPassword(''); setError('Your session has ended. Please sign in again.');};
    const visible = () => {if (document.visibilityState === 'visible') void check();};
    const timer = window.setInterval(visible, 60000);
    window.addEventListener('sabuth-session-expired', expired);
    document.addEventListener('visibilitychange', visible);
    return () => {clearInterval(timer); window.removeEventListener('sabuth-session-expired', expired); document.removeEventListener('visibilitychange', visible);};
  }, [check]);
  async function signIn(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/session', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({username, password})});
      const result = await response.json() as {user: {username: string} | null; error?: string};
      if (!response.ok) throw new Error(result.error || 'Could not sign in. Please try again.');
      setPassword(''); setUser(result.user);
    } catch (error) {setError((error as Error).message);}
    finally {setBusy(false);}
  }
  async function signOut() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/session', {method: 'DELETE'});
      if (!response.ok) throw new Error('Could not sign out. Please try again.');
      setUser(null); setPassword('');
    } catch (error) {setError((error as Error).message);}
    finally {setBusy(false);}
  }
  if (checking) return <main className="team-login-shell"><p role="status">Opening Sabuth…</p></main>;
  if (user) return <><div className="team-session-bar"><span>Signed in as <strong>{user.username}</strong></span><Button variant="ghost" disabled={busy} onClick={signOut}><LogOut size={16}/>Sign out</Button>{error && <span role="alert">{error}</span>}</div>{children}</>;
  return <main className="team-login-shell"><section className="team-login-card" aria-labelledby="login-title"><div className="team-login-mark"><ShieldCheck size={28}/></div><p className="team-login-firm">PRABHAKAR LAW GROUP</p><h1 id="login-title">Sign in to Sabuth</h1><p>Your court diary and case register.</p><form onSubmit={signIn}><label htmlFor="team-username">Username</label><Input id="team-username" autoComplete="username" autoCapitalize="none" spellCheck={false} value={username} onChange={event => setUsername(event.target.value)} required maxLength={40} autoFocus/><label htmlFor="team-password">Password</label><Input id="team-password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required maxLength={128}/>{error && <p className="inline-error" role="alert">{error}</p>}<Button type="submit" disabled={busy}>{busy && <Loader2 className="spin"/>}{busy ? 'Signing in…' : 'Sign in'}</Button></form></section></main>;
}
