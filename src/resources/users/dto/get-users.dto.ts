import { Transform } from "class-transformer"
import { IsIn, IsInt, IsNotEmpty, IsPositive, Min } from "class-validator"

export class GetUsersQueryDto {
    @IsNotEmpty()
    @Transform(({ value }) => Number.parseInt(value,10))
    @IsInt()
    @Min(0)
    limit: number

    @IsNotEmpty()
    @Transform(({ value }) => Number.parseInt(value,10))
    @IsInt()
    @Min(0)
    offset: number

    @IsNotEmpty()
    @IsIn(["username", "createdAt"])
    sortBy: string

    @IsNotEmpty()
    @Transform(({ value }) => Number.parseInt(value,10))
    @IsIn([1, -1])
    order: number
}