import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { User } from "src/entities/user.entity"
import { DataSource, Repository } from "typeorm"
import { JwtService } from "@nestjs/jwt"
import * as bcrypt from "bcrypt"
import { WalletAccount } from "src/entities/wallet-account.entity"
import { OnboardingProgress } from "src/entities/onboarding-progress.entity"
import { UserRole } from "../../common/enums/user-role.enum"

@Injectable()
export class AuthService {

constructor(
  @InjectRepository(User)
  private userRepo: Repository<User>,
  private jwtService: JwtService,
  private dataSource: DataSource
){}

async register(email: string, password: string,full_name: string,company_name: string,) {

const existing = await this.userRepo.findOne({ where: { email } })
if (existing) throw new ConflictException('Email already in use')

const hash = await bcrypt.hash(password, 10)

return this.dataSource.transaction(async manager => {

const user = manager.create(User,{
  email,
  password_hash: hash,
  full_name,
  company_name,
  role: UserRole.BUYER
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

return {
  access_token: this.jwtService.sign({
    sub: user.id,
    email: user.email,
    role: user.role || "user",
    full_name: user.full_name,
    company_name: user.company_name,
  }),
};

})
}

async login(email: string, password: string){

const user = await this.userRepo.findOne({ where:{ email }})

if(!user) throw new UnauthorizedException()

const valid = await bcrypt.compare(password, user.password_hash)

if(!valid) throw new UnauthorizedException()

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
}