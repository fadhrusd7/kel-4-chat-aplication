import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET() {
  try {
    const [rows] = await db.query(
      "SELECT UTC_TIMESTAMP(3) AS server_time"
    );

    return NextResponse.json({
      success: true,
      message: "Database connected successfully",
      database: rows,
    });
  } catch (error) {
    console.error("Database error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Database connection failed",
      },
      { status: 500 }
    );
  }
}
