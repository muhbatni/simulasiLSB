import { IsNotEmpty, IsString, MinLength, MaxLength } from 'class-validator';

export class LoginDto {
  @IsNotEmpty({ message: 'Username wajib diisi' })
  @IsString({ message: 'Username harus berupa teks' })
  @MaxLength(50, { message: 'Username maksimal 50 karakter' })
  username!: string;

  @IsNotEmpty({ message: 'Password wajib diisi' })
  @IsString({ message: 'Password harus berupa teks' })
  @MinLength(1, { message: 'Password minimal 1 karakter' })
  @MaxLength(100, { message: 'Password maksimal 100 karakter' })
  password!: string;
}
