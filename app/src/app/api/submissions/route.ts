import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";

// /tmp e o unico diretorio com permissao de escrita no ambiente da Vercel
const DATA_FILE = path.join(os.tmpdir(), "submissions_cache.json");

declare global {
  var __submissions_cache: any[] | undefined;
}

function readSubmissions(): any[] {
  if (globalThis.__submissions_cache && Array.isArray(globalThis.__submissions_cache)) {
    return globalThis.__submissions_cache;
  }
  if (fs.existsSync(DATA_FILE)) {
    try {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        globalThis.__submissions_cache = parsed;
        return parsed;
      }
    } catch {
      // continua para fallback
    }
  }
  return [];
}

function writeSubmissions(data: any[]) {
  globalThis.__submissions_cache = data;
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Falha ao persistir em /tmp:", err);
  }
}

export async function GET() {
  const data = readSubmissions();
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const current = readSubmissions();
    const updated = [body, ...current];
    writeSubmissions(updated);
    return NextResponse.json({ success: true, item: body });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Erro ao processar submissao" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const current = readSubmissions();
    const filtered = current.filter((sub: any) => sub.id !== id);
    writeSubmissions(filtered);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
