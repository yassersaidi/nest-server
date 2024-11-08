type EmailBaseData = { email: string, subject: string };

type TextOnly = { text: string; html?: string };
type HtmlOnly = { html: string; text?: string };

export type EmailBody = EmailBaseData & (TextOnly | HtmlOnly)