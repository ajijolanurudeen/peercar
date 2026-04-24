import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Kafka, Producer, logLevel } from 'kafkajs';

export interface BookingCreatedEvent {
  bookingId:  string;
  carId:      string;
  userId:     string;
  totalPrice: number;
}

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger   = new Logger(KafkaProducerService.name);
  private producer: Producer;

  private readonly kafka = new Kafka({
    clientId: 'booking-service',
    brokers:  (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(','),
    logLevel: logLevel.WARN,
  });

  async onModuleInit() {
    this.producer = this.kafka.producer({ idempotent: true });
    await this.producer.connect();
    this.logger.log('Kafka producer connected');
  }

  async onModuleDestroy() {
    await this.producer.disconnect();
  }

  async publishBookingCreated(event: BookingCreatedEvent): Promise<void> {
    await this.producer.send({
      topic: 'booking.created',
      messages: [{
        key:   event.carId,
        value: JSON.stringify(event),
      }],
    });
    this.logger.log(`Published booking.created for ${event.bookingId}`);
  }
}