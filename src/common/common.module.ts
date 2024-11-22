import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import UAParser from 'ua-parser-js';
import { PROVIDERS } from './constants';
import { EmailModule } from './emails/email.module';
import { GeneratorService } from './generators/generator.service';
import { RequestResponseTime } from './middlewares/req-res-time.middleware';
import { SMSModule } from './sms/sms.module';

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
