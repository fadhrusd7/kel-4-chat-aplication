
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import db from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    // Periksa session
    const token = request.cookies.get("session_token")?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Belum login" },
        { status: 401 }
      );
    }

    const tokenHash = createHash("sha256")
      .update(token)
      .digest("hex");

    // Pastikan session valid dan ambil ID user yang login
    const [sessionRows] = await db.execute(
      `SELECT user_id
       FROM sessions
       WHERE token_hash = ?
         AND expires_at > UTC_TIMESTAMP(3)
       LIMIT 1`,
      [tokenHash]
    );

    const sessions = sessionRows as Array<{ user_id: number }>;

    if (sessions.length === 0) {
      return NextResponse.json(
        { success: false, message: "Session tidak valid atau kedaluwarsa" },
        { status: 401 }
      );
    }

    const currentUserId = sessions[0].user_id;

    // Ambil semua user selain user yang sedang login
    const [userRows] = await db.execute(
      `SELECT id, username
       FROM users
       WHERE id != ?
       ORDER BY username ASC`,
      [currentUserId]
    );

    return NextResponse.json({
      success: true,
      users: userRows,
    });
  } catch (error) {
    console.error("Users API error:", error);

    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan pada server" },
      { status: 500 }
    );
  }
}
