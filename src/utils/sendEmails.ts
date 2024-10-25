import { Resend } from "resend";

import { config } from 'dotenv';
config();

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendVerificationCode = async (email: string, code: string, subject: string, header: string) => {

    const { data, error } = await resend.emails.send({
        from: "NEST-SERVER <notification@yassersaidi.com>",
        to: email,
        subject,
        html: `
            <h2>${header}</h2>
            <h1>${code}</h1>
        `,
    });

    if (error) {
        return false
    }

    return true
}
