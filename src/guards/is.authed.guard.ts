import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Request } from "express";
import UAParser from "ua-parser-js";

@Injectable()
export class IsAuthed implements CanActivate {
    constructor(
        @Inject('UAParser') private readonly uap: UAParser,
        private readonly tokenService: JwtService,
        private readonly configService: ConfigService
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {

        const request: Request = context.switchToHttp().getRequest()
        const token = this.extractTokenFromHeader(request)
       
        if (!token) {
            throw new UnauthorizedException()
        }

        try {
            const { userId, username, role } = await this.tokenService.verifyAsync(
                token,
                {
                    secret: this.configService.get("JWT_SECRET")
                }
            )

            if (!userId) {
                throw new UnauthorizedException()
            }

            request.userId = userId
            request.username = username
            request.role = role

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