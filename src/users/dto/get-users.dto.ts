import { PaginationDto } from '@/common/dtos/pagination.dto';
import { IsIn, IsNotEmpty } from 'class-validator';

export class GetUsersQueryDto extends PaginationDto {
  @IsNotEmpty()
  @IsIn(['username', 'createdAt'])
  sortBy: string;

  @IsNotEmpty()
  @IsIn([1, -1])
  order: number;
}
