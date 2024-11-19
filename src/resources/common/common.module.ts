import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import UAParser from 'ua-parser-js';
import { SMSModule } from './sms/sms.module';
import { EmailModule } from './emails/email.module';
import { PROVIDERS } from './constants';
import { RequestResponseTime } from './middlewares/req-res-time.middleware';
import { JwtService } from '@nestjs/jwt';
import { GeneratorService } from './generators/generator.service';

@Global()
@Module({
  imports: [SMSModule, EmailModule],
  providers: [
    {
      provide: PROVIDERS.USER_AGENT_PARSER,
      useValue: new UAParser(),
    },
    {
      provide: JwtService,
      useClass: JwtService,
    },
    {
      provide: GeneratorService,
      useClass: GeneratorService,
    },
  ],
  exports: [
    PROVIDERS.USER_AGENT_PARSER,
    JwtService,
    SMSModule,
    EmailModule,
    GeneratorService,
  ],
})
export class CommonModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestResponseTime).forRoutes('*');
  }
}
