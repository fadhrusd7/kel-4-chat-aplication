"use client";

import { useEffect, useState } from "react";
import { getMe, login as apiLogin, logout as apiLogout } from "@/lib/api";
import type { LoginData, User } from "@/lib/types";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    getMe().then((current) => {
      if (active) {
        setUser(current);
        setReady(true);
      }
    });
    return () => { active = false; };
  }, []);

  async function signIn(data: LoginData) {
    const signedInUser = await apiLogin(data);
    setUser(signedInUser);
    return signedInUser;
  }

  async function signOut() {
    await apiLogout();
    setUser(null);
  }

  return { user, ready, signIn, signOut };
}