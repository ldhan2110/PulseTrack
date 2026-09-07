-- CreateEnum
CREATE TYPE "PlannerProposalStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DISMISSED');

-- AlterTable
ALTER TABLE "PlannerMessage"
  ADD COLUMN "proposal" JSONB,
  ADD COLUMN "proposalStatus" "PlannerProposalStatus";
