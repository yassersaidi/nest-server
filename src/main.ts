import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { TimeoutInterceptor } from './resources/common/interceptors/timeout.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  app.setGlobalPrefix('api/v1');
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions:{
        enableImplicitConversion: true
      }
    }),
  );
  app.useGlobalInterceptors(new TimeoutInterceptor(3000))
  await app.listen(3000);
  console.log(`Application is running on: ${await app.getUrl()}/api/v1`);
}
bootstrap();
