import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "src/entities/user.entity";

/**
 * Loads the user from the DB on each authenticated request so GET /auth/me
 * always returns full_name / company_name (not only what was embedded in the JWT).
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get<string>("JWT_SECRET"),
    });
  }

  async validate(payload: { sub: string; email: string; role: string }) {
    const user = await this.userRepo.findOne({ where: { id: payload.sub } });
    if (!user) {
      return {
        userId: payload.sub,
        email: payload.email,
        role: payload.role,
        full_name: null as string | null,
        company_name: null as string | null,
        distribution_locked: false,
      };
    }
    if (!user.is_active) throw new UnauthorizedException('Account is disabled');
    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      full_name: user.full_name,
      company_name: user.company_name,
      distribution_locked: Boolean(user.distribution_locked),
    };
  }
}
