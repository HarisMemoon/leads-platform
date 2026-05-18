import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { InjectRepository } from "@nestjs/typeorm"
import { User } from "src/entities/user.entity"
import { DataSource, Repository } from "typeorm"
import { JwtService } from "@nestjs/jwt"
import * as bcrypt from "bcrypt"
import { OAuth2Client } from "google-auth-library"
import { WalletAccount } from "src/entities/wallet-account.entity"
import { OnboardingProgress } from "src/entities/onboarding-progress.entity"
import { UserRole } from "../../common/enums/user-role.enum"
import { RegisterDto } from "./dto/register.dto"

@Injectable()
export class AuthService {

constructor(
  @InjectRepository(User)
  private userRepo: Repository<User>,
  private jwtService: JwtService,
  private dataSource: DataSource,
  private config: ConfigService,
){}

private signUser(user: User) {
  return {
    access_token: this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
      full_name: user.full_name,
      company_name: user.company_name,
    }),
  }
}

async register(dto: RegisterDto) {
  const { email, password, full_name, company_name } = dto

const existing = await this.userRepo.findOne({ where: { email } })
if (existing) throw new ConflictException('Email already in use')

const hash = await bcrypt.hash(password, 10)

return this.dataSource.transaction(async manager => {

const user = manager.create(User,{
  email,
  password_hash: hash,
  full_name,
  company_name,
  role: UserRole.BUYER,
  utm_source: dto.utm_source ?? null,
  utm_medium: dto.utm_medium ?? null,
  utm_campaign: dto.utm_campaign ?? null,
  utm_content: dto.utm_content ?? null,
  utm_term: dto.utm_term ?? null,
})

await manager.save(user)

/*
BOOTSTRAP
*/

await manager.save(WalletAccount, {
  user,
  balance_cents: '0'
})

await manager.save(OnboardingProgress, {
  user
})

return this.signUser(user)

})
}

async login(email: string, password: string){

const user = await this.userRepo.findOne({ where:{ email }})

if(!user) throw new UnauthorizedException()
if (!user.is_active) throw new UnauthorizedException('Account is disabled')
if (!user.password_hash) {
  throw new UnauthorizedException('Use Google sign-in for this account')
}

const valid = await bcrypt.compare(password, user.password_hash)

if(!valid) throw new UnauthorizedException()

return this.signUser(user)
}

async loginWithGoogleIdToken(idToken: string) {
  const clientId = (this.config.get<string>('GOOGLE_CLIENT_ID') ?? '').trim()
  if (!clientId) {
    throw new BadRequestException('Google sign-in is not configured on the server')
  }
  const client = new OAuth2Client(clientId)
  const ticket = await client.verifyIdToken({ idToken, audience: clientId })
  const payload = ticket.getPayload()
  if (!payload?.email || !payload.sub) {
    throw new UnauthorizedException('Invalid Google token')
  }
  const email = payload.email.toLowerCase()
  const googleSub = payload.sub
  const fullName = payload.name ?? null

  let user = await this.userRepo.findOne({ where: { google_sub: googleSub } })
  if (user) {
    if (!user.is_active) throw new UnauthorizedException('Account is disabled')
    return this.signUser(user)
  }

  const byEmail = await this.userRepo.findOne({ where: { email } })
  if (byEmail) {
    if (!byEmail.is_active) throw new UnauthorizedException('Account is disabled')
    if (byEmail.google_sub && byEmail.google_sub !== googleSub) {
      throw new ConflictException('Email is linked to a different Google account')
    }
    byEmail.google_sub = googleSub
    if (!byEmail.full_name && fullName) byEmail.full_name = fullName
    await this.userRepo.save(byEmail)
    return this.signUser(byEmail)
  }

  return this.dataSource.transaction(async (manager) => {
    const created = manager.create(User, {
      email,
      password_hash: null,
      full_name: fullName,
      company_name: null,
      google_sub: googleSub,
      role: UserRole.BUYER,
    })
    await manager.save(created)
    await manager.save(WalletAccount, { user: created, balance_cents: '0' })
    await manager.save(OnboardingProgress, { user: created })
    return this.signUser(created)
  })
}
}