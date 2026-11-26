"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useAuth } from "@/hooks/useAuth";
import { deleteMessage as apiDeleteMessage, getMessages, getServerHealth, getUsers, requestBackup, sendMessage } from "@/lib/api";
import { formatBackupTime, formatDateLabel, formatTime, getSyncedNow, setSyncedServerTime } from "@/lib/time";
import type { Message, User } from "@/lib/types";

type BackupState = { kind: "idle" | "working" | "ok" | "error"; finishedAt?: string };

function messageActivityTime(message: Message) {
  return message.deletedAt ?? message.createdAt;
}

function latestActivity(messages: Message[]) {
  return messages.reduce<Message | undefined>((latest, message) => {
    if (!latest || Date.parse(messageActivityTime(message)) > Date.parse(messageActivityTime(latest))) {
      return message;
    }
    return latest;
  }, undefined);
}

function mergeMessages(current: Message[], incoming: Message[]) {
  const byId = new Map(current.map((message) => [message.id, message]));
  incoming.forEach((message) => byId.set(message.id, message));
  // Urutan primer: created_at (jam server TiDB). Urutan sekunder: id.
  // Ini memastikan pesan yang terlambat commit tetap tampil di posisi yang benar.
  return [...byId.values()].sort((a, b) => {
    const tA = Date.parse(a.createdAt);
    const tB = Date.parse(b.createdAt);
    if (tA !== tB) return tA - tB;
    return a.id - b.id;
  });
}

function changedMessages(current: Message[], incoming: Message[]) {
  const previousById = new Map(current.map((message) => [message.id, message]));
  return incoming.filter((message) => {
    const previous = previousById.get(message.id);
    return !previous || previous.deletedAt !== message.deletedAt || previous.body !== message.body;
  });
}

function messagePreview(message?: Message) {
  if (!message) return "Belum ada pesan";
  if (message.deletedAt) return "Pesan ini telah dihapus";
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
  const [deletingMessageId, setDeletingMessageId] = useState<number | null>(null);
  const [messageActionError, setMessageActionError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const messageCountRef = useRef(0);
  const localMessageIdRef = useRef(0);
  const conversationsRef = useRef(conversations);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

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
    let active = true;
    const synchronize = async () => {
      const sentAt = Date.now();
      try {
        const health = await getServerHealth();
        const receivedAt = Date.now();
        const serverTime = health.database?.[0]?.server_time;
        if (serverTime) {
          // Terapkan Cristian's Algorithm yang ditingkatkan:
          // jika node_before_ms dan node_after_ms tersedia, offset lebih akurat
          // karena memisahkan latency HTTP dari latency Node.js↔TiDB.
          setSyncedServerTime(
            serverTime,
            sentAt,
            receivedAt,
            health.node_before_ms,
            health.node_after_ms
          );
        }
      } catch {
        // Keep the last known server offset; use the device clock before the first sync.
      }
      if (active) setNow(getSyncedNow());
    };
    void synchronize();
    const timer = window.setInterval(() => void synchronize(), 30_000);
    return () => {
      active = false;
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
      // Ambil semua pesan yang sudah masuk (tidak termasuk optimistic/local).
      const confirmedMessages = messages.filter((m) => m.id > 0);
      // Cursor untuk polling:
      //   afterId   — ID pesan terakhir yang sudah dikonfirmasi server.
      //   afterTime — timestamp ISO 8601 UTC pesan terakhir yang dikonfirmasi.
      //               Dikirim ke API sebagai anchor untuk overlap 2 detik.
      const lastId = confirmedMessages.length > 0
        ? Math.max(...confirmedMessages.map((m) => m.id))
        : 0;
      const latestConfirmed = latestActivity(confirmedMessages);
      const lastConfirmedTime = latestConfirmed ? messageActivityTime(latestConfirmed) : undefined;
      try {
        const fresh = await getMessages(selected.id, lastId, lastConfirmedTime);
        if (!active || fresh.length === 0) return;
        const changed = changedMessages(messages, fresh);
        if (changed.length === 0) return;
        setMessages((current) => mergeMessages(current, changed));
        setConversations((current) => ({
          ...current,
          [selected.id]: mergeMessages(current[selected.id] ?? [], changed),
        }));
        if (atBottomRef.current) {
          requestAnimationFrame(() =>
            scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
          );
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

  // Refresh sidebar previews for conversations that are not currently open.
  useEffect(() => {
    if (!ready || !user || users.length === 0) return;

    let active = true;
    let polling = false;

    const pollSidebar = async () => {
      if (polling || document.visibilityState !== "visible") return;

      polling = true;
      try {
        const otherUsers = users.filter((other) => other.id !== selected?.id);
        const updates = await Promise.all(otherUsers.map(async (other) => {
          const knownMessages = conversationsRef.current[other.id] ?? [];
          const confirmed = knownMessages.filter((message) => message.id > 0);
          const lastId = confirmed.length > 0
            ? Math.max(...confirmed.map((message) => message.id))
            : 0;
          const latest = latestActivity(confirmed);
          const lastTime = latest ? messageActivityTime(latest) : undefined;

          const fresh = await getMessages(other.id, lastId, lastTime);
          return { userId: other.id, fresh };
        }));

        if (!active) return;
        setConversations((current) => {
          let changed = false;
          const next = { ...current };
          for (const { userId, fresh } of updates) {
            const changedMessagesForThread = changedMessages(next[userId] ?? [], fresh);
            if (changedMessagesForThread.length === 0) continue;
            next[userId] = mergeMessages(next[userId] ?? [], changedMessagesForThread);
            changed = true;
          }
          return changed ? next : current;
        });
      } catch {
        // Retry on the next interval; keep the current previews visible.
      } finally {
        polling = false;
      }
    };

    const timer = window.setInterval(() => void pollSidebar(), 2500);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [ready, user, users, selected?.id]);

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

  async function removeMessage(message: Message) {
    if (!user || message.senderId !== user.id || message.id <= 0 || message.deletedAt) return;
    setDeletingMessageId(message.id);
    setMessageActionError("");
    try {
      const deleted = await apiDeleteMessage(message.id);
      updateMessages((current) => mergeMessages(current, [deleted]));
    } catch {
      setMessageActionError("Pesan gagal dihapus. Coba lagi.");
    } finally {
      setDeletingMessageId(null);
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

  const filteredUsers = users
    .filter((other) => other.username.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((first, second) => {
      const firstLatest = latestActivity(conversations[first.id] ?? []);
      const secondLatest = latestActivity(conversations[second.id] ?? []);
      if (!firstLatest && !secondLatest) return first.username.localeCompare(second.username);
      if (!firstLatest) return 1;
      if (!secondLatest) return -1;
      const byTime = Date.parse(messageActivityTime(secondLatest)) - Date.parse(messageActivityTime(firstLatest));
      return byTime || first.username.localeCompare(second.username);
    });
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
            const latest = latestActivity(thread);
            return (
              <button className={`user-row${selected?.id === other.id ? " user-row-active" : ""}`} key={other.id} type="button" onClick={() => selectUser(other)} aria-current={selected?.id === other.id ? "true" : undefined}>
                <span className="avatar" aria-hidden="true">{other.username.slice(0, 1)}</span>
                <span className="user-copy">
                  <span className="user-name-line">
                    <span className="user-name">{other.username}</span>
                    {latest && <time className="user-time">{formatTime(messageActivityTime(latest))}</time>}
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
                      <div className={`message-bubble${message.deletedAt ? " message-bubble-deleted" : ""}`}>
                        {message.deletedAt ? "Pesan ini telah dihapus." : message.body}
                      </div>
                      <div className="message-meta">
                        <time>{formatTime(message.createdAt)}</time>
                        {own && <span>· {state === "sending" ? "Mengirim…" : state === "failed" ? "Gagal terkirim" : "Terkirim"}</span>}
                        {own && state === "failed" && <button className="retry-button" type="button" onClick={() => void submitMessage(undefined, message)}>Kirim ulang</button>}
                        {own && state === "sent" && !message.deletedAt && message.id > 0 && <button className="delete-message-button" type="button" disabled={deletingMessageId === message.id} onClick={() => void removeMessage(message)}>{deletingMessageId === message.id ? "Menghapus…" : "Hapus"}</button>}
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
          {messageActionError && <span className="message-action-error" role="alert">{messageActionError}</span>}
        </form>
      </section>
    </main>
  );
}
