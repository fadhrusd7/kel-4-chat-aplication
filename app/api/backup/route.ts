import { promises as fsp } from "fs";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

// Route Handler memakai Node.js secara default; runtime segment config
// tidak kompatibel dengan cacheComponents pada konfigurasi proyek ini.

function fail(status: number, message: string) {
  return NextResponse.json({ status: "error", message }, { status });
}

// Sesi dicek langsung ke database, sama seperti route users dan messages.
async function hasValidSession(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get("session_token")?.value;
  if (!token) return false;

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const [rows] = await db.execute(
    `SELECT user_id
     FROM sessions
     WHERE token_hash = ?
       AND expires_at > UTC_TIMESTAMP(3)
     LIMIT 1`,
    [tokenHash]
  );
  return (rows as unknown[]).length > 0;
}

export async function POST(request: NextRequest) {
  try {
    if (!(await hasValidSession(request))) {
      return fail(401, "Belum login");
    }
  } catch (error) {
    console.error("Backup session check error:", error);
    return fail(500, "Gagal memeriksa sesi");
  }

  const dbName = process.env.MYSQL_DB || process.env.DB_NAME || "chat";

  // Kredensial dikirim lewat file opsi sementara, bukan argumen perintah.
  const optionLines = [
    "[client]",
    `host=${process.env.DB_HOST || "localhost"}`,
    `port=${process.env.DB_PORT || 3306}`,
    `user=${process.env.DB_USER || "chat"}`,
    `password=${process.env.DB_PASSWORD || ""}`,
    "protocol=TCP",
  ];
  if (process.env.MYSQL_SSL_CA) {
    optionLines.push(`ssl-ca=${process.env.MYSQL_SSL_CA}`);
  }

  const tmpDir = path.join(process.cwd(), "scratch");
  await fsp.mkdir(tmpDir, { recursive: true });

  const optionFilePath = path.join(tmpDir, `my.cnf.${crypto.randomBytes(4).toString("hex")}`);
  await fsp.writeFile(optionFilePath, optionLines.join("\n"), { mode: 0o600 });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dumpFileName = `backup_${timestamp}.sql`;
  const dumpFilePath = path.join(tmpDir, dumpFileName);
  const dumpCommand = process.env.MYSQLDUMP_BIN?.trim()
    || (process.platform === "win32" ? "mysqldump" : "mariadb-dump");
  const isMariaDbDump = /mariadb-dump(?:\.exe)?$/i.test(dumpCommand);

  let exitCode: number;
  let dumpStderr = "";
  try {
    const dumpProcess = spawn(
      dumpCommand,
      [
        `--defaults-extra-file=${optionFilePath}`,
        // Opsi ini hanya dikenal oleh klien mysqldump MySQL, bukan mariadb-dump.
        ...(!isMariaDbDump ? ["--column-statistics=0"] : []),
        "--single-transaction",
        "--quick",
        "--skip-lock-tables",
        dbName,
      ],
      { windowsHide: true }
    );

    // Ambil stderr agar penyebab exit code gagal terlihat di log server.
    dumpProcess.stderr?.setEncoding("utf8");
    dumpProcess.stderr?.on("data", (chunk: string) => {
      if (dumpStderr.length < 8_000) dumpStderr += chunk;
    });

    const fileStream = fs.createWriteStream(dumpFilePath);

    const stdoutPromise = new Promise<void>((resolve, reject) => {
      dumpProcess.stdout?.pipe(fileStream);
      dumpProcess.stdout?.on("error", reject);
      fileStream.on("error", reject);
      fileStream.on("finish", resolve);
    });

    const exitPromise = new Promise<number>((resolve, reject) => {
      dumpProcess.on("error", reject);
      dumpProcess.on("close", (code) => resolve(code ?? 1));
    });

    [exitCode] = await Promise.all([exitPromise, stdoutPromise]);
  } catch (error) {
    await fsp.unlink(dumpFilePath).catch(() => {});
    const code = (error as NodeJS.ErrnoException).code;
    console.error("mysqldump error:", error);
    return fail(
      500,
      code === "ENOENT"
        ? `Perintah ${dumpCommand} tidak ditemukan. Atur MYSQLDUMP_BIN ke lokasi executable dump yang tersedia.`
        : "mysqldump gagal dijalankan"
    );
  } finally {
    // File opsi berisi password: selalu dihapus, berhasil atau tidak.
    await fsp.unlink(optionFilePath).catch(() => {});
  }

  if (exitCode !== 0) {
    await fsp.unlink(dumpFilePath).catch(() => {});
    const detail = dumpStderr.trim();
    console.error("mysqldump exited with code", exitCode, detail);
    return fail(500, detail ? `mysqldump gagal: ${detail}` : "mysqldump gagal tanpa detail dari stderr");
  }

  try {
    const stats = await fsp.stat(dumpFilePath);
    if (stats.size === 0) throw new Error("Hasil dump kosong");
    const content = await fsp.readFile(dumpFilePath, "utf8");
    for (const table of ["users", "sessions", "messages"]) {
      if (!content.includes(`CREATE TABLE \`${table}\``)) {
        throw new Error(`Definisi tabel ${table} tidak ada di hasil dump`);
      }
    }
  } catch (error) {
    await fsp.unlink(dumpFilePath).catch(() => {});
    return fail(500, error instanceof Error ? error.message : "Hasil dump tidak valid");
  }

  // Kirim ke PC backup bila dikonfigurasi.
  const receiverUrl = process.env.BACKUP_RECEIVER_URL;
  const token = process.env.BACKUP_TOKEN;
  if (receiverUrl && token) {
    try {
      const body = await fsp.readFile(dumpFilePath);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      const response = await fetch(receiverUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/octet-stream",
          "X-Backup-Filename": dumpFileName,
        },
        body,
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      if (!response.ok) {
        throw new Error(`PC backup membalas ${response.status}: ${await response.text()}`);
      }
    } catch (error) {
      // File dump tetap disimpan di komputer ini untuk diperiksa.
      return fail(502, `Gagal mengirim ke PC backup: ${error instanceof Error ? error.message : "error"}`);
    }
  }

  return NextResponse.json({ status: "ok", finishedAt: new Date().toISOString() });
}
