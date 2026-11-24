
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import db from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    // Ambil token dari cookie
    const token = request.cookies.get("session_token")?.value;

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          message: "Belum login",
        },
        { status: 401 }
      );
    }

    // Hash token untuk dicocokkan dengan database
    const tokenHash = createHash("sha256")
      .update(token)
      .digest("hex");

    // Cari session yang belum kedaluwarsa
    const [rows] = await db.execute(
      `SELECT users.id, users.username, users.email
       FROM sessions
       JOIN users ON sessions.user_id = users.id
       WHERE sessions.token_hash = ?
         AND sessions.expires_at > UTC_TIMESTAMP(3)
       LIMIT 1`,
      [tokenHash]
    );

    const users = rows as Array<{
      id: number;
      username: string;
      email: string;
    }>;

    if (users.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Session tidak valid atau sudah kedaluwarsa",
        },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      user: users[0],
    });
  } catch (error) {
    console.error("Me API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Terjadi kesalahan pada server",
      },
      { status: 500 }
    );
  }
}
