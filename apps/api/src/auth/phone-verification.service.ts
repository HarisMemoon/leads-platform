import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

/**
 * Phone OTP verification via Twilio Verify — deliberately not hand-rolling
 * code generation/expiry/storage, Twilio's Verify service already handles
 * that. Reuses the same TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN already
 * configured for SMS notifications, plus a Verify-specific service SID.
 */
@Injectable()
export class PhoneVerificationService {
  private readonly logger = new Logger(PhoneVerificationService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  private twilioCreds() {
    const accountSid = (this.config.get<string>('TWILIO_ACCOUNT_SID') ?? '').trim();
    const authToken = (this.config.get<string>('TWILIO_AUTH_TOKEN') ?? '').trim();
    const verifyServiceSid = (
      this.config.get<string>('TWILIO_VERIFY_SERVICE_SID') ?? ''
    ).trim();
    if (!accountSid || !authToken || !verifyServiceSid) {
      throw new BadRequestException(
        'Phone verification is not configured on the server',
      );
    }
    return { accountSid, authToken, verifyServiceSid };
  }

  private authHeader(accountSid: string, authToken: string): string {
    return `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`;
  }

  async sendCode(userId: string): Promise<{ sent: boolean }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');
    if (!user.phone) throw new BadRequestException('No phone number on file');
    if (user.phone_verified) return { sent: false };

    const { accountSid, authToken, verifyServiceSid } = this.twilioCreds();

    const res = await fetch(
      `https://verify.twilio.com/v2/Services/${verifyServiceSid}/Verifications`,
      {
        method: 'POST',
        headers: {
          Authorization: this.authHeader(accountSid, authToken),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: user.phone, Channel: 'sms' }).toString(),
      },
    );

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.logger.warn(`Twilio Verify send failed: ${res.status} ${body}`);
      throw new BadRequestException(
        'Could not send verification code — check the phone number and try again',
      );
    }

    return { sent: true };
  }

  async verifyCode(userId: string, code: string): Promise<{ verified: boolean }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');
    if (!user.phone) throw new BadRequestException('No phone number on file');
    if (user.phone_verified) return { verified: true };
    if (!code?.trim()) throw new BadRequestException('Verification code is required');

    const { accountSid, authToken, verifyServiceSid } = this.twilioCreds();

    const res = await fetch(
      `https://verify.twilio.com/v2/Services/${verifyServiceSid}/VerificationCheck`,
      {
        method: 'POST',
        headers: {
          Authorization: this.authHeader(accountSid, authToken),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: user.phone, Code: code.trim() }).toString(),
      },
    );

    if (!res.ok) {
      throw new BadRequestException('Verification failed — please try again');
    }

    const data = (await res.json()) as { status?: string };
    if (data.status !== 'approved') {
      throw new BadRequestException('Incorrect or expired code');
    }

    user.phone_verified = true;
    await this.userRepo.save(user);
    return { verified: true };
  }
}
