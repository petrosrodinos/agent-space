import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsObject, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { z } from 'zod';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { OrgGuard, type OrgMembership } from '@/shared/guards/org.guard';
import { CurrentMembership } from '@/shared/decorators/org-roles.decorator';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import { PaginationQuerySchema } from '@/shared/utils/pagination/pagination.utils';
import type { Actor } from '../bots/bots.service';
import { RunsService } from './runs.service';
import { TasksService } from './tasks.service';

const actor = (m: OrgMembership): Actor => ({ user_id: m.user_id, organization_id: m.organization_id, role: m.role });

const TaskQuerySchema = PaginationQuerySchema.extend({ status: z.enum(['active', 'waiting', 'done', 'failed']).optional() });
type TaskQuery = z.infer<typeof TaskQuerySchema>;

class ProvideInputDto {
    @ApiProperty() @IsString() request_id: string;
    @ApiProperty() @IsObject() result: Record<string, unknown>;
}

class StartTaskDto {
    @ApiProperty() @IsUUID() bot_id: string;
    @ApiProperty() @IsString() @MinLength(3) @MaxLength(8000) prompt: string;
}

@ApiTags('Tasks')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtGuard, OrgGuard)
export class RunsController {
    constructor(
        private readonly runs: RunsService,
        private readonly tasks: TasksService,
    ) { }

    @Get('tasks')
    @ApiOperation({ summary: 'Tasks page: everything running, waiting, finished or failed (§10.1)' })
    list(@CurrentMembership() m: OrgMembership, @Query(new ZodValidationPipe(TaskQuerySchema)) q: TaskQuery) {
        return this.runs.listTasks(actor(m), q);
    }

    @Post('tasks')
    @ApiOperation({ summary: 'Give a bot a long job; it keeps working after you leave (§10.1)' })
    start(@CurrentMembership() m: OrgMembership, @Body() dto: StartTaskDto) {
        return this.tasks.startTask(actor(m), dto.bot_id, dto.prompt);
    }

    @Get('tasks/:id')
    get(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.runs.getTask(actor(m), id);
    }

    @Post('runs/:id/stop')
    stop(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.runs.stop(actor(m), id);
    }

    @Post('runs/:id/input')
    input(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ProvideInputDto) {
        return this.runs.provideInput(actor(m), id, dto.request_id, dto.result);
    }
}
