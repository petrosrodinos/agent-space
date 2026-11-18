import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { ComputersService } from './computers.service';
import { ComputersController } from './computers.controller';
import { ComputerViewController, ComputerViewProxy } from './computer-view.proxy';

@Module({
    imports: [FilesModule],
    controllers: [ComputersController, ComputerViewController],
    providers: [ComputersService, ComputerViewProxy],
    exports: [ComputersService],
})
export class ComputersModule { }
