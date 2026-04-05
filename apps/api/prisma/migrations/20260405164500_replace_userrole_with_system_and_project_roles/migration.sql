-- CreateEnum
CREATE TYPE "SystemRole" AS ENUM ('admin', 'member');

-- CreateEnum
CREATE TYPE "ProjectRole" AS ENUM ('pm', 'ba', 'developer', 'leadership');

-- AlterTable: User.role from UserRole to SystemRole
-- Map all existing UserRole values to 'member' since they were project-level roles
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "SystemRole" USING 'member'::"SystemRole";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'member';

-- AlterTable: ProjectMember.role from UserRole to ProjectRole
-- Values (pm, ba, developer, leadership) are the same in both enums, direct cast works
ALTER TABLE "ProjectMember" ALTER COLUMN "role" TYPE "ProjectRole" USING "role"::text::"ProjectRole";

-- DropEnum
DROP TYPE "UserRole";
