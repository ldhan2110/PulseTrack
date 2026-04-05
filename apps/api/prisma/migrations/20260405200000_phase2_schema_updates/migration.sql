-- Phase 2 schema updates: Bug tracking, SubTask, SprintStatus, QC role, remove SystemRole

-- Step 1: Drop the SystemRole enum and remove the role column from User
ALTER TABLE "User" DROP COLUMN IF EXISTS "role";
DROP TYPE IF EXISTS "SystemRole";

-- Step 2: Update ProjectRole enum - remove leadership, add qc
-- First update any existing 'leadership' members to 'pm' (safety)
UPDATE "ProjectMember" SET role = 'pm' WHERE role = 'leadership';

-- Rename old enum
ALTER TYPE "ProjectRole" RENAME TO "ProjectRole_old";

-- Create new enum
CREATE TYPE "ProjectRole" AS ENUM ('pm', 'ba', 'qc', 'developer');

-- Migrate the column
ALTER TABLE "ProjectMember" ALTER COLUMN "role" TYPE "ProjectRole" USING "role"::text::"ProjectRole";

-- Drop old enum
DROP TYPE "ProjectRole_old";

-- Step 3: Add SprintStatus enum and status field to Sprint
CREATE TYPE "SprintStatus" AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED');

ALTER TABLE "Sprint" ADD COLUMN "status" "SprintStatus" NOT NULL DEFAULT 'PLANNED';

-- Step 4: Add BugSeverity enum
CREATE TYPE "BugSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- Step 5: Add BugStatus enum
CREATE TYPE "BugStatus" AS ENUM ('OPEN', 'IN_FIX', 'FIXED', 'VERIFIED', 'CLOSED');

-- Step 6: Create Bug table
CREATE TABLE "Bug" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "severity" "BugSeverity" NOT NULL,
    "reproductionSteps" TEXT,
    "environment" TEXT,
    "status" "BugStatus" NOT NULL DEFAULT 'OPEN',
    "projectId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "assigneeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bug_pkey" PRIMARY KEY ("id")
);

-- Step 7: Create SubTask table
CREATE TABLE "SubTask" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'BACKLOG',
    "parentId" TEXT NOT NULL,
    "assigneeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubTask_pkey" PRIMARY KEY ("id")
);

-- Step 8: Add foreign key constraints for Bug
ALTER TABLE "Bug" ADD CONSTRAINT "Bug_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Bug" ADD CONSTRAINT "Bug_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Bug" ADD CONSTRAINT "Bug_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 9: Add foreign key constraints for SubTask
ALTER TABLE "SubTask" ADD CONSTRAINT "SubTask_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubTask" ADD CONSTRAINT "SubTask_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
