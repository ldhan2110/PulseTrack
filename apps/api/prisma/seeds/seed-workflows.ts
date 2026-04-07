import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

const DEFAULT_STATUSES = [
  { key: 'BACKLOG', name: 'Backlog', color: '#6b7280', position: 0, isDefault: true, isClosed: false },
  { key: 'IN_PROGRESS', name: 'In Progress', color: '#3b82f6', position: 1, isDefault: false, isClosed: false },
  { key: 'IN_REVIEW', name: 'In Review', color: '#f59e0b', position: 2, isDefault: false, isClosed: false },
  { key: 'DONE', name: 'Done', color: '#22c55e', position: 3, isDefault: false, isClosed: true },
  { key: 'BLOCKED', name: 'Blocked', color: '#ef4444', position: 4, isDefault: false, isClosed: false },
];

const DEFAULT_TRANSITIONS: [string, string][] = [
  ['BACKLOG', 'IN_PROGRESS'],
  ['IN_PROGRESS', 'BACKLOG'],
  ['IN_PROGRESS', 'IN_REVIEW'],
  ['IN_REVIEW', 'IN_PROGRESS'],
  ['IN_REVIEW', 'DONE'],
  ['DONE', 'IN_REVIEW'],
  ['BACKLOG', 'BLOCKED'],
  ['IN_PROGRESS', 'BLOCKED'],
  ['IN_REVIEW', 'BLOCKED'],
  ['DONE', 'BLOCKED'],
  ['BLOCKED', 'BACKLOG'],
  ['BLOCKED', 'IN_PROGRESS'],
  ['BLOCKED', 'IN_REVIEW'],
];

async function main() {
  const projects = await prisma.project.findMany({ select: { id: true } });
  console.log(`Found ${projects.length} projects to seed workflows for`);

  for (const project of projects) {
    const existing = await prisma.workflowStatus.count({ where: { projectId: project.id } });
    if (existing > 0) {
      console.log(`Project ${project.id} already has workflow statuses, skipping`);
      continue;
    }

    await prisma.$transaction(async (tx) => {
      const statusMap: Record<string, string> = {};
      for (const s of DEFAULT_STATUSES) {
        const created = await tx.workflowStatus.create({
          data: { projectId: project.id, ...s },
        });
        statusMap[s.key] = created.id;
      }

      for (const [from, to] of DEFAULT_TRANSITIONS) {
        await tx.workflowTransition.create({
          data: {
            projectId: project.id,
            fromStatusId: statusMap[from],
            toStatusId: statusMap[to],
          },
        });
      }

      const tasks = await tx.task.findMany({
        where: { projectId: project.id },
        select: { id: true, status: true },
      });
      for (const task of tasks) {
        const wsId = statusMap[task.status];
        if (wsId) {
          await tx.task.update({
            where: { id: task.id },
            data: { workflowStatusId: wsId },
          });
        }
      }

      const subTasks = await tx.subTask.findMany({
        where: { parent: { projectId: project.id } },
        select: { id: true, status: true },
      });
      for (const st of subTasks) {
        const wsId = statusMap[st.status];
        if (wsId) {
          await tx.subTask.update({
            where: { id: st.id },
            data: { workflowStatusId: wsId },
          });
        }
      }
    });

    console.log(`Seeded workflow for project ${project.id}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
