import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { adminListAllActions, getDb, adminPruneOldActions } from "@/lib/db";
import { ObjectId } from "mongodb";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized. Admin role required." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const moduleName = searchParams.get("module") || undefined;
    const status = searchParams.get("status") || undefined;
    const userId = searchParams.get("userId") || undefined;
    const search = searchParams.get("search") || undefined;
    const limit = Number(searchParams.get("limit")) || 50;
    const offset = Number(searchParams.get("offset")) || 0;

    const data = await adminListAllActions({
      module: moduleName,
      status,
      userId,
      search,
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      actions: data.actions,
      total: data.total,
    });
  } catch (err) {
    console.error("GET /api/admin/actions error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to list actions" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized. Admin role required." }, { status: 403 });
    }

    const body = await req.json();
    const { actionId, actionIds, status, reasoning } = body;

    const validStatuses = ["pending", "approved", "rejected", "auto_executed", "failed"];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    const db = await getDb();
    const now = new Date().toISOString();
    const adminEmail = (session as any)?.user?.email || "system-admin";

    const updatePayload: Record<string, any> = {
      status,
      reviewed_at: now,
      reviewed_by: adminEmail,
    };
    if (reasoning) {
      updatePayload.admin_override_reason = reasoning;
    }

    if (actionId) {
      const filter: any = {
        $or: [{ id: actionId }, { id: String(actionId) }],
      };
      if (ObjectId.isValid(actionId)) {
        filter.$or.push({ _id: new ObjectId(actionId) });
      }

      const res = await db.collection("agent_actions").updateOne(filter, {
        $set: updatePayload,
      });

      return NextResponse.json({
        success: true,
        matchedCount: res.matchedCount,
        modifiedCount: res.modifiedCount,
      });
    }

    if (Array.isArray(actionIds) && actionIds.length > 0) {
      const stringIds = actionIds.map(String);
      const objectIds = actionIds
        .filter((id) => typeof id === "string" && ObjectId.isValid(id))
        .map((id) => new ObjectId(id));

      const filter: any = {
        $or: [
          { id: { $in: stringIds } },
          { _id: { $in: objectIds } },
        ],
      };

      const res = await db.collection("agent_actions").updateMany(filter, {
        $set: updatePayload,
      });

      return NextResponse.json({
        success: true,
        matchedCount: res.matchedCount,
        modifiedCount: res.modifiedCount,
      });
    }

    return NextResponse.json(
      { error: "Provide either actionId or actionIds array" },
      { status: 400 }
    );
  } catch (err) {
    console.error("PATCH /api/admin/actions error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update action" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any)?.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized. Admin role required." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const actionId = searchParams.get("id");
    const pruneDays = searchParams.get("pruneDays");
    const pruneStatus = searchParams.get("pruneStatus") || undefined;

    if (pruneDays) {
      const days = Number(pruneDays);
      if (isNaN(days) || days < 1) {
        return NextResponse.json({ error: "Invalid pruneDays parameter" }, { status: 400 });
      }
      const res = await adminPruneOldActions(days, pruneStatus);
      return NextResponse.json({
        success: true,
        message: `Pruned ${res.deletedCount} old action logs.`,
        deletedCount: res.deletedCount,
      });
    }

    if (actionId) {
      const db = await getDb();
      const filter: any = {
        $or: [{ id: actionId }, { id: String(actionId) }],
      };
      if (ObjectId.isValid(actionId)) {
        filter.$or.push({ _id: new ObjectId(actionId) });
      }

      const res = await db.collection("agent_actions").deleteOne(filter);
      return NextResponse.json({
        success: true,
        deletedCount: res.deletedCount,
      });
    }

    return NextResponse.json(
      { error: "Provide either 'id' or 'pruneDays' parameter" },
      { status: 400 }
    );
  } catch (err) {
    console.error("DELETE /api/admin/actions error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete actions" },
      { status: 500 }
    );
  }
}
