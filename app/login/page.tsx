"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import AuthForm from "@/components/AuthForm";

export default function LoginPage() {
  const router = useRouter();
  const { user, ready } = useAuth();
  const [registered, setRegistered] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setRegistered(new URLSearchParams(window.location.search).get("registered") === "1");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (ready && user) router.replace("/chat");
  }, [ready, router, user]);

  return <><AuthForm mode="login" />{registered && <p className="success-banner" role="status">Pendaftaran berhasil. Silakan masuk.</p>}</>;
}