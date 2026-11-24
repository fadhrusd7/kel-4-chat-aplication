const WIB_ZONE = "Asia/Jakarta";
let serverTimeOffsetMs = 0;

export function setSyncedServerTime(serverTime: string, measuredAt = Date.now()) {
  const serverTimeMs = Date.parse(serverTime);
  if (Number.isFinite(serverTimeMs)) {
    serverTimeOffsetMs = serverTimeMs - measuredAt;
  }
}

export function getSyncedNow(): Date {
  return new Date(Date.now() + serverTimeOffsetMs);
}

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
