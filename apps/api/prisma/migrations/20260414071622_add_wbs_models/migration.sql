-- CreateEnum
CREATE TYPE "WbsDependencyType" AS ENUM ('FINISH_TO_START');

-- CreateEnum
CREATE TYPE "WbsNodeType" AS ENUM ('TASK', 'SUBTASK');

-- CreateTable
CREATE TABLE "WbsPhase" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL,
    "planStart" TIMESTAMP(3),
    "planEnd" TIMESTAMP(3),
    "actualStart" TIMESTAMP(3),
    "actualEnd" TIMESTAMP(3),
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WbsPhase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WbsTask" (
    "id" TEXT NOT NULL,
    "phaseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL,
    "planStart" TIMESTAMP(3),
    "planEnd" TIMESTAMP(3),
    "actualStart" TIMESTAMP(3),
    "actualEnd" TIMESTAMP(3),
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "backlogItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WbsTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WbsSubtask" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL,
    "planStart" TIMESTAMP(3),
    "planEnd" TIMESTAMP(3),
    "actualStart" TIMESTAMP(3),
    "actualEnd" TIMESTAMP(3),
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "backlogItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WbsSubtask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WbsDependency" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceType" "WbsNodeType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetType" "WbsNodeType" NOT NULL,
    "type" "WbsDependencyType" NOT NULL DEFAULT 'FINISH_TO_START',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WbsDependency_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WbsPhase_projectId_idx" ON "WbsPhase"("projectId");

-- CreateIndex
CREATE INDEX "WbsTask_phaseId_idx" ON "WbsTask"("phaseId");

-- CreateIndex
CREATE INDEX "WbsTask_backlogItemId_idx" ON "WbsTask"("backlogItemId");

-- CreateIndex
CREATE INDEX "WbsSubtask_taskId_idx" ON "WbsSubtask"("taskId");

-- CreateIndex
CREATE INDEX "WbsSubtask_backlogItemId_idx" ON "WbsSubtask"("backlogItemId");

-- CreateIndex
CREATE INDEX "WbsDependency_projectId_idx" ON "WbsDependency"("projectId");

-- CreateIndex
CREATE INDEX "WbsDependency_sourceId_idx" ON "WbsDependency"("sourceId");

-- CreateIndex
CREATE INDEX "WbsDependency_targetId_idx" ON "WbsDependency"("targetId");

-- AddForeignKey
ALTER TABLE "WbsPhase" ADD CONSTRAINT "WbsPhase_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WbsTask" ADD CONSTRAINT "WbsTask_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "WbsPhase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WbsTask" ADD CONSTRAINT "WbsTask_backlogItemId_fkey" FOREIGN KEY ("backlogItemId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WbsSubtask" ADD CONSTRAINT "WbsSubtask_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "WbsTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WbsSubtask" ADD CONSTRAINT "WbsSubtask_backlogItemId_fkey" FOREIGN KEY ("backlogItemId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WbsDependency" ADD CONSTRAINT "WbsDependency_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
