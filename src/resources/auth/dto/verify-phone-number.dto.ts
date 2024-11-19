import { IsString, MinLength } from 'class-validator';

export class VerifyPhoneNumberDto {
  @IsString()
  @MinLength(10)
  phoneNumber: string;
}
