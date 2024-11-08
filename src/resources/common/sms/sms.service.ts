import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';
import { PROVIDERS } from '../constants';
import { SMSType } from './interfaces/sms.interface';

@Injectable()
export class SMSService {

    constructor(
        @Inject(PROVIDERS.SMS) private readonly smsClient: Twilio,
        private readonly configService: ConfigService,
    ) { }

    async send({ phoneNumber, message }: SMSType): Promise<boolean> {
        try {
            const fromNumber = this.configService.get<string>('TWILIO_PHONE_NUMBER');
            const response = await this.smsClient.messages.create({
                to: phoneNumber,
                from: fromNumber,
                body: message,
            });

            if (response.errorCode || response.status !== 'sent') {
                return false
            }

            return true
        } catch (error) {
            console.log(error)
            return false
        }
    }
}
