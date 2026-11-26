const WIB_ZONE = "Asia/Jakarta";

// Offset antara jam lokal client dan jam server TiDB (dalam ms).
// Nilainya diperbarui oleh setSyncedServerTime() setiap 30 detik.
// Nol sebelum sinkronisasi pertama: berarti jam lokal digunakan sementara.
let serverTimeOffsetMs = 0;

/**
 * Memperbarui estimasi offset waktu antara client dan server menggunakan
 * pendekatan Cristian's Algorithm:
 *
 *   T_estimasi = T_server + RTT/2
 *   offset     = T_estimasi - T_lokal_saat_terima_respons
 *
 * Parameter:
 *   serverTime  — string ISO 8601 UTC dari UTC_TIMESTAMP(3) TiDB Cloud.
 *   sentAt      — Date.now() tepat sebelum fetch dikirim ke /api/health.
 *   receivedAt  — Date.now() tepat setelah respons /api/health diterima.
 *   nodeBeforeMs — timestamp Node.js sebelum query ke TiDB (dari response body).
 *   nodeAfterMs  — timestamp Node.js setelah query ke TiDB (dari response body).
 *
 * Jika nodeBeforeMs/nodeAfterMs tersedia, server_time sudah mencerminkan
 * titik tengah antara node_before dan node_after sehingga offset lebih akurat:
 *   T_db  = T_server
 *   T_mid = (nodeBeforeMs + nodeAfterMs) / 2   ← titik ketika TiDB membaca jam
 *   RTT   = receivedAt - sentAt
 *   server_at_receive ≈ T_db + (receivedAt - T_mid)
 *   offset = server_at_receive - receivedAt
 *           = T_db - T_mid
 *
 * Jika metrik Node.js tidak tersedia, fallback ke RTT/2 biasa.
 */
export function setSyncedServerTime(
  serverTime: string,
  sentAt: number,
  receivedAt: number,
  nodeBeforeMs?: number,
  nodeAfterMs?: number
): void {
  const serverMs = Date.parse(serverTime);
  if (!Number.isFinite(serverMs)) return;

  let newOffset: number;

  if (
    typeof nodeBeforeMs === "number" &&
    typeof nodeAfterMs === "number" &&
    nodeAfterMs >= nodeBeforeMs
  ) {
    // Gunakan titik tengah query TiDB di Node.js sebagai referensi.
    // Ini menghilangkan variabel latency Node.js→TiDB dari kalkulasi.
    const nodeMid = (nodeBeforeMs + nodeAfterMs) / 2;
    // Perkiraan: kapan (dalam waktu server) respons HTTP diterima client
    const dbLatencyHalf = (nodeAfterMs - nodeBeforeMs) / 2;
    // server_time diambil di titik T_mid, jadi pada saat receivedAt:
    //   server_now ≈ serverMs + (receivedAt - nodeMid)
    //   offset = server_now - receivedAt = serverMs - nodeMid
    // Tambahkan setengah latency DB untuk koreksi finer:
    newOffset = serverMs - nodeMid + dbLatencyHalf;
  } else {
    // Fallback: Cristian's Algorithm sederhana — server_time di titik tengah RTT.
    const rtt = receivedAt - sentAt;
    const estimatedServerAtMid = serverMs + rtt / 2;
    newOffset = estimatedServerAtMid - receivedAt;
  }

  // Terapkan filter untuk mencegah jam tampilan bergerak mundur secara tiba-tiba.
  // Jika offset baru berbeda lebih dari 5 detik dari offset sekarang,
  // terapkan langsung (kemungkinan jam device berubah atau sinkronisasi pertama).
  // Jika lebih kecil, lakukan smooth step (rata-rata berbobot 80/20)
  // agar transisi bertahap.
  const delta = Math.abs(newOffset - serverTimeOffsetMs);
  if (serverTimeOffsetMs === 0 || delta > 5_000) {
    serverTimeOffsetMs = newOffset;
  } else {
    serverTimeOffsetMs = 0.8 * serverTimeOffsetMs + 0.2 * newOffset;
  }
}

/**
 * Mengembalikan perkiraan waktu server saat ini berdasarkan offset terakhir.
 * Gunakan ini untuk semua keperluan yang memerlukan "sekarang menurut server".
 */
export function getSyncedNow(): Date {
  return new Date(Date.now() + serverTimeOffsetMs);
}

/**
 * Format jam menjadi HH:mm dalam zona WIB (UTC+7).
 * Menerima string ISO 8601 atau objek Date.
 */
export function formatTime(iso: string | Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: WIB_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(typeof iso === "string" ? new Date(iso) : iso);
  return `${parts.find((part) => part.type === "hour")?.value}:${parts.find((part) => part.type === "minute")?.value}`;
}

function wibDateKey(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: WIB_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`;
}

export function formatDateLabel(iso: string, referenceDate = getSyncedNow()): string {
  const dateKey = wibDateKey(iso);
  const todayKey = wibDateKey(referenceDate);
  const yesterday = new Date(`${todayKey}T12:00:00+07:00`);
  yesterday.setDate(yesterday.getDate() - 1);

  if (dateKey === todayKey) return "Hari ini";
  if (dateKey === wibDateKey(yesterday)) return "Kemarin";

  return new Intl.DateTimeFormat("id-ID", {
    timeZone: WIB_ZONE,
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}

export function formatBackupTime(iso: string): string {
  const date = new Intl.DateTimeFormat("id-ID", {
    timeZone: WIB_ZONE,
    day: "2-digit",
    month: "short",
  }).format(new Date(iso));
  return `${date}, ${formatTime(iso)}`;
}
