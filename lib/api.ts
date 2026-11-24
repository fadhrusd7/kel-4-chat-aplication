import type { LoginData, Message, RegisterData, User } from "@/lib/types";

const SESSION_KEY = "obrolan.mock-user";
const wait = () => new Promise<void>((resolve) => setTimeout(resolve, 300 + Math.random() * 300));

const users: User[] = [
  { id: 1, username: "andi", email: "andi@example.test" },
  { id: 2, username: "budi", email: "budi@example.test" },
  { id: 3, username: "citra", email: "citra@example.test" },
];

const initialMessages: Message[] = [
  { id: 1, senderId: 2, receiverId: 1, body: "Hai, sudah sempat lihat catatan kuliah kemarin?", createdAt: "2026-11-22T13:14:00+07:00" },
  { id: 2, senderId: 1, receiverId: 2, body: "Sudah. Bagian konsistensi data menarik juga.", createdAt: "2026-11-22T13:19:00+07:00", status: "sent" },
  { id: 3, senderId: 2, receiverId: 1, body: "Betul, nanti kita bahas setelah kelas ya.", createdAt: "2026-11-23T09:05:00+07:00" },
  { id: 4, senderId: 3, receiverId: 1, body: "Halo Andi! Ada waktu buat diskusi tugas?", createdAt: "2026-11-23T10:42:00+07:00" },
  { id: 5, senderId: 1, receiverId: 3, body: "Bisa, sore ini aku sudah selesai kelas.", createdAt: "2026-11-23T10:48:00+07:00", status: "sent" },
  { id: 6, senderId: 2, receiverId: 1, body: "Pagi! Aku kirim rangkuman yang kemarin.", createdAt: "2026-11-24T08:12:00+07:00" },
];

let messages = initialMessages;
let nextUserId = 4;
let nextMessageId = 7;
const failedOnceBodies = new Set<string>();

function currentUser(): User | null {
  if (typeof window === "undefined") return null;
  const id = Number(window.localStorage.getItem(SESSION_KEY));
  return users.find((user) => user.id === id) ?? null;
}

export async function register(data: RegisterData): Promise<void> {
  await wait();
  if (users.some((user) => user.username.toLowerCase() === data.username.toLowerCase())) {
    throw new Error("Username sudah dipakai.");
  }
  if (users.some((user) => user.email?.toLowerCase() === data.email.toLowerCase())) {
    throw new Error("Email sudah terdaftar.");
  }
  users.push({ id: nextUserId++, username: data.username, email: data.email });
}

export async function login(data: LoginData): Promise<User> {
  await wait();
  const user = users.find((candidate) =>
    candidate.username.toLowerCase() === data.identifier.toLowerCase() ||
    candidate.email?.toLowerCase() === data.identifier.toLowerCase(),
  );
  if (!user || data.password.toLowerCase() === "salah") {
    throw new Error("Username atau password salah.");
  }
  window.localStorage.setItem(SESSION_KEY, String(user.id));
  return user;
}

export async function logout(): Promise<void> {
  await wait();
  window.localStorage.removeItem(SESSION_KEY);
}

export async function getMe(): Promise<User | null> {
  await wait();
  return currentUser();
}

export async function getUsers(): Promise<User[]> {
  await wait();
  const me = currentUser();
  return users.filter((user) => user.id !== me?.id);
}

export async function getMessages(withUserId: number, afterId = 0): Promise<Message[]> {
  await wait();
  const me = currentUser();
  if (!me) return [];
  return messages.filter((message) =>
    message.id > afterId &&
    ((message.senderId === me.id && message.receiverId === withUserId) ||
      (message.senderId === withUserId && message.receiverId === me.id)),
  );
}

export async function sendMessage(receiverId: number, body: string): Promise<Message> {
  await wait();
  const me = currentUser();
  if (!me) throw new Error("Sesi berakhir. Silakan masuk kembali.");
  if (body.trim().toLowerCase().startsWith("/gagal ") && !failedOnceBodies.has(body)) {
    failedOnceBodies.add(body);
    throw new Error("Pesan tidak terkirim.");
  }

  const message: Message = {
    id: nextMessageId++,
    senderId: me.id,
    receiverId,
    body,
    createdAt: new Date().toISOString(),
    status: "sent",
  };
  messages = [...messages, message];

  if (Math.random() < 0.4) {
    const replyId = nextMessageId++;
    window.setTimeout(() => {
      messages = [...messages, {
        id: replyId,
        senderId: receiverId,
        receiverId: me.id,
        body: ["Siap, aku cek dulu ya.", "Oke, terima kasih!", "Menarik, boleh ceritakan lebih lanjut?"][Math.floor(Math.random() * 3)],
        createdAt: new Date().toISOString(),
      }];
    }, 3500);
  }

  return message;
}

export async function requestBackup(): Promise<{ status: "ok" | "error"; finishedAt?: string }> {
  await wait();
  if (Math.random() < 0.08) return { status: "error" };
  return { status: "ok", finishedAt: new Date().toISOString() };
}