import { NextRequest, NextResponse } from "next/server";
import { buildGmailAuthUrl, getGmailOAuthClient } from "@/lib/applications/gmail";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
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

  return NextResponse.redirect(buildGmailAuthUrl(client));
}
