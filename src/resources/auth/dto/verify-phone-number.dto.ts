import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class VerifyPhoneNumberDto {

    @IsNotEmpty()
    @IsEmail()
    email: string;

    @IsString()
    @MinLength(10)
    phoneNumber: string;
}