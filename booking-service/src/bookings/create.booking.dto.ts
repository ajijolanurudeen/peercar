import { IsUUID, IsISO8601, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBookingDto {
  @IsUUID()
  carId: string;

  @IsUUID()
  userId: string;

  @IsISO8601()
  startTime: string;

  @IsISO8601()
  endTime: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  totalPrice: number;
}