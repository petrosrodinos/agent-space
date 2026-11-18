import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

export interface OutgoingMail {
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
}

/** Email provider facade (Resend). Feature modules send mail only through this service. */
@Injectable()
export class MailService {
    private readonly logger = new Logger(MailService.name);
    private client?: Resend;

    constructor(private readonly config: ConfigService) { }

    private resend() {
        const key = this.config.get<string>('RESEND_API_KEY');
        if (!key) throw new ServiceUnavailableException('Email is not configured');
        if (!this.client) this.client = new Resend(key);
        return this.client;
    }

    get from() {
        return this.config.get<string>('MAIL_FROM') || 'Agent Space <noreply@logiqdev.com>';
    }

    async send(mail: OutgoingMail) {
        const { data, error } = await this.resend().emails.send({
            from: this.from,
            to: mail.to,
            subject: mail.subject,
            html: mail.html,
            text: mail.text,
        });
        if (error) {
            this.logger.error(`Email send failed: ${error.message}`);
            throw new ServiceUnavailableException(`Email could not be sent: ${error.message}`);
        }
        return data;
    }
}
