import { IsIn, IsInt, IsNotEmpty, Min } from 'class-validator';

export class GetUsersQueryDto {
  @IsNotEmpty()
  @IsInt()
  @Min(0)
  limit: number;

  @IsNotEmpty()
  @IsInt()
  @Min(0)
  offset: number;

  @IsNotEmpty()
  @IsIn(['username', 'createdAt'])
  sortBy: string;

  @IsNotEmpty()
  @IsIn([1, -1])
  order: number;
}
