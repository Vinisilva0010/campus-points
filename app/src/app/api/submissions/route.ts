import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DATA_FILE = path.resolve(process.cwd(), ".submissions_cache.json");

function readSubmissions() {
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function writeSubmissions(data: any[]) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

export async function GET() {
  const data = readSubmissions();
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const body = await req.json();
  const current = readSubmissions();
  const updated = [body, ...current];
  writeSubmissions(updated);
  return NextResponse.json({ success: true, item: body });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const current = readSubmissions();
  const filtered = current.filter((sub: any) => sub.id !== id);
  writeSubmissions(filtered);
  return NextResponse.json({ success: true });
}
