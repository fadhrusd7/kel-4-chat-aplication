import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET() {
  // Catat waktu server Node.js tepat sebelum query ke TiDB.
  const nodeTimeBeforeQuery = Date.now();

  try {
    const [rows] = await db.query(
      "SELECT UTC_TIMESTAMP(3) AS server_time"
    );

    // Catat waktu server Node.js setelah respons dari TiDB diterima.
    const nodeTimeAfterQuery = Date.now();

    return NextResponse.json({
      success: true,
      message: "Database connected successfully",
      database: rows,
      // Metrik tambahan untuk Cristian's Algorithm di client:
      // node_before dan node_after memungkinkan client menghitung
      // estimasi latency antara Node.js dan TiDB (db_latency_ms),
      // terpisah dari latency HTTP client ↔ Next.js.
      node_before_ms: nodeTimeBeforeQuery,
      node_after_ms: nodeTimeAfterQuery,
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
