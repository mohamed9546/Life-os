import { NextRequest, NextResponse } from "next/server";
import { exchangeGmailCode, getGmailOAuthClient } from "@/lib/applications/gmail";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "Missing Google OAuth code" }, { status: 400 });
  }

  const client = getGmailOAuthClient(request.nextUrl.origin);
  if (!client) {
    return NextResponse.json(
      {
        error:
          "Google OAuth is not configured. Put your downloaded Google OAuth client JSON at data/google-oauth-client.json, or set GOOGLE_OAUTH_CLIENT_ID/GOOGLE_OAUTH_CLIENT_SECRET. Aliases OAuthClientId and OAuthClientSecret are also supported.",
      },
      { status: 400 }
    );
  }

  try {
    await exchangeGmailCode(code, client);
    return NextResponse.redirect(new URL("/career?gmail=connected", request.nextUrl.origin));
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Gmail OAuth callback failed",
      },
      { status: 500 }
    );
  }
}
