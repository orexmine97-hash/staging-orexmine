// One-off bootstrap: grant ADMIN to a real login email so the first System
// Administrator can reach the console (the seeded admin@orexmine.ng has no Auth0
// account). Idempotent, non-destructive — upserts a single User row. On next
// login, beforeSessionSaved links it to the Auth0 sub by email.
//
// Run (staging): npx dotenv -e .env.local -- npx tsx prisma/bootstrap-admin.ts you@example.com
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = (process.argv[2] ?? process.env.BOOTSTRAP_ADMIN_EMAIL ?? "").trim().toLowerCase();
  const name = process.argv[3] ?? "System Administrator";
  if (!email) throw new Error("Usage: tsx prisma/bootstrap-admin.ts <email> [name]");

  const org = await prisma.organization.findFirst({ where: { type: "OREXMINE" } });
  if (!org) throw new Error("No OREXMINE organization found — seed the database first.");

  const user = await prisma.user.upsert({
    where: { email },
    update: { role: "ADMIN", active: true },
    create: { email, name, role: "ADMIN", active: true, organizationId: org.id },
  });
  console.log(`✔ ${user.email} is ADMIN (authId ${user.authId ?? "not yet linked — links on next login"}).`);
  console.log("→ Sign out and sign back in to pick up the role.");
}

main()
  .catch((e) => {
    console.error(e.message ?? e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
