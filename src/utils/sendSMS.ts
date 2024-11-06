import { ConfigService } from "@nestjs/config"
import { Twilio } from "twilio"

const configService = new ConfigService()

const accountSid = configService.get<string>("TWILIO_ACCOUNT_SID")
const authToken = configService.get<string>("TWILIO_AUTH_TOKEN")
const twilioPhoneNumber = configService.get<string>("TWILIO_PHONE_NUMBER")

const client = new Twilio(accountSid, authToken, {
    logLevel: 'debug',
    autoRetry: true,
    maxRetries: 3
})

export const sendSMS = async (phoneNumber: string, message: string) => {
    try {
        const testing = await client.messages.create({
            to: phoneNumber,
            from: twilioPhoneNumber,
            body: message
        })
        console.log(testing)
        return true
    } catch (error) {
        console.log(error)
        return false
    }
}

