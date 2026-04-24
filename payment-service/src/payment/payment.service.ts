import { Injectable, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  @MessagePattern('booking.created')
  handleBookingCreated(@Payload() event: {
    bookingId:  string;
    carId:      string;
    userId:     string;
    totalPrice: number;
  }) {
    this.logger.log(
      `[Payment Service] Processing payment for Booking: ${event.bookingId}`,
    );
  }
}