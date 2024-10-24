import { IsEmail, IsOptional, IsString, MinLength, Validate, ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from "class-validator"

@ValidatorConstraint({ name: 'emailOrUsername', async: false })
class EmailOrUsernameValidator implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    const object = args.object as any;
    return !!(object.email || object.username);
  }

  defaultMessage(args: ValidationArguments) {
    return 'Either email or username must be provided!';
  }
}


export class SearchUsersQueryDto{
    @IsOptional()
    @IsEmail()
    email?:string;

    @IsOptional()	
    @IsString()
    @MinLength(6)
    username?:string;

    @Validate(EmailOrUsernameValidator)
    isThereEmailOrUsername?: boolean
}

