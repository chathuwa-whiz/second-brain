import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb, isPgConfigured } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any)?.id;
  let conn: any;
  try {
    conn = await getDb();
    if (isPgConfigured()) {
      const res = await conn.query(
        `SELECT value FROM system_settings WHERE key = 'user_profile' AND user_id = $1`,
        [userId]
      );
      if (!res.rows || res.rows.length === 0) {
        return NextResponse.json({ profile: null });
      }
      const raw = res.rows[0].value;
      const profile = typeof raw === "string" ? JSON.parse(raw) : raw;
      return NextResponse.json({ profile });
    } else {
      const res: any = await conn.execute(
        `SELECT value FROM system_settings WHERE key = 'user_profile' AND user_id = :userId`,
        { userId }
      );
      if (!res.rows || res.rows.length === 0) {
        return NextResponse.json({ profile: null });
      }
      const raw = res.rows[0].VALUE || res.rows[0].value;
      const profile = typeof raw === "string" ? JSON.parse(raw) : raw;
      return NextResponse.json({ profile });
    }
  } catch (err) {
    console.error("GET /api/user/profile error:", err);
    return NextResponse.json({ profile: null });
  } finally {
    if (conn) {
      if (typeof conn.release === "function") conn.release();
      else if (typeof conn.close === "function") await conn.close();
    }
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any)?.id;
  let conn: any;
  try {
    const body = await req.json();
    conn = await getDb();

    // Fetch existing profile to merge updates
    let existingProfile: any = {};
    if (isPgConfigured()) {
      const res = await conn.query(
        `SELECT value FROM system_settings WHERE key = 'user_profile' AND user_id = $1`,
        [userId]
      );
      if (res.rows && res.rows.length > 0) {
        const raw = res.rows[0].value;
        existingProfile = typeof raw === "string" ? JSON.parse(raw) : raw;
      }
    } else {
      const res: any = await conn.execute(
        `SELECT value FROM system_settings WHERE key = 'user_profile' AND user_id = :userId`,
        { userId }
      );
      if (res.rows && res.rows.length > 0) {
        const raw = res.rows[0].VALUE || res.rows[0].value;
        existingProfile = typeof raw === "string" ? JSON.parse(raw) : raw;
      }
    }

    const updatedProfile = {
      ...existingProfile,
      ...body,
      updatedAt: new Date().toISOString(),
    };

    if (isPgConfigured()) {
      await conn.query(
        `INSERT INTO system_settings (key, user_id, value, updated_at)
         VALUES ('user_profile', $1, $2, now())
         ON CONFLICT (key, user_id) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
        [userId, JSON.stringify(updatedProfile)]
      );
    } else {
      await conn.execute(
        `MERGE INTO system_settings s
         USING (SELECT 'user_profile' AS k, :userId AS u FROM dual) src
         ON (s.key = src.k AND s.user_id = src.u)
         WHEN MATCHED THEN
           UPDATE SET s.value = :val, s.updated_at = CURRENT_TIMESTAMP
         WHEN NOT MATCHED THEN
           INSERT (key, user_id, value, updated_at) VALUES ('user_profile', :userId, :val, CURRENT_TIMESTAMP)`,
        { val: JSON.stringify(updatedProfile), userId }
      );
    }

    return NextResponse.json({
      success: true,
      profile: updatedProfile,
    });
  } catch (err) {
    console.error("POST /api/user/profile error:", err);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  } finally {
    if (conn) {
      if (typeof conn.release === "function") conn.release();
      else if (typeof conn.close === "function") await conn.close();
    }
  }
}
