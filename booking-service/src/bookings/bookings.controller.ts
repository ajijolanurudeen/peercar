import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './create.booking.dto';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateBookingDto) {
    return this.bookingsService.create(dto);
  }
}