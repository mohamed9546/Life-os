import { NextResponse } from "next/server";

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function err(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

export function badRequest(message: string) {
  return err(message, 400);
}

export function notFound(message = "Not found") {
  return err(message, 404);
}
