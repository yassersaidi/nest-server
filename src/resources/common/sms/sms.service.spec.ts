import { Test, TestingModule } from '@nestjs/testing';
import { SMSService } from './sms.service';
import { SMSServiceMock } from './mocks/sms.service.mock';
import { PROVIDERS } from '../constants';

describe('SMSService', () => {
  let service: SMSService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: PROVIDERS.SMS,
          useValue: SMSServiceMock,
        },
      ],
    }).compile();

    service = module.get<SMSService>(PROVIDERS.SMS);
  });

  it('SMS Service Should be defined', () => {
    expect(service).toBeDefined();
  });

  it('Should call send method and return true', async () => {
    const sendData = { phoneNumber: '+21354545445', message: 'Hello' };
    SMSServiceMock.send.mockResolvedValue(true);
    const result = await service.send(sendData);

    expect(result).toBe(true);
    expect(SMSServiceMock.send).toHaveBeenCalledWith(sendData);
  });

  it('Should return false on failure', async () => {
    SMSServiceMock.send.mockResolvedValue(false);

    const sendData = { phoneNumber: '+21354545445', message: 'Hello' };
    const result = await service.send(sendData);

    expect(result).toBe(false);
    expect(SMSServiceMock.send).toHaveBeenCalledWith(sendData);
  });
});
