import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleAuthDto {
  /** Google Identity Services credential JWT */
  @IsString()
  @IsNotEmpty()
  id_token!: string;
}
