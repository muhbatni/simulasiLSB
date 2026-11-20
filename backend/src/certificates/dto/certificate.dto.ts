import {
  IsNotEmpty,
  IsString,
  MaxLength,
  IsOptional,
  IsIn,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class GenerateCertDto {
  @IsNotEmpty({ message: 'ID Event wajib diisi' })
  @IsString({ message: 'ID Event harus berupa teks' })
  eventId!: string;

  @IsNotEmpty({ message: 'Nama penerima wajib diisi' })
  @IsString({ message: 'Nama penerima harus berupa teks' })
  @MaxLength(100, { message: 'Nama penerima maksimal 100 karakter' })
  recipientName!: string;

  @IsNotEmpty({ message: 'NIM / Identitas penerima wajib diisi' })
  @IsString({ message: 'NIM / Identitas penerima harus berupa teks' })
  @MaxLength(50, { message: 'NIM / Identitas penerima maksimal 50 karakter' })
  recipientIdentifier!: string;

  @IsOptional()
  @IsString({ message: 'Peran penerima harus berupa teks' })
  @MaxLength(30, { message: 'Peran penerima maksimal 30 karakter' })
  recipientRole?: string;

  @IsOptional()
  @IsString({ message: 'Nomor sertifikat harus berupa teks' })
  @MaxLength(100, { message: 'Nomor sertifikat maksimal 100 karakter' })
  certificateNumber?: string;

  @IsOptional()
  @IsIn(['1080p', '300dpi'], { message: 'Resolusi harus 1080p atau 300dpi' })
  resolution?: '1080p' | '300dpi';
}

export class IssueCertificatesDto {
  @IsNotEmpty({ message: 'ID Event wajib diisi' })
  @IsString({ message: 'ID Event harus berupa teks' })
  eventId!: string;

  @IsOptional()
  @IsArray({ message: 'Daftar ID penerima harus berupa array' })
  @IsString({ each: true, message: 'ID penerima harus berupa teks' })
  recipientIds?: string[];

  @IsOptional()
  @IsIn(['1080p', '300dpi'], { message: 'Resolusi harus 1080p atau 300dpi' })
  resolution?: '1080p' | '300dpi';
}

export class BulkRecipientItemDto {
  @IsNotEmpty({ message: 'Nama penerima wajib diisi' })
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsNotEmpty({ message: 'NIM / Identitas penerima wajib diisi' })
  @IsString()
  @MaxLength(50)
  identifier!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  role?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  certificateNumber?: string;
}

export class BulkGenerateDto {
  @IsNotEmpty({ message: 'ID Event wajib diisi' })
  @IsString()
  eventId!: string;

  @IsArray({ message: 'Daftar penerima harus berupa array' })
  @ValidateNested({ each: true })
  @Type(() => BulkRecipientItemDto)
  recipients!: BulkRecipientItemDto[];
}
