
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import db from "@/lib/db";

async function getAuthenticatedUserId(request: NextRequest) {
  const token = request.cookies.get("session_token")?.value;

  if (!token) return null;

  const tokenHash = createHash("sha256")
    .update(token)
    .digest("hex");

  const [rows] = await db.execute(
    `SELECT user_id
     FROM sessions
     WHERE token_hash = ?
       AND expires_at > UTC_TIMESTAMP(3)
     LIMIT 1`,
    [tokenHash]
  );

  const sessions = rows as Array<{ user_id: number }>;

  return sessions.length > 0 ? sessions[0].user_id : null;
}

// GET: mengambil percakapan dengan user tertentu
export async function GET(request: NextRequest) {
  try {
    const currentUserId = await getAuthenticatedUserId(request);

    if (!currentUserId) {
      return NextResponse.json(
        { success: false, message: "Belum login" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const receiverId = Number(searchParams.get("with"));
    const afterId = Number(searchParams.get("afterId") || 0);

    if (!Number.isInteger(receiverId) || receiverId <= 0) {
      return NextResponse.json(
        { success: false, message: "Parameter with tidak valid" },
        { status: 400 }
      );
    }

    if (!Number.isSafeInteger(afterId) || afterId < 0) {
      return NextResponse.json(
        { success: false, message: "Parameter afterId tidak valid" },
        { status: 400 }
      );
    }

    if (receiverId === currentUserId) {
      return NextResponse.json(
        { success: false, message: "Tidak dapat membuka chat dengan diri sendiri" },
        { status: 400 }
      );
    }

    // Pastikan user tujuan memang ada
    const [userRows] = await db.execute(
      "SELECT id FROM users WHERE id = ? LIMIT 1",
      [receiverId]
    );

    if ((userRows as unknown[]).length === 0) {
      return NextResponse.json(
        { success: false, message: "User tidak ditemukan" },
        { status: 404 }
      );
    }

    // Ambil pesan dua arah antara kedua user
    const [messages] = await db.execute(
      `SELECT id, sender_id, receiver_id, body, created_at
       FROM messages
       WHERE ((sender_id = ? AND receiver_id = ?)
          OR (sender_id = ? AND receiver_id = ?))
         AND id > ?
       ORDER BY id ASC
       LIMIT 100`,
      [currentUserId, receiverId, receiverId, currentUserId, afterId]
    );

    return NextResponse.json({
      success: true,
      messages,
    });
  } catch (error) {
    console.error("Get messages error:", error);

    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan pada server" },
      { status: 500 }
    );
  }
}

// POST: mengirim pesan
export async function POST(request: NextRequest) {
  try {
    const currentUserId = await getAuthenticatedUserId(request);

    if (!currentUserId) {
      return NextResponse.json(
        { success: false, message: "Belum login" },
        { status: 401 }
      );
    }

    const body = await request.json();

    const receiverId = Number(body.receiverId);
    const messageBody = String(body.body || "").trim();

    if (!Number.isInteger(receiverId) || receiverId <= 0) {
      return NextResponse.json(
        { success: false, message: "receiverId tidak valid" },
        { status: 400 }
      );
    }

    if (receiverId === currentUserId) {
      return NextResponse.json(
        { success: false, message: "Tidak dapat mengirim pesan ke diri sendiri" },
        { status: 400 }
      );
    }

    if (!messageBody) {
      return NextResponse.json(
        { success: false, message: "Pesan tidak boleh kosong" },
        { status: 400 }
      );
    }

    if (messageBody.length > 5000) {
      return NextResponse.json(
        { success: false, message: "Pesan maksimal 5000 karakter" },
        { status: 400 }
      );
    }

    // Pastikan penerima tersedia
    const [userRows] = await db.execute(
      "SELECT id FROM users WHERE id = ? LIMIT 1",
      [receiverId]
    );

    if ((userRows as unknown[]).length === 0) {
      return NextResponse.json(
        { success: false, message: "Penerima tidak ditemukan" },
        { status: 404 }
      );
    }

    // Simpan pesan. created_at diisi oleh database.
    const [result] = await db.execute(
      `INSERT INTO messages (sender_id, receiver_id, body)
       VALUES (?, ?, ?)`,
      [currentUserId, receiverId, messageBody]
    );

    const insertResult = result as { insertId: number | bigint };

    const [messageRows] = await db.execute(
      `SELECT id, sender_id, receiver_id, body, created_at
       FROM messages
       WHERE id = ?`,
      [insertResult.insertId]
    );

    const savedMessages = messageRows as Array<{
      id: number | string;
      sender_id: number;
      receiver_id: number;
      body: string;
      created_at: Date;
    }>;

    return NextResponse.json(
      {
        success: true,
        message: "Pesan berhasil dikirim",
        data: savedMessages[0],
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Send message error:", error);

    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan pada server" },
      { status: 500 }
    );
  }
}
