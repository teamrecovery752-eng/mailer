import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/emailValidation";
import type { SuppressedEmail, SuppressionReason } from "@prisma/client";

export async function listSuppressions(limit = 500): Promise<SuppressedEmail[]> {
  return prisma.suppressedEmail.findMany({ orderBy: { createdAt: "desc" }, take: limit });
}

// Fast membership check for a whole batch at once — one query instead of
// one per recipient, which matters when a list has thousands of rows.
export async function getSuppressedSet(emails: string[]): Promise<Map<string, SuppressedEmail>> {
  if (emails.length === 0) return new Map();
  const rows = await prisma.suppressedEmail.findMany({ where: { email: { in: emails } } });
  return new Map(rows.map((r: SuppressedEmail) => [r.email, r]));
}

export async function addSuppression(email: string, reason: SuppressionReason, detail = "", source = "manual") {
  const normalized = normalizeEmail(email);
  return prisma.suppressedEmail.upsert({
    where: { email: normalized },
    update: { reason, detail, source },
    create: { email: normalized, reason, detail, source },
  });
}

export async function removeSuppression(id: string) {
  return prisma.suppressedEmail.delete({ where: { id } });
}

// Called from the send routes after a bulk or single send finishes.
// results.errors entries look like "someone@example.com: <provider error>"
// (see lib/mailer.ts) — this pulls the address back out and files it so
// the next list-clean or Bulk Email upload already knows to flag it.
// Best-effort: a failure here should never take down the send response
// that triggered it.
export async function recordBounces(errors: string[], source: string) {
  if (errors.length === 0) return;

  const entries = errors
    .map((line) => {
      const idx = line.indexOf(":");
      if (idx === -1) return null;
      const email = normalizeEmail(line.slice(0, idx));
      const detail = line.slice(idx + 1).trim();
      return email ? { email, detail } : null;
    })
    .filter((e): e is { email: string; detail: string } => !!e);

  await Promise.allSettled(
    entries.map(({ email, detail }) =>
      prisma.suppressedEmail.upsert({
        where: { email },
        update: { detail, source, reason: "BOUNCED" },
        create: { email, detail, source, reason: "BOUNCED" },
      })
    )
  );
}
