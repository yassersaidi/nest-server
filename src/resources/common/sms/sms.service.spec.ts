import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { PROVIDERS } from '../constants';
import { TwilioMock } from './mocks/sms.service.mock';
import { SMSService } from './sms.service';

describe('SMSService', () => {
  let service: SMSService;

  const configServiceMock = {
    get: vi.fn().mockReturnValue("+213505151515")
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SMSService,
        {
          provide: PROVIDERS.SMS,
          useValue: TwilioMock,
        },
        {
          provide: ConfigService,
          useValue: configServiceMock
        }
      ],
    }).compile();

    service = module.get<SMSService>(SMSService);
  });

  it('SMS Service Should be defined', () => {
    expect(service).toBeDefined();
  });

  it('Should call send method and return true', async () => {
    const sendData = { phoneNumber: '+21354545445', message: 'Hello' };
    const response = { status: "sent" }
    TwilioMock.messages.create.mockResolvedValue(response);
    const createSpy = vi.spyOn(TwilioMock.messages, 'create');

    const result = await service.send(sendData);
    expect(createSpy).toHaveBeenCalledWith({
      to: sendData.phoneNumber,
      from: configServiceMock.get('TWILIO_PHONE_NUMBER'),
      body: sendData.message
    })
    expect(result).toBe(true);
  });

  it('Should return false on failure', async () => {
    const sendData = { phoneNumber: '+21354545445', message: 'Hello' };
    const response = { status: "failed", errorCode: 404 }
    TwilioMock.messages.create.mockResolvedValue(response);
    const createSpy = vi.spyOn(TwilioMock.messages, 'create');

    const result = await service.send(sendData);
    expect(createSpy).toHaveBeenCalledWith({
      to: sendData.phoneNumber,
      from: configServiceMock.get('TWILIO_PHONE_NUMBER'),
      body: sendData.message
    })
    expect(result).toBe(false);
  });
  it('Should return false on failure', async () => {
    const sendData = { phoneNumber: '+21354545445', message: 'Hello' };
    TwilioMock.messages.create.mockRejectedValue({});
    const createSpy = vi.spyOn(TwilioMock.messages, 'create');

    const result = await service.send(sendData);
    expect(createSpy).toHaveBeenCalledWith({
      to: sendData.phoneNumber,
      from: configServiceMock.get('TWILIO_PHONE_NUMBER'),
      body: sendData.message
    })
    expect(result).toBe(false);
  });
});
