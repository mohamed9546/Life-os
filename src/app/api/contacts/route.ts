import { NextRequest, NextResponse } from "next/server";
import { readCollection, writeCollection } from "@/lib/storage";

interface Contact { id: string; name: string; company?: string; role?: string; email?: string; linkedin?: string; notes?: string; lastContact?: string; tags: string[]; source: "job" | "manual"; createdAt: string; }

export async function GET() {
  const contacts = await readCollection<Contact>("contacts");
  return NextResponse.json({ contacts });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const contacts = await readCollection<Contact>("contacts");
  const contact: Contact = {
    id: crypto.randomUUID(),
    name: body.name,
    company: body.company,
    role: body.role,
    email: body.email,
    linkedin: body.linkedin,
    notes: body.notes,
    lastContact: body.lastContact,
    tags: body.tags ?? [],
    source: body.source ?? "manual",
    createdAt: new Date().toISOString(),
  };
  contacts.push(contact);
  await writeCollection<Contact>("contacts", contacts);
  return NextResponse.json({ contact });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const contacts = await readCollection<Contact>("contacts");
  const updated = contacts.map(c => c.id === body.id ? { ...c, ...body } : c);
  await writeCollection<Contact>("contacts", updated);
  return NextResponse.json({ contact: updated.find(c => c.id === body.id) });
}
