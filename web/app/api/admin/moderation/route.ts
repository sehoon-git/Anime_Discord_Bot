import { isIP } from "node:net";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { isAdminEmail, requireAdminEmail } from "@/app/lib/admin";
import { BanSubjectType, ensureModerationSchema, normalizeBanSubject } from "@/app/lib/moderation";

export const runtime = "nodejs";

const subjectTypes = new Set<BanSubjectType>(["email", "discord_user_id", "ip"]);

function invalid(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

function validateSubject(type: BanSubjectType, value: string) {
  if (!value || value.length > 254) return "제재 대상을 입력해주세요.";
  if (type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "올바른 이메일 주소를 입력해주세요.";
  if (type === "discord_user_id" && !/^\d{16,22}$/.test(value)) return "올바른 Discord 사용자 ID를 입력해주세요.";
  if (type === "ip" && isIP(value) === 0) return "올바른 IPv4 또는 IPv6 주소를 입력해주세요.";
  return null;
}

export async function GET(request: NextRequest) {
  const adminEmail = await requireAdminEmail();
  if (!adminEmail) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  await ensureModerationSchema();

  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const [bans, users] = await Promise.all([
    db.query(`SELECT id::text, subject_type, subject_value, reason, expires_at, created_by_email, created_at, revoked_at
      FROM moderation_bans ORDER BY created_at DESC LIMIT 100`),
    query.length >= 2
      ? db.query(`SELECT u.id::text, u.email, u.name, p.nickname, d.provider_user_id AS discord_user_id,
            recent_ip.ip_address::text AS recent_ip, recent_ip.last_seen_at AS recent_ip_seen_at
          FROM users u
          LEFT JOIN user_profiles p ON p.user_id = u.id
          LEFT JOIN user_accounts d ON d.user_id = u.id AND d.provider = 'discord'
          LEFT JOIN LATERAL (
            SELECT ip_address, last_seen_at FROM moderation_user_ips
            WHERE user_id = u.id ORDER BY last_seen_at DESC LIMIT 1
          ) recent_ip ON TRUE
          WHERE u.email ILIKE $1 OR u.name ILIKE $1 OR p.nickname ILIKE $1 OR d.provider_user_id ILIKE $1
          ORDER BY u.updated_at DESC LIMIT 30`, [`%${query}%`])
      : Promise.resolve({ rows: [] }),
  ]);
  return NextResponse.json({ ok: true, bans: bans.rows, users: users.rows });
}

export async function POST(request: NextRequest) {
  const adminEmail = await requireAdminEmail();
  if (!adminEmail) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  const body = await request.json().catch(() => null);
  const subjectType = body?.subjectType as BanSubjectType;
  const subjectValue = typeof body?.subjectValue === "string" ? normalizeBanSubject(subjectType, body.subjectValue) : "";
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  const expiresAt = typeof body?.expiresAt === "string" && body.expiresAt ? new Date(body.expiresAt) : null;

  if (!subjectTypes.has(subjectType)) return invalid("제재 유형이 올바르지 않습니다.");
  const subjectError = validateSubject(subjectType, subjectValue);
  if (subjectError) return invalid(subjectError);
  if (reason.length < 5 || reason.length > 500) return invalid("제재 사유는 5~500자로 입력해주세요.");
  if (expiresAt && (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date())) return invalid("만료일은 현재보다 이후여야 합니다.");
  if (subjectType === "email" && (isAdminEmail(subjectValue) || subjectValue === adminEmail)) return invalid("관리자 계정은 제재할 수 없습니다.");

  await ensureModerationSchema();
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const ban = await client.query(
      `INSERT INTO moderation_bans (subject_type, subject_value, reason, expires_at, created_by_email)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (subject_type, subject_value) WHERE revoked_at IS NULL
       DO UPDATE SET reason = EXCLUDED.reason, expires_at = EXCLUDED.expires_at, created_by_email = EXCLUDED.created_by_email, created_at = NOW()
       RETURNING id::text, subject_type, subject_value, reason, expires_at, created_at`,
      [subjectType, subjectValue, reason, expiresAt, adminEmail],
    );
    await client.query(
      `INSERT INTO moderation_audit_logs (action, target_type, target_value, actor_email, details)
       VALUES ('ban_created', $1, $2, $3, $4::jsonb)`,
      [subjectType, subjectValue, adminEmail, JSON.stringify({ reason, expiresAt: expiresAt?.toISOString() ?? null })],
    );
    await client.query("COMMIT");
    return NextResponse.json({ ok: true, ban: ban.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[admin/moderation][create]", error);
    return NextResponse.json({ ok: false, error: "제재 저장에 실패했습니다." }, { status: 500 });
  } finally { client.release(); }
}

export async function PATCH(request: NextRequest) {
  const adminEmail = await requireAdminEmail();
  if (!adminEmail) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  const body = await request.json().catch(() => null);
  const banId = typeof body?.banId === "string" ? body.banId : "";
  const revokeReason = typeof body?.revokeReason === "string" ? body.revokeReason.trim().slice(0, 500) : null;
  if (!/^\d+$/.test(banId)) return invalid("제재 정보를 찾을 수 없습니다.");
  await ensureModerationSchema();
  const result = await db.query(
    `UPDATE moderation_bans SET revoked_at = NOW(), revoked_by_email = $2, revoke_reason = $3
     WHERE id = $1 AND revoked_at IS NULL RETURNING subject_type, subject_value`,
    [banId, adminEmail, revokeReason],
  );
  if (!result.rowCount) return NextResponse.json({ ok: false, error: "이미 해제되었거나 존재하지 않는 제재입니다." }, { status: 404 });
  await db.query(
    `INSERT INTO moderation_audit_logs (action, target_type, target_value, actor_email, details)
     VALUES ('ban_revoked', $1, $2, $3, $4::jsonb)`,
    [result.rows[0].subject_type, result.rows[0].subject_value, adminEmail, JSON.stringify({ revokeReason })],
  );
  return NextResponse.json({ ok: true });
}
