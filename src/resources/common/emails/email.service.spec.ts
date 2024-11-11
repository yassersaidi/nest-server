import { Test, TestingModule } from "@nestjs/testing";
import { EmailService } from "./email.service";
import { ResendMock, EmailServiceMock } from './mocks/email.service.mock';
import { PROVIDERS } from "../constants";

describe("EmailService", () => {
    let service: EmailService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                EmailService,
                {
                    provide: PROVIDERS.EMAIL_PROVIDER,
                    useValue: ResendMock,
                }
            ]
        }).compile();

        service = module.get<EmailService>(EmailService);
    });

    it('Email Service Should be defined', () => {
        expect(service).toBeDefined();
      })

    it("Should send an email successfully", async () => {
        const emailBody = { 
            email: 'test@example.com', 
            subject: 'Test Subject', 
            html: '<p>Test HTML</p>', 
            text: 'Test Text'
        };

        ResendMock.emails.send.mockResolvedValue({ data: 'success', error: null });

        const result = await service.sendEmail(emailBody);

        expect(result).toBe(true);
        expect(ResendMock.emails.send).toHaveBeenCalledWith({
            from: "NEST-SERVER <notification@yassersaidi.com>",
            to: 'test@example.com',
            subject: 'Test Subject',
            html: '<p>Test HTML</p>',
            text: 'Test Text',
        });
    });

    it("Should return false if there's an error sending email", async () => {
        const emailBody = { 
            email: 'test@example.com', 
            subject: 'Test Subject', 
            html: '<p>Test HTML</p>', 
            text: 'Test Text'
        };

        ResendMock.emails.send.mockResolvedValue({ data: null, error: 'Error' });

        const result = await service.sendEmail(emailBody);

        expect(result).toBe(false);
    });
});
