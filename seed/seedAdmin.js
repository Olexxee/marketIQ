import "dotenv/config";
import bcrypt from "bcryptjs";
import prisma from "../src/config/prisma.js";

// ============================================================
// CLI ARGS
// ============================================================
// Usage:
//   node scripts/seedAdmin.js
//   node scripts/seedAdmin.js --email=admin@marketiq.ng --password=Secret123 --name="Ada Obi"
//   node scripts/seedAdmin.js --email=admin@marketiq.ng --password=Secret123 --name="Ada Obi" --phone="+2348012345678" --reset-password
//
// Defaults are for local dev only. Change them before any non-local use.

const parseArgs = (argv) => {
  const out = {};

  for (const arg of argv.slice(2)) {
    if (!arg.startsWith("--")) continue;

    const [key, ...rest] = arg.replace(/^--/, "").split("=");
    out[key] = rest.length ? rest.join("=") : true;
  }

  return out;
};

const args = parseArgs(process.argv);

const EMAIL =
  args.email || process.env.SEED_ADMIN_EMAIL || "admin@marketiq.local";
const PASSWORD =
  args.password || process.env.SEED_ADMIN_PASSWORD || "MarketIQAdmin123!";
const FULL_NAME = args.name || process.env.SEED_ADMIN_NAME || "MarketIQ Admin";
const PHONE = args.phone || process.env.SEED_ADMIN_PHONE || null;
const RESET_PASSWORD = Boolean(args["reset-password"]);

// ============================================================
// HELPERS
// ============================================================

const fail = (message) => {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
};

const assertEnv = () => {
  if (!process.env.DATABASE_URL) {
    fail("DATABASE_URL is not set. Load your .env first.");
  }
};

const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const validatePassword = (password) => {
  if (password.length < 8) {
    return "Password must be at least 8 characters";
  }
  return null;
};

// ============================================================
// MAIN
// ============================================================

const main = async () => {
  assertEnv();

  if (!validateEmail(EMAIL)) {
    fail(`Invalid email: ${EMAIL}`);
  }

  const passwordError = validatePassword(PASSWORD);
  if (passwordError) {
    fail(passwordError);
  }

  console.log("\nMarketIQ — Seed admin\n");
  console.log(`  email     : ${EMAIL}`);
  console.log(`  full name : ${FULL_NAME}`);
  console.log(`  phone     : ${PHONE ?? "(none)"}`);
  console.log(`  role      : ADMIN`);
  console.log(`  status    : ACTIVE`);
  console.log("");

  const existing = await prisma.user.findUnique({
    where: { email: EMAIL },
    select: {
      id: true,
      role: true,
      status: true,
      fullName: true,
    },
  });

  if (existing) {
    const shouldResetPassword = RESET_PASSWORD;

    const data = {
      role: "ADMIN",
      status: "ACTIVE",
      fullName: FULL_NAME,
      ...(PHONE ? { phone: PHONE } : {}),
      ...(shouldResetPassword
        ? { password: await bcrypt.hash(PASSWORD, 10) }
        : {}),
    };

    const updated = await prisma.user.update({
      where: { id: existing.id },
      data,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
      },
    });

    console.log("→ User already existed. Promoted to ADMIN.");
    console.log("  (password unchanged — pass --reset-password to reset)\n");
    console.log(updated);
    return;
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const created = await prisma.user.create({
    data: {
      fullName: FULL_NAME,
      email: EMAIL,
      phone: PHONE,
      password: passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      phone: true,
      role: true,
      status: true,
    },
  });

  console.log("→ Admin user created.");
  console.log(created);
  console.log("");
};

main()
  .catch((error) => {
    console.error("\n✖ Seed failed:", error?.message ?? error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
