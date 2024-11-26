import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class AddMemberDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID(undefined, { each: true })
  members: string[];
}
