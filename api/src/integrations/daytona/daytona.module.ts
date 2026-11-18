import { Global, Module } from '@nestjs/common';
import { DaytonaService } from './daytona.service';

@Global()
@Module({
    providers: [DaytonaService],
    exports: [DaytonaService],
})
export class DaytonaModule { }
