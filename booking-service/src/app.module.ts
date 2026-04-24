import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from './bookings/bookings.entity';
import { BookingsModule } from './bookings/bookings.module';
import { KafkaModule } from './kafka/kafka.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5432'),
      username: process.env.DB_USER ?? 'postgres',
      password: process.env.DB_PASSWORD ?? 'newpassword',
      database: process.env.DB_NAME ?? 'peercar',
      entities: [Booking],
      // synchronize: false — schema is managed by migrations/001_init.sql
      synchronize: false,
    }),
    KafkaModule,
    BookingsModule,
  ],
})
export class AppModule {}