import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Request } from "express";
import { UsersService } from "src/resources/users/users.service";

@Injectable()
export class IsAuthed implements CanActivate {
    constructor(
        private readonly userService: UsersService,
        private readonly tokenService: JwtService,
        private readonly configService: ConfigService
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {

        const request = context.switchToHttp().getRequest()
        const token = this.extractTokenFromHeader(request)

        if (!token) {
            throw new UnauthorizedException()
        }

        try {
            
            const {userId} = await this.tokenService.verifyAsync(
                token,
                {
                    secret: this.configService.get("JWT_SECRET")
                }
            )
            const user = await this.userService.findById(userId)
            if (!user) {
                throw new UnauthorizedException()
            }
            request.userId = userId
        }
        catch (error) {
            throw new UnauthorizedException(error)
        }

        return true
    }

    private extractTokenFromHeader(request: Request): string | undefined {
        const [type, token] = request.headers.authorization?.split(' ') ?? [];
        return type === 'Bearer' ? token : undefined;
    }
}