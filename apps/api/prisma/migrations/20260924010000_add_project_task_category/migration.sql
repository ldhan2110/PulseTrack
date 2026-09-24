-- CreateTable
CREATE TABLE "ProjectTaskCategory" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectTaskCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectTaskCategory_projectId_idx" ON "ProjectTaskCategory"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectTaskCategory_projectId_name_key" ON "ProjectTaskCategory"("projectId", "name");

-- AlterTable
ALTER TABLE "Task" ADD COLUMN "taskCategoryId" TEXT;

-- AddForeignKey
ALTER TABLE "ProjectTaskCategory" ADD CONSTRAINT "ProjectTaskCategory_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_taskCategoryId_fkey" FOREIGN KEY ("taskCategoryId") REFERENCES "ProjectTaskCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
