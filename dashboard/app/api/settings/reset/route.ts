import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getDb as getMongoDb, mongoConfigured } from "@/lib/mongo";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const results: Record<string, unknown> = {};

  // 1. Truncate Oracle Autonomous Database tables
  let conn;
  try {
    conn = await getDb();
    await conn.execute("TRUNCATE TABLE agent_actions");
    results.oracle_agent_actions = "truncated";
  } catch (oracleErr) {
    console.error("Failed to truncate Oracle agent_actions:", oracleErr);
    results.oracle_error = oracleErr instanceof Error ? oracleErr.message : String(oracleErr);
  } finally {
    if (conn) await conn.close();
  }

  // 2. Clean MongoDB collections if configured
  if (mongoConfigured()) {
    try {
      const mdb = await getMongoDb();
      const resMatches = await mdb.collection("job_matches").deleteMany({});
      const resApps = await mdb.collection("job_applications").deleteMany({});
      results.mongodb_matches_deleted = resMatches.deletedCount;
      results.mongodb_apps_deleted = resApps.deletedCount;
    } catch (mongoErr) {
      console.warn("MongoDB reset notice:", mongoErr);
      results.mongodb_error = mongoErr instanceof Error ? mongoErr.message : String(mongoErr);
    }
  }

  return NextResponse.json({
    success: true,
    message: "All databases and approval queues have been reset to their initial clean state.",
    details: results,
  });
}
