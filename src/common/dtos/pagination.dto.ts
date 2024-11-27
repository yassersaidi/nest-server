import { IsInt, IsNotEmpty, Min } from 'class-validator';
export class PaginationDto {
  @IsNotEmpty()
  @IsInt()
  @Min(0)
  limit: number;

  @IsNotEmpty()
  @IsInt()
  @Min(0)
  offset: number;
}
