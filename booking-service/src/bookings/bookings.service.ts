import {
  Injectable, Logger,
  ConflictException, BadRequestException, ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Booking, BookingStatus } from './bookings.entity';
import { CreateBookingDto } from './create.booking.dto';
import { KafkaProducerService } from '../kafka/kafka-producer.service';

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    @InjectRepository(Booking)
    private readonly repo: Repository<Booking>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly kafka: KafkaProducerService,
  ) {}

  async create(dto: CreateBookingDto): Promise<Booking> {
    const startTime = new Date(dto.startTime);
    const endTime   = new Date(dto.endTime);

    if (startTime >= endTime) {
      throw new BadRequestException('startTime must be before endTime');
    }

    // Convert the carId UUID to a stable int64 for pg_try_advisory_xact_lock.
    // This serialises ALL concurrent requests for the same car without
    // touching the bookings table — 99 of 100 simultaneous callers get false
    // and immediately receive a 409, before any DB work is done.
    const lockKey = this.uuidToLockKey(dto.carId);

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      // Non-blocking advisory lock (transaction-scoped, auto-released on commit/rollback)
      const [{ acquired }] = await qr.query(
        'SELECT pg_try_advisory_xact_lock($1) AS acquired',
        [lockKey],
      );

      if (!acquired) {
        throw new ConflictException(
          `Car ${dto.carId} is being booked by another request — please retry.`,
        );
      }

      // Overlap check: existing.startTime < new.endTime AND existing.endTime > new.startTime
      const overlap = await qr.manager
        .createQueryBuilder(Booking, 'b')
        .where('b.carId = :carId', { carId: dto.carId })
        .andWhere('b.status != :failed', { failed: BookingStatus.FAILED })
        .andWhere('b.startTime < :endTime', { endTime })
        .andWhere('b.endTime   > :startTime', { startTime })
        .getCount();

      if (overlap > 0) {
        throw new ConflictException(
          `Car ${dto.carId} is already booked for that period.`,
        );
      }

      // Persist as PENDING first
      const booking = qr.manager.create(Booking, {
        carId: dto.carId,
        userId: dto.userId,
        startTime,
        endTime,
        totalPrice: dto.totalPrice,
        status: BookingStatus.PENDING,
        kafkaPublished: false,
      });
      await qr.manager.save(booking);

      // Publish to Kafka.
      // If the broker is unavailable we throw, which triggers the catch block
      // below and rolls the entire transaction back — no ghost bookings.
      try {
        await this.kafka.publishBookingCreated({
          bookingId:  booking.id,
          carId:      booking.carId,
          userId:     booking.userId,
          totalPrice: booking.totalPrice,
        });
      } catch (kafkaErr) {
        this.logger.error(
          `Kafka publish failed for booking ${booking.id} — rolling back`,
          kafkaErr,
        );
        throw new ServiceUnavailableException(
          'Messaging service unavailable — booking rolled back. Please retry.',
        );
      }

      // Kafka ACK received — mark confirmed
      booking.status         = BookingStatus.CONFIRMED;
      booking.kafkaPublished = true;
      await qr.manager.save(booking);

      await qr.commitTransaction();
      this.logger.log(`Booking confirmed: ${booking.id}`);
      return booking;

    } catch (err) {
      if (qr.isTransactionActive) await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  /** Derive a signed int64 lock key from the first 8 bytes of a UUID. */
  private uuidToLockKey(uuid: string): bigint {
    const hex = uuid.replace(/-/g, '').slice(0, 16);
    const u   = BigInt('0x' + hex);
    const MAX = BigInt('9223372036854775807');
    return u > MAX ? u - BigInt('18446744073709551616') : u;
  }
}