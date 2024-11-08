import { HttpException, HttpStatus } from "@nestjs/common";

export class DefaultHttpException extends HttpException {
    constructor(
        message: string,
        private readonly resolution: string,
        private readonly errorSource: string,
        statusCode: HttpStatus = HttpStatus.BAD_REQUEST

    ) {
        super(
            {
                message,
                resolution,
                errorSource
            },
            statusCode
        );
    }
}