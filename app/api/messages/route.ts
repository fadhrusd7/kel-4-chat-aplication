
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import db from "@/lib/db";

type MessageRow = {
  id: number;
  sender_id: number;
  receiver_id: number;
  body: string;
  created_at: Date | string;
  deleted_at: Date | string | null;
};

// Memeriksa session dan mengambil ID user yang sedang login.
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

// GET: mengambil percakapan dengan user tertentu.
//
// Parameter query yang didukung:
//   with      (wajib) — ID user lawan bicara.
//   afterId   (opsional, legacy) — ambil pesan dengan id > afterId.
//   afterTime (opsional) — ISO 8601 UTC; jika disediakan bersama afterId,
//             menggunakan cursor komposit (created_at, id) dengan overlap
//             2 detik untuk menangkap pesan terlambat-commit.
//
// Strategi cursor:
//   Jika hanya afterId yang ada (atau afterId = 0, afterTime tidak ada):
//     Perilaku legacy — WHERE id > afterId. Aman untuk pemuatan awal.
//
//   Jika afterTime tersedia (polling inkremental):
//     WHERE (created_at > (afterTime - 2 detik))
//       AND (id > 0)
//     Kemudian filter di sisi server untuk hanya mengirim pesan dengan
//     id > afterId ATAU created_at > afterTime (pesan baru sungguh baru),
//     ditambah pesan dengan created_at ANTARA (afterTime - 2s) dan afterTime
//     yang belum pernah dikirim (menangkap terlambat-commit).
//     Deduplication di client oleh mergeMessages() akan menghapus duplikat
//     dari overlap 2 detik.
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

    // Validasi ID user tujuan.
    const receiverId = Number(searchParams.get("with"));
    const afterIdParam = searchParams.get("afterId");
    const afterId = afterIdParam === null ? 0 : Number(afterIdParam);
    // afterTime: timestamp ISO 8601 UTC dari pesan terakhir yang sudah diterima client.
    const afterTimeParam = searchParams.get("afterTime");

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
        {
          success: false,
          message: "Tidak dapat membuka chat dengan diri sendiri",
        },
        { status: 400 }
      );
    }

    // Pastikan user tujuan memang ada.
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

    let messages: unknown[];

    if (afterTimeParam) {
      // ── Mode polling inkremental berbasis timestamp+id cursor ──
      //
      // Ambil pesan dalam jendela [afterTime - 2s, +∞) untuk menangkap
      // pesan yang terlambat commit ke database (race condition TiDB pool).
      // Grace period 2 detik dipilih berdasarkan:
      //   - Interval polling 2,5 detik — satu siklus penuh masih aman.
      //   - Latency TiDB Cloud AWS ap-southeast-1 ke Indonesia umumnya < 50ms.
      //   - Margin konservatif untuk transient network jitter.
      //
      // Pesan duplikat dari overlap akan dieliminasi oleh mergeMessages()
      // di sisi client yang menggunakan Map berbasis id.
      const afterTimeMs = Date.parse(afterTimeParam);
      if (!Number.isFinite(afterTimeMs)) {
        return NextResponse.json(
          { success: false, message: "Parameter afterTime tidak valid" },
          { status: 400 }
        );
      }

      // Format timestamp untuk MySQL: 'YYYY-MM-DD HH:MM:SS.mmm'
      const overlapStart = new Date(afterTimeMs - 2_000);
      const overlapStartSql = overlapStart
        .toISOString()
        .replace("T", " ")
        .replace("Z", "");

      const [rows] = await db.execute(
        `SELECT id, sender_id, receiver_id, body, created_at, deleted_at
         FROM messages
         WHERE ((sender_id = ? AND receiver_id = ?)
            OR (sender_id = ? AND receiver_id = ?))
           AND (created_at >= ? OR deleted_at >= ?)
         ORDER BY created_at ASC, id ASC
         LIMIT 100`,
        [currentUserId, receiverId, receiverId, currentUserId, overlapStartSql, overlapStartSql]
      );
      messages = rows as unknown[];
    } else {
      // ── Mode legacy: id > afterId (dipakai saat pemuatan awal) ──
      const [rows] = await db.execute(
        `SELECT id, sender_id, receiver_id, body, created_at, deleted_at
         FROM messages
         WHERE ((sender_id = ? AND receiver_id = ?)
            OR (sender_id = ? AND receiver_id = ?))
           AND id > ?
         ORDER BY id ASC
         LIMIT 100`,
        [currentUserId, receiverId, receiverId, currentUserId, afterId]
      );
      messages = rows as unknown[];
    }

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

// POST: mengirim pesan.
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

    // Validasi penerima.
    if (!Number.isInteger(receiverId) || receiverId <= 0) {
      return NextResponse.json(
        { success: false, message: "receiverId tidak valid" },
        { status: 400 }
      );
    }

    if (receiverId === currentUserId) {
      return NextResponse.json(
        {
          success: false,
          message: "Tidak dapat mengirim pesan ke diri sendiri",
        },
        { status: 400 }
      );
    }

    // Validasi isi pesan.
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

    // Pastikan penerima tersedia.
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

    // Ambil kembali pesan yang berhasil disimpan.
    const [messageRows] = await db.execute(
      `SELECT id, sender_id, receiver_id, body, created_at, deleted_at
       FROM messages
       WHERE id = ?`,
      [insertResult.insertId]
    );

    const savedMessages = messageRows as Array<{
      id: number | string;
      sender_id: number;
      receiver_id: number;
      body: string;
      created_at: Date | string;
      deleted_at: Date | string | null;
    }>;

    if (savedMessages.length === 0) {
      return NextResponse.json(
        { success: false, message: "Pesan gagal diambil setelah disimpan" },
        { status: 500 }
      );
    }

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

// DELETE: tandai pesan milik user sebagai terhapus.
// Soft delete mempertahankan snapshot sebelum penghapusan agar dapat diuji lewat backup.
export async function DELETE(request: NextRequest) {
  try {
    const currentUserId = await getAuthenticatedUserId(request);

    if (!currentUserId) {
      return NextResponse.json(
        { success: false, message: "Belum login" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const messageId = Number(body.messageId);

    if (!Number.isSafeInteger(messageId) || messageId <= 0) {
      return NextResponse.json(
        { success: false, message: "messageId tidak valid" },
        { status: 400 }
      );
    }

    const [result] = await db.execute(
      `UPDATE messages
       SET deleted_at = UTC_TIMESTAMP(3)
       WHERE id = ?
         AND sender_id = ?
         AND deleted_at IS NULL`,
      [messageId, currentUserId]
    );

    if ((result as { affectedRows: number }).affectedRows === 0) {
      return NextResponse.json(
        { success: false, message: "Pesan tidak ditemukan atau bukan pesanmu" },
        { status: 404 }
      );
    }

    const [rows] = await db.execute(
      `SELECT id, sender_id, receiver_id, body, created_at, deleted_at
       FROM messages
       WHERE id = ?`,
      [messageId]
    );

    const deletedMessages = rows as MessageRow[];
    if (deletedMessages.length === 0) {
      return NextResponse.json(
        { success: false, message: "Pesan terhapus, tetapi gagal dimuat ulang" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: deletedMessages[0] });
  } catch (error) {
    console.error("Delete message error:", error);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan pada server" },
      { status: 500 }
    );
  }
}
