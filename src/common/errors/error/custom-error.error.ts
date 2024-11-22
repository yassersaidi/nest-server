import { HttpException, HttpStatus } from '@nestjs/common';

export class DefaultHttpException extends HttpException {
  constructor(
    message: string,
    resolution: string,
    errorSource: string,
    statusCode: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super(
      {
        message,
        resolution,
        errorSource,
      },
      statusCode,
    );
  }
}
