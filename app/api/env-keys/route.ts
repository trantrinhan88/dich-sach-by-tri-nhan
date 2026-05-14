import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

const ENV_FILE = path.join(process.cwd(), '.env.local')
const MANAGED_KEYS = ['DEEPSEEK_API_KEY', 'GEMINI_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY'] as const

function parseEnv(content: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
    result[key] = val
  }
  return result
}

function serializeEnv(vars: Record<string, string>): string {
  const lines = Object.entries(vars).map(([k, v]) => `${k}=${v}`)
  return lines.join('\n') + '\n'
}

export async function GET() {
  try {
    const content = await fs.readFile(ENV_FILE, 'utf-8')
    const vars = parseEnv(content)
    const result: Record<string, string> = {}
    for (const key of MANAGED_KEYS) {
      result[key] = vars[key] || ''
    }
    return NextResponse.json(result)
  } catch {
    const empty: Record<string, string> = {}
    for (const key of MANAGED_KEYS) empty[key] = ''
    return NextResponse.json(empty)
  }
}

export async function POST(req: Request) {
  const body = await req.json() as Record<string, string>

  let existing: Record<string, string> = {}
  try {
    const content = await fs.readFile(ENV_FILE, 'utf-8')
    existing = parseEnv(content)
  } catch { /* file doesn't exist yet */ }

  for (const key of MANAGED_KEYS) {
    if (body[key] !== undefined) {
      if (body[key] === '') {
        delete existing[key]
      } else {
        existing[key] = body[key]
      }
    }
  }

  await fs.writeFile(ENV_FILE, serializeEnv(existing), 'utf-8')
  return NextResponse.json({ ok: true })
}
