"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { login, register } from "@/lib/api";

type AuthFormProps = { mode: "login" | "register" };

export default function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const isRegister = mode === "register";
  const [identifier, setIdentifier] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (isRegister) {
      if (password.length < 8) return setError("Password minimal 8 karakter.");
      if (password !== confirmation) return setError("Konfirmasi password tidak sama.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError("Format email belum benar.");
    }

    setPending(true);
    try {
      if (isRegister) {
        await register({ username: username.trim(), email: email.trim(), password });
        router.replace("/login?registered=1");
      } else {
        await login({ identifier: identifier.trim(), password });
        router.replace("/chat");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Terjadi kesalahan. Coba lagi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-intro" aria-label="Tentang Obrolan">
        <span className="auth-eyebrow">RUANG PRIBADI / 01</span>
        <div>
          <p className="auth-brand">obrolan.</p>
          <p className="auth-tagline">Percakapan yang jernih, untuk hal-hal yang berarti.</p>
        </div>
        <span className="auth-footnote">PESAN LANGSUNG · WAKTU WIB</span>
      </section>
      <section className="auth-panel">
        <form className="auth-form" onSubmit={handleSubmit}>
          <h1>{isRegister ? "Daftar" : "Masuk"}</h1>
          {error && <div className="error-banner" role="alert"><strong>{isRegister ? "Pendaftaran gagal." : "Gagal masuk."}</strong> {error}</div>}
          {isRegister ? (
            <>
              <div className="field">
                <label htmlFor="username">Username</label>
                <input className="form-control" id="username" autoComplete="username" required value={username} onChange={(event) => setUsername(event.target.value)} placeholder="nama pengguna" />
              </div>
              <div className="field">
                <label htmlFor="email">Email</label>
                <input className="form-control" id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nama@email.com" />
              </div>
            </>
          ) : (
            <div className="field">
              <label htmlFor="identifier">Username atau email</label>
              <input className="form-control" id="identifier" autoComplete="username" required value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="nama pengguna atau email" />
            </div>
          )}
          <div className="field">
            <label htmlFor="password">Password</label>
            <input className="form-control" id="password" type="password" autoComplete={isRegister ? "new-password" : "current-password"} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder={isRegister ? "Minimal 8 karakter" : "Masukkan password"} />
          </div>
          {isRegister && (
            <div className="field">
              <label htmlFor="confirmation">Konfirmasi password</label>
              <input className="form-control" id="confirmation" type="password" autoComplete="new-password" required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Ulangi password" />
            </div>
          )}
          <button className="button button-primary" type="submit" disabled={pending}>
            {pending ? "Memproses…" : isRegister ? "Daftar" : "Masuk"}
          </button>
          <p className="auth-switch">
            {isRegister ? "Sudah punya akun? " : "Belum punya akun? "}
            <Link className="text-link" href={isRegister ? "/login" : "/register"}>{isRegister ? "Masuk" : "Daftar"}</Link>
          </p>
        </form>
      </section>
    </main>
  );
}