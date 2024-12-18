import { Inject, Injectable } from '@nestjs/common';
import { Resend } from 'resend';
import { PROVIDERS } from '../constants';
import { EmailBody } from './interfaces/send-email-code.interface';

@Injectable()
export class EmailService {
  constructor(
    @Inject(PROVIDERS.EMAIL_PROVIDER) private readonly emailService: Resend,
  ) {}

  async sendEmail(emailBody: EmailBody): Promise<boolean> {
    const { email, subject, html, text } = emailBody;
    try {
      const { error } = await this.emailService.emails.send({
        from: 'NEST-SERVER <notification@yassersaidi.com>',
        to: email,
        subject,
        html,
        text,
      });

      if (error) {
        return false;
      }

      return true;
    } catch (error) {
      console.log(error);
      return false;
    }
  }
}
