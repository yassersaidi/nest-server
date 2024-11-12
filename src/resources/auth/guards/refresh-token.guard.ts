import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Request } from "express";

@Injectable()
export class RefreshTokenGuard implements CanActivate {
    constructor(
        private readonly tokenService: JwtService,
        private readonly configService: ConfigService
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {

        const request: Request = context.switchToHttp().getRequest()
        const token = this.extractRefreshTokenFromCookies(request)
        if (!token) {
            throw new UnauthorizedException({
                message: "Your access token is missing",
                solution: "Provide your access token in authorization header.",
                from: "Auth Guard"
            })
        }

        try {
            const { sessionId } = await this.tokenService.verifyAsync(
                token,
                {
                    secret: this.configService.get("JWT_REFRESH_TOKEN_SECRET")
                }
            )
            request.sessionId = sessionId
        }
        catch (error) {
            throw new UnauthorizedException({
                ...error,
                message: "Your refresh token is expired",
                solution: "Sign in again or refresh your token",
                from: "Auth Guard"
            })
        }

        return true
    }

    private extractRefreshTokenFromCookies(request: Request): string | undefined {
        const refreshToken = request.cookies["refreshToken"]
        return refreshToken
    }
}