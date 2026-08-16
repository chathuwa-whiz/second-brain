import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createLemonCheckout, isLemonConfigured } from "@/lib/lemonsqueezy";
import { withBasePath } from "@/lib/basePath";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any)?.id;
  const userEmail = session.user.email;
  const userName = session.user.name || undefined;

  if (!userEmail || !userId) {
    return NextResponse.json({ error: "Missing user session data" }, { status: 400 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // defaults to monthly
  }

  const planType = (body.plan === "yearly" ? "yearly" : "monthly") as "monthly" | "yearly";

  if (!isLemonConfigured()) {
    return NextResponse.json(
      {
        error:
          "Lemon Squeezy is not yet configured with API credentials. Please set LEMONSQUEEZY_API_KEY and LEMONSQUEEZY_STORE_ID in your environment.",
      },
      { status: 503 }
    );
  }

  try {
    const origin =
      req.headers.get("origin") ||
      req.headers.get("referer") ||
      process.env.NEXTAUTH_URL ||
      "http://localhost:3000";

    const cleanOrigin = origin.replace(/\/$/, "");
    const redirectUrl = `${cleanOrigin}${withBasePath("/settings?billing=success")}`;

    const checkoutUrl = await createLemonCheckout({
      planType,
      userEmail,
      userName,
      userId,
      redirectUrl,
    });

    return NextResponse.json({
      success: true,
      url: checkoutUrl,
    });
  } catch (err) {
    console.error("POST /api/billing/checkout error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to initiate Lemon Squeezy checkout session.",
      },
      { status: 500 }
    );
  }
}
