import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Length,
  MinLength,
} from 'class-validator';

export class ResetPasswordDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  @Length(6, 6)
  code: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  password: string;
}
