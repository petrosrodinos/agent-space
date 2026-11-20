import { Global, Module } from '@nestjs/common';
import { OnePasswordConnectService } from './one-password-connect.service';

/** Password manager connections (§16). */
@Global()
@Module({
    providers: [OnePasswordConnectService],
    exports: [OnePasswordConnectService],
})
export class PasswordManagersModule { }
