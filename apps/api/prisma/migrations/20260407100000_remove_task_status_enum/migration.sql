-- AlterTable
ALTER TABLE "SubTask" DROP COLUMN "status";

-- AlterTable
ALTER TABLE "Task" DROP COLUMN "status";

-- DropEnum
DROP TYPE "TaskStatus";
