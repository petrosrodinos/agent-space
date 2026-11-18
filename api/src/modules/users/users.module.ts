import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { AppVersionController, UsersController } from './users.controller';
import { OrganizationsModule } from '../organizations/organizations.module';

@Module({
    imports: [OrganizationsModule],
    controllers: [UsersController, AppVersionController],
    providers: [UsersService],
    exports: [UsersService],
})
export class UsersModule { }
