import prisma from "./src/config/prisma.js";
import { nigeriaLgas } from "./src/data/nigeriaLgas.js";

const NIGERIA_CODE = "NG";

/**
 * Seeds all 774 Nigerian LGAs / FCT Area Councils.
 *
 * Assumes Country "Nigeria" and all 37 states/FCT are already seeded.
 * Idempotent — safe to re-run; existing rows are skipped via the
 * @@unique([stateId, name]) constraint.
 */
const seedLgas = async () => {
  // 1. Resolve Nigeria
  const country = await prisma.country.findUnique({
    where: { code: NIGERIA_CODE },
    select: { id: true, name: true },
  });

  if (!country) {
    throw new Error(
      `Country "${NIGERIA_CODE}" not found. Seed country & states first.`,
    );
  }

  console.log(`[seed:lga] country: ${country.name}`);

  // 2. Load states once → Map<code, id>
  const states = await prisma.state.findMany({
    where: { countryId: country.id },
    select: { id: true, code: true, name: true },
  });

  if (states.length === 0) {
    throw new Error("No states found for Nigeria. Seed states first.");
  }

  const stateIdByCode = new Map(states.map((s) => [s.code, s.id]));

  console.log(`[seed:lga] loaded ${states.length} states`);

  // 3. Build LGA rows, validating each stateCode
  const rows = [];
  const unknownCodes = new Set();

  for (const lga of nigeriaLgas) {
    const stateId = stateIdByCode.get(lga.stateCode);

    if (!stateId) {
      unknownCodes.add(lga.stateCode);
      continue;
    }

    rows.push({ name: lga.name, stateId });
  }

  if (unknownCodes.size > 0) {
    throw new Error(
      `Unknown state code(s) in nigeriaLgas: ${[...unknownCodes].join(", ")}`,
    );
  }

  console.log(`[seed:lga] prepared ${rows.length} LGA rows`);

  // 4. Bulk insert — skips rows that violate @@unique([stateId, name])
  const result = await prisma.lga.createMany({
    data: rows,
    skipDuplicates: true,
  });

  console.log(`[seed:lga] inserted: ${result.count}`);
  console.log(
    `[seed:lga] already existed (skipped): ${rows.length - result.count}`,
  );
};

const main = async () => {
  console.log("[seed] starting LGA seed…");
  await seedLgas();
  console.log("[seed] done.");
};

main()
  .catch((err) => {
    console.error("[seed] failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
