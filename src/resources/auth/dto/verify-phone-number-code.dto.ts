import { IsEmail, IsNotEmpty, IsString, Length, MinLength } from 'class-validator';

export class VerifyPhoneNumberCodeDto {

    @IsNotEmpty()
    @IsEmail()
    email: string;

    @IsNotEmpty()
    @IsString()
    @MinLength(10)
    phoneNumber: string;
    
    @IsNotEmpty()
    @IsString()
    @Length(6, 6)
    code: string;
}