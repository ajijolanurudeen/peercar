
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { NestFactory } from '@nestjs/core';


async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.KAFKA,
      options: {
        client: {
          clientId: 'payment-service',
          brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
        },
        consumer: {
          groupId: 'payment-service-group',
        },
      },
    },
  );

  await app.listen();
  console.log('[Payment Service] Listening on topic: booking.created');
}
bootstrap();