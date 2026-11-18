import { Module } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { InvitationsController, OrganizationsController } from './organizations.controller';

@Module({
    controllers: [OrganizationsController, InvitationsController],
    providers: [OrganizationsService],
    exports: [OrganizationsService],
})
export class OrganizationsModule { }
