import { promises as fsp } from "fs";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import crypto from "crypto";
import { NextResponse } from "next/server";

// Helper to validate session similar to /api/me
async function validateSession(request: Request): Promise<boolean> {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookies = Object.fromEntries(
    cookieHeader.split(";").map((c) => {
      const [k, v] = c.trim().split("=");
      return [k, v];
    })
  );
  const sessionToken = cookies["session_token"];
  if (!sessionToken) return false;

  // Hash token like the server does (sha256 hex)
  const hashed = crypto.createHash("sha256").update(sessionToken).digest("hex");

  // Query the DB via existing route – we reuse fetch to /api/me
  try {
    const resp = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ""}/api/me`, {
      method: "GET",
      credentials: "include",
    });
    return resp.ok;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  // 1️⃣ Authenticate
  if (!(await validateSession(request))) {
    return new NextResponse(JSON.stringify({ status: "error", message: "Unauthenticated" }), { status: 401 });
  }

  // 2️⃣ Prepare dump options file (MySQL client reads credentials from option file)
  const optionLines = [
    `[client]`,
    `host=${process.env.DB_HOST}`,
    `port=${process.env.DB_PORT || 3306}`,
    `user=${process.env.DB_USER}`,
    // password must not appear on command line
    `password=${process.env.DB_PASSWORD}`,
    `protocol=TCP`,
    `ssl-ca=${process.env.MYSQL_SSL_CA || ""}`,
  ];

  const tmpDir = path.join(process.cwd(), "scratch");
  await fsp.mkdir(tmpDir, { recursive: true });

  const optionFilePath = path.join(tmpDir, `my.cnf.${crypto.randomBytes(4).toString("hex")}`);
  await fsp.writeFile(optionFilePath, optionLines.join("\n"), { mode: 0o600 });

  // 3️⃣ Create dump file path
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dumpFileName = `backup_${timestamp}.sql`;
  const dumpFilePath = path.join(tmpDir, dumpFileName);

  // 4️⃣ Spawn mysqldump
  const dumpArgs = [
    `--defaults-extra-file=${optionFilePath}`,
    `--single-transaction`,
    `--quick`,
    `--skip-lock-tables`,
    `${process.env.MYSQL_DB}`,
  ];

  const dumpProcess = spawn("mysqldump", dumpArgs, { windowsHide: true });

  const fileStream = fs.createWriteStream(dumpFilePath);

  // Pipe stdout to file, capture errors
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

  let exitCode: number;
  try {
    [exitCode] = await Promise.all([exitPromise, stdoutPromise]);
  } finally {
    // Ensure temporary option file is removed irrespective of success or failure
    await fsp.unlink(optionFilePath).catch(() => {});
  }

  // 5️⃣ Validate dump
  if (exitCode !== 0) {
    await fsp.unlink(dumpFilePath).catch(() => {});
    return new NextResponse(JSON.stringify({ status: "error", message: "mysqldump failed" }), { status: 500 });
  }

  try {
    const stats = await fsp.stat(dumpFilePath);
    if (stats.size === 0) throw new Error("Empty dump file");
    const content = await fsp.readFile(dumpFilePath, "utf8");
    const requiredTables = ["users", "sessions", "messages"];
    for (const tbl of requiredTables) {
      if (!content.includes(`CREATE TABLE \`${tbl}\``)) {
        throw new Error(`Missing table definition for ${tbl}`);
      }
    }
  } catch (e: any) {
    await fsp.unlink(dumpFilePath).catch(() => {});
    return new NextResponse(JSON.stringify({ status: "error", message: e.message }), { status: 500 });
  }

  // 6️⃣ Send to receiver (if configured)
  const receiverUrl = process.env.BACKUP_RECEIVER_URL;
  const token = process.env.BACKUP_TOKEN;
  if (receiverUrl && token) {
    try {
      const stats = await fsp.stat(dumpFilePath);
      const fileStreamSend = fs.createReadStream(dumpFilePath);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      const resp = await fetch(receiverUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/octet-stream",
          "X-Backup-Filename": dumpFileName,
          "Content-Length": stats.size.toString(),
        },
        body: fileStreamSend as any,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`Receiver responded ${resp.status}: ${err}`);
      }
    } catch (e: any) {
      // Keep dump file for debugging but still report error
      return new NextResponse(JSON.stringify({ status: "error", message: `Upload failed: ${e.message}` }), { status: 502 });
    }
  }

  // 7️⃣ Success response (keep dump file on disk for later inspection)
  return new NextResponse(JSON.stringify({ status: "ok", finishedAt: new Date().toISOString() }));
}
