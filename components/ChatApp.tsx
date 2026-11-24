"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getMessages, getUsers, requestBackup, sendMessage } from "@/lib/api";
import { formatBackupTime, formatDateLabel, formatTime, getSyncedNow } from "@/lib/time";
import type { Message, User } from "@/lib/types";

type BackupState = { kind: "idle" | "working" | "ok" | "error"; finishedAt?: string };

function mergeMessages(current: Message[], incoming: Message[]) {
  const byId = new Map(current.map((message) => [message.id, message]));
  incoming.forEach((message) => byId.set(message.id, message));
  return [...byId.values()].sort((first, second) => first.id - second.id);
}

function messagePreview(message?: Message) {
  if (!message) return "Belum ada pesan";
  return message.body.replace(/\s+/g, " ");
}

export default function ChatApp() {
  const router = useRouter();
  const { user, ready, signOut } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [selected, setSelected] = useState<User | null>(null);
  const [conversations, setConversations] = useState<Record<number, Message[]>>({});
  const [messages, setMessages] = useState<Message[]>([]);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [backup, setBackup] = useState<BackupState>({ kind: "idle" });
  const [now, setNow] = useState(() => new Date(0));
  const [showNewMessages, setShowNewMessages] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const messageCountRef = useRef(0);
  const localMessageIdRef = useRef(0);

  useEffect(() => {
    if (ready && !user) router.replace("/login");
  }, [ready, router, user]);

  useEffect(() => {
    if (!ready || !user) return;
    let active = true;
    getUsers().then(async (otherUsers) => {
      const initial = await Promise.all(otherUsers.map(async (other) => [other.id, await getMessages(other.id)] as const));
      if (!active) return;
      setUsers(otherUsers);
      setConversations(Object.fromEntries(initial));
      setLoadingUsers(false);
    }).catch(() => setLoadingUsers(false));
    return () => { active = false; };
  }, [ready, user]);

  useEffect(() => {
    const initialUpdate = window.setTimeout(() => setNow(getSyncedNow()), 0);
    const timer = window.setInterval(() => setNow(getSyncedNow()), 30_000);
    return () => {
      window.clearTimeout(initialUpdate);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!selected) return;
    let active = true;
    atBottomRef.current = true;
    getMessages(selected.id).then((result) => {
      if (!active) return;
      const merged = mergeMessages([], result);
      setMessages(merged);
      setConversations((current) => ({ ...current, [selected.id]: merged }));
      setLoadingMessages(false);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }));
    }).catch(() => setLoadingMessages(false));
    return () => { active = false; };
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    let active = true;
    const poll = async () => {
      if (document.visibilityState !== "visible") return;
      const lastId = Math.max(0, ...messages.filter((message) => message.id > 0).map((message) => message.id));
      try {
        const fresh = await getMessages(selected.id, lastId);
        if (!active || fresh.length === 0) return;
        setMessages((current) => mergeMessages(current, fresh));
        setConversations((current) => ({ ...current, [selected.id]: mergeMessages(current[selected.id] ?? [], fresh) }));
        if (atBottomRef.current) {
          requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }));
        } else {
          setShowNewMessages(true);
        }
      } catch {
        // Polling retries on the next interval.
      }
    };
    const timer = window.setInterval(poll, 2500);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [messages, selected]);

  useEffect(() => {
    if (messages.length > messageCountRef.current && atBottomRef.current) {
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }));
    }
    messageCountRef.current = messages.length;
  }, [messages]);

  function updateMessages(next: (current: Message[]) => Message[]) {
    setMessages((current) => {
      const updated = next(current);
      if (selected) setConversations((all) => ({ ...all, [selected.id]: updated }));
      return updated;
    });
  }

  async function submitMessage(event?: FormEvent<HTMLFormElement>, retryMessage?: Message) {
    event?.preventDefault();
    if (!selected || !user) return;
    const body = retryMessage?.body ?? draft.trim();
    if (!body) return;

    let temporaryId = retryMessage?.id;
    if (retryMessage) {
      updateMessages((current) => current.map((message) => message.id === retryMessage.id ? { ...message, status: "sending" } : message));
    } else {
      localMessageIdRef.current += 1;
      temporaryId = -localMessageIdRef.current;
      const optimistic: Message = {
        id: temporaryId,
        senderId: user.id,
        receiverId: selected.id,
        body,
        createdAt: new Date().toISOString(),
        status: "sending",
      };
      updateMessages((current) => [...current, optimistic]);
      setDraft("");
    }

    atBottomRef.current = true;
    setShowNewMessages(false);
    try {
      const delivered = await sendMessage(selected.id, body);
      updateMessages((current) => mergeMessages(current.filter((message) => message.id !== temporaryId), [delivered]));
    } catch {
      updateMessages((current) => current.map((message) => message.id === temporaryId ? { ...message, status: "failed" } : message));
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitMessage();
    }
  }

    async function handleBackup() {
    setBackup({ kind: "working" });

    try {
        const result = await requestBackup();
        setBackup(
        result.status === "ok" && result.finishedAt
            ? { kind: "ok", finishedAt: result.finishedAt }
            : { kind: "error" }
        );
    } catch (error) {
        console.error("Backup error:", error);
        setBackup({ kind: "error" });
    }
    }

  async function handleLogout() {
    await signOut();
    router.replace("/login");
  }

  function selectUser(nextUser: User) {
    setLoadingMessages(true);
    setMessages(conversations[nextUser.id] ?? []);
    setShowNewMessages(false);
    setSelected(nextUser);
    setMobileChatOpen(true);
  }

  const filteredUsers = users.filter((other) => other.username.toLowerCase().includes(search.trim().toLowerCase()));
  const backupLabel = backup.kind === "working"
    ? "Memproses…"
    : backup.kind === "ok" && backup.finishedAt
      ? `Berhasil · ${formatBackupTime(backup.finishedAt)} WIB`
      : backup.kind === "error"
        ? "Gagal"
        : "Belum diminta";

  if (!ready || !user) {
    return <main className="empty-state"><span className="loading-label">Memeriksa sesi…</span></main>;
  }

  return (
    <main className={`chat-layout${mobileChatOpen ? " mobile-chat-open" : ""}`}>
      <aside className="sidebar" aria-label="Daftar percakapan">
        <div className="sidebar-top">
          <p className="wordmark">obrolan.</p>
          <div className="identity-row">
            <span className="avatar avatar-self" aria-hidden="true">{user.username.slice(0, 1)}</span>
            <div className="identity-copy">
              <span className="identity-label">Masuk sebagai</span>
              <span className="identity-name">{user.username}</span>
            </div>
          </div>
          <div className="sidebar-actions">
            <button className="button" type="button" onClick={() => void handleBackup()} disabled={backup.kind === "working"}>Minta backup</button>
            <button className="button" type="button" onClick={() => void handleLogout()}>Keluar</button>
          </div>
        </div>

        <div className="search-wrap">
          <label className="sr-only" htmlFor="user-search">Cari username</label>
          <input className="form-control search-input" id="user-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari user" />
        </div>

        <div className="user-list" aria-live="polite">
          {loadingUsers ? <p className="loading-label" style={{ padding: "16px 20px" }}>Memuat daftar…</p> : filteredUsers.length ? filteredUsers.map((other) => {
            const thread = conversations[other.id] ?? [];
            const latest = thread.at(-1);
            return (
              <button className={`user-row${selected?.id === other.id ? " user-row-active" : ""}`} key={other.id} type="button" onClick={() => selectUser(other)} aria-current={selected?.id === other.id ? "true" : undefined}>
                <span className="avatar" aria-hidden="true">{other.username.slice(0, 1)}</span>
                <span className="user-copy">
                  <span className="user-name-line">
                    <span className="user-name">{other.username}</span>
                    {latest && <time className="user-time">{formatTime(latest.createdAt)}</time>}
                  </span>
                  <span className="user-preview">{messagePreview(latest)}</span>
                </span>
              </button>
            );
          }) : <p className="loading-label" style={{ padding: "16px 20px" }}>{search ? "User tidak ditemukan." : "Belum ada user lain."}</p>}
        </div>
        <footer className="backup-status" aria-live="polite">
          <span className="backup-label">STATUS BACKUP</span>
          <span className="backup-result">{backupLabel}</span>
        </footer>
      </aside>

      <section className="main-chat" aria-label="Percakapan">
        <header className="chat-header">
          {selected ? (
            <div className="chat-person">
              <button className="back-button" type="button" aria-label="Kembali ke daftar user" onClick={() => setMobileChatOpen(false)}>←</button>
              <span className="avatar" aria-hidden="true">{selected.username.slice(0, 1)}</span>
              <h1>{selected.username}</h1>
            </div>
          ) : <div className="chat-person"><h1>Pesan</h1></div>}
          <div className="server-clock"><span>Jam server</span>{formatTime(now)} WIB</div>
        </header>

        <div className="message-area" ref={scrollRef} onScroll={(event) => {
          const element = event.currentTarget;
          atBottomRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 72;
          if (atBottomRef.current) setShowNewMessages(false);
        }}>
          {!selected ? (
            <div className="empty-state"><p>Pilih user untuk mulai chat.</p></div>
          ) : loadingMessages ? (
            <div className="empty-state"><span className="loading-label">Memuat pesan…</span></div>
          ) : messages.length === 0 ? (
            <div className="empty-state"><p>Belum ada pesan. Mulai percakapan dengan {selected.username}.</p></div>
          ) : (
            <div className="message-stack" aria-live="polite">
              {messages.map((message, index) => {
                const own = message.senderId === user.id;
                const previous = messages[index - 1];
                const newDay = !previous || formatDateLabel(previous.createdAt, now) !== formatDateLabel(message.createdAt, now) || new Date(previous.createdAt).toDateString() !== new Date(message.createdAt).toDateString();
                const state = message.status ?? "sent";
                return (
                  <div key={message.id}>
                    {newDay && <div className="date-divider"><span>{formatDateLabel(message.createdAt, now)}</span></div>}
                    <div className={`message-row${own ? " message-row-own" : ""}${state === "sending" ? " message-row-sending" : ""}${state === "failed" ? " message-row-failed" : ""}`}>
                      <div className="message-bubble">{message.body}</div>
                      <div className="message-meta">
                        <time>{formatTime(message.createdAt)}</time>
                        {own && <span>· {state === "sending" ? "Mengirim…" : state === "failed" ? "Gagal terkirim" : "Terkirim"}</span>}
                        {own && state === "failed" && <button className="retry-button" type="button" onClick={() => void submitMessage(undefined, message)}>Kirim ulang</button>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {showNewMessages && <button className="new-messages-button" type="button" onClick={() => {
            scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
            atBottomRef.current = true;
            setShowNewMessages(false);
          }}>Pesan baru</button>}
        </div>

        <form className="composer" onSubmit={(event) => void submitMessage(event)}>
          <label className="sr-only" htmlFor="message-input">Ketik pesan</label>
          <div className="composer-row">
            <textarea className="form-control message-input" id="message-input" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleComposerKeyDown} placeholder={selected ? "Tulis pesan…" : "Pilih user untuk mulai chat"} disabled={!selected} rows={1} />
            <button className="button button-primary" type="submit" disabled={!selected || !draft.trim()}>Kirim</button>
          </div>
          <span className="composer-hint">Enter kirim · Shift+Enter baris baru</span>
        </form>
      </section>
    </main>
  );
}