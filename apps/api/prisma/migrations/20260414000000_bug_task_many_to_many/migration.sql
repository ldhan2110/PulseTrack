-- CreateTable
CREATE TABLE "BugTask" (
    "id" TEXT NOT NULL,
    "bugId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BugTask_pkey" PRIMARY KEY ("id")
);

-- MigrateData: copy existing parentTaskId links into BugTask
INSERT INTO "BugTask" ("id", "bugId", "taskId", "createdAt")
SELECT gen_random_uuid()::TEXT, "id", "parentTaskId", NOW()
FROM "Bug"
WHERE "parentTaskId" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "Bug" DROP CONSTRAINT "Bug_parentTaskId_fkey";

-- AlterTable
ALTER TABLE "Bug" DROP COLUMN "parentTaskId";

-- CreateIndex
CREATE UNIQUE INDEX "BugTask_bugId_taskId_key" ON "BugTask"("bugId", "taskId");

-- AddForeignKey
ALTER TABLE "BugTask" ADD CONSTRAINT "BugTask_bugId_fkey" FOREIGN KEY ("bugId") REFERENCES "Bug"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BugTask" ADD CONSTRAINT "BugTask_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
