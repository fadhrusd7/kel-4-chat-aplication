
import type { LoginData, Message, RegisterData, User } from "@/lib/types";

type ApiError = {
  success?: boolean;
  message?: string;
};

type ApiMessage = {
  id: number;
  sender_id: number;
  receiver_id: number;
  body: string;
  created_at: string;
};

/** Respons lengkap dari /api/health, termasuk metrik RTT Node.js↔TiDB. */
export type HealthResponse = {
  success: boolean;
  message: string;
  database: Array<{ server_time: string }>;
  node_before_ms?: number;
  node_after_ms?: number;
};

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...options,
    cache: options.cache ?? "no-store",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = data as ApiError;
    throw new Error(error.message || `Request gagal (${response.status})`);
  }

  return data as T;
}

function mapMessage(message: ApiMessage): Message {
  return {
    id: message.id,
    senderId: message.sender_id,
    receiverId: message.receiver_id,
    body: message.body,
    createdAt: message.created_at,
    status: "sent",
  };
}

export async function register(data: RegisterData): Promise<void> {
  await apiFetch("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function login(data: LoginData): Promise<User> {
  const result = await apiFetch<{ user: User }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(data),
  });

  return result.user;
}

export async function logout(): Promise<void> {
  await apiFetch("/api/auth/logout", {
    method: "POST",
  });
}

export async function getMe(): Promise<User | null> {
  const response = await fetch("/api/me", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  if (response.status === 401) {
    return null;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = data as ApiError;
    throw new Error(error.message || "Gagal memeriksa sesi login.");
  }

  return (data as { user: User }).user;
}

/**
 * Mengambil waktu server TiDB beserta metrik RTT Node.js↔TiDB.
 * Mengembalikan HealthResponse agar caller dapat menerapkan
 * Cristian's Algorithm yang lebih akurat di setSyncedServerTime().
 */
export async function getServerHealth(): Promise<HealthResponse> {
  const result = await apiFetch<HealthResponse>("/api/health", { method: "GET" });
  const serverTime = result.database?.[0]?.server_time;
  if (!serverTime || Number.isNaN(Date.parse(serverTime))) {
    throw new Error("Waktu dari database tidak valid.");
  }
  return result;
}

/** @deprecated Gunakan getServerHealth() untuk mendapatkan metrik RTT. */
export async function getServerTime(): Promise<string> {
  const health = await getServerHealth();
  return health.database[0].server_time;
}

export async function getUsers(): Promise<User[]> {
  const result = await apiFetch<{ users: User[] }>("/api/users");
  return result.users;
}

/**
 * Mengambil pesan dalam percakapan dengan pengguna tertentu.
 *
 * @param withUserId  ID user lawan bicara.
 * @param afterId     (legacy) Hanya ambil pesan dengan id > afterId.
 * @param afterTime   ISO 8601 UTC dari timestamp pesan terakhir yang sudah
 *                    diterima client. Jika diisi, API menggunakan cursor
 *                    berbasis (created_at, id) dengan overlap 2 detik untuk
 *                    menangkap pesan yang terlambat commit.
 */
export async function getMessages(
  withUserId: number,
  afterId = 0,
  afterTime?: string
): Promise<Message[]> {
  const params = new URLSearchParams({
    with: String(withUserId),
    afterId: String(afterId),
  });

  if (afterTime) {
    params.set("afterTime", afterTime);
  }

  const result = await apiFetch<{ messages: ApiMessage[] }>(
    `/api/messages?${params.toString()}`
  );

  return result.messages.map(mapMessage);
}

export async function sendMessage(
  receiverId: number,
  body: string
): Promise<Message> {
  const result = await apiFetch<{ data: ApiMessage }>("/api/messages", {
    method: "POST",
    body: JSON.stringify({ receiverId, body }),
  });

  return mapMessage(result.data);
}

// Implement backup request to the server.
export async function requestBackup(): Promise<{
  status: "ok" | "error";
  finishedAt?: string;
}> {
  // Call the backup API endpoint. It performs the dump and returns status.
  const result = await apiFetch<{ status: "ok" | "error"; finishedAt?: string }>(
    "/api/backup",
    { method: "POST" }
  );
  return result;
}
