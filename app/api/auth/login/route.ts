
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes, createHash } from "crypto";
import db from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const identifier = String(body.identifier || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!identifier || !password) {
      return NextResponse.json(
        {
          success: false,
          message: "Username/email dan password wajib diisi",
        },
        { status: 400 }
      );
    }

    // Cari user berdasarkan username atau email
    const [rows] = await db.execute(
      `SELECT id, username, email, password_hash
       FROM users
       WHERE username = ? OR email = ?
       LIMIT 1`,
      [identifier, identifier]
    );

    const users = rows as Array<{
      id: number;
      username: string;
      email: string;
      password_hash: string;
    }>;

    if (users.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Username/email atau password salah",
        },
        { status: 401 }
      );
    }

    const user = users[0];

    // Verifikasi password
    const passwordValid = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordValid) {
      return NextResponse.json(
        {
          success: false,
          message: "Username/email atau password salah",
        },
        { status: 401 }
      );
    }

    // Buat token session acak
    const token = randomBytes(32).toString("hex");

    // Simpan hash token ke database
    const tokenHash = createHash("sha256")
      .update(token)
      .digest("hex");

    // Session berlaku selama 7 hari
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db.execute(
      `INSERT INTO sessions (user_id, token_hash, expires_at)
       VALUES (?, ?, ?)`,
      [user.id, tokenHash, expiresAt]
    );

    const response = NextResponse.json({
      success: true,
      message: "Login berhasil",
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    });

    // Kirim token melalui cookie yang aman
    response.cookies.set("session_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Terjadi kesalahan pada server",
      },
      { status: 500 }
    );
  }
}
