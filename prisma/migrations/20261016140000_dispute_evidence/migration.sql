CREATE TYPE "DisputeEvidenceType" AS ENUM (
  'NOTE',
  'IMAGE',
  'DOCUMENT',
  'DELIVERY_PROOF',
  'COMMUNICATION',
  'OTHER'
);

CREATE TABLE "DisputeEvidence" (
  "id" TEXT NOT NULL,
  "disputeId" TEXT NOT NULL,
  "submittedById" TEXT,
  "type" "DisputeEvidenceType" NOT NULL DEFAULT 'NOTE',
  "description" TEXT NOT NULL,
  "url" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DisputeEvidence_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DisputeEvidence_disputeId_createdAt_idx"
  ON "DisputeEvidence"("disputeId", "createdAt");

CREATE INDEX "DisputeEvidence_submittedById_createdAt_idx"
  ON "DisputeEvidence"("submittedById", "createdAt");

ALTER TABLE "DisputeEvidence"
  ADD CONSTRAINT "DisputeEvidence_disputeId_fkey"
  FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DisputeEvidence"
  ADD CONSTRAINT "DisputeEvidence_submittedById_fkey"
  FOREIGN KEY ("submittedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
