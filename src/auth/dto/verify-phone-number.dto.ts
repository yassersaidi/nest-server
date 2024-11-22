import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class VerifyPhoneNumberDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(10)
  phoneNumber: string;
}
