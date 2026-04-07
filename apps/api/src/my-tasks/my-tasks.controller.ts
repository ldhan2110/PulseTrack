import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TasksService } from '../tasks/tasks.service';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class MyTasksController {
  constructor(private tasksService: TasksService) {}

  @Get('my-tasks')
  findMyTasks(@Req() req: any) {
    return this.tasksService.findByAssignee(req.user.id);
  }
}
