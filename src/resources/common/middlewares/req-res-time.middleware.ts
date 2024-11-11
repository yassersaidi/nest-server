import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import { Request, Response } from "express";

@Injectable()
export class RequestResponseTime implements NestMiddleware {
    use(req: Request, res: Response, next: (error?: Error | any) => void) {
        console.time("Response Returned after")
        console.log(`-------- New Request ----------`)
        console.log(`Request from: ${req.ip ? req.ip : req.headers["x-forwarded-for"]}`)
        console.log(`Request to: ${req.baseUrl + req.url}`)

        res.on('finish', () => {
            console.log(`-------- New Response ----------`)
            console.log(`Response Status: ${res.statusCode}`)
            console.timeEnd("Response Returned after")
        })
        next()
    }
}