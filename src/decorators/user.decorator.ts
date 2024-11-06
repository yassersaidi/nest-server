
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export type UserReqType = {
    userId: string,
    role: "user" | "admin",
    username: string
}

export const UserReq = createParamDecorator(
    (data: unknown, ctx: ExecutionContext) => {
        const request: Request = ctx.switchToHttp().getRequest();
        const { username, userId, role } = request
        return {
            username, userId, role
        }
    },
);
