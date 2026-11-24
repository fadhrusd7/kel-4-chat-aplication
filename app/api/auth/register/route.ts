import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import db from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const username = String(body.username || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    // Validasi input
    if (!username || !email || !password) {
      return NextResponse.json(
        {
          success: false,
          message: "Username, email, dan password wajib diisi",
        },
        { status: 400 }
      );
    }

    if (username.length < 3 || username.length > 50) {
      return NextResponse.json(
        {
          success: false,
          message: "Username harus 3-50 karakter",
        },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        {
          success: false,
          message: "Password minimal 8 karakter",
        },
        { status: 400 }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        {
          success: false,
          message: "Format email tidak valid",
        },
        { status: 400 }
      );
    }

    // Hash password sebelum disimpan
    const passwordHash = await bcrypt.hash(password, 12);

    // Simpan user ke database
    const [result] = await db.execute(
      `INSERT INTO users (username, email, password_hash)
       VALUES (?, ?, ?)`,
      [username, email, passwordHash]
    );

    const insertResult = result as { insertId: number };

    return NextResponse.json(
      {
        success: true,
        message: "Registrasi berhasil",
        user: {
          id: insertResult.insertId,
          username,
          email,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    const dbError = error as { code?: string };

    if (dbError.code === "ER_DUP_ENTRY") {
      return NextResponse.json(
        {
          success: false,
          message: "Username atau email sudah digunakan",
        },
        { status: 409 }
      );
    }

    console.error("Register error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Terjadi kesalahan pada server",
      },
      { status: 500 }
    );
  }
}
