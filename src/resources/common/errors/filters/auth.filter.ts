import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from "@nestjs/common";
import { Request, Response } from "express";

@Catch(HttpException)
export class AuthFilter<T extends HttpException> implements ExceptionFilter {
    catch(exception: T, host: ArgumentsHost) {
        const response = host.switchToHttp().getResponse<Response>()

        const status = exception.getStatus()
        const exceptionResponse = exception.getResponse()
        const message = exceptionResponse
        response.status(status).json({
            ...(typeof message === 'string' ? { message } : message),
            url: response.req.url,
            timestamp: new Date().toISOString()
        })

    }

}