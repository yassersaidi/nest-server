import { Resend } from "resend";
export const sendVerificationCode = async (key, email: string, code: string, subject:string, header:string) => {
    const resend = new Resend(key);

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
