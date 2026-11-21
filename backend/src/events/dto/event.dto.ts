import {
  IsNotEmpty,
  IsString,
  MaxLength,
  IsOptional,
  Matches,
} from 'class-validator';

export class CreateEventDto {
  @IsNotEmpty({ message: 'Nama event wajib diisi' })
  @IsString({ message: 'Nama event harus berupa teks' })
  @MaxLength(150, { message: 'Nama event maksimal 150 karakter' })
  eventName!: string;

  @IsNotEmpty({ message: 'Tanggal event wajib diisi' })
  @IsString({ message: 'Tanggal event harus berupa teks' })
  @MaxLength(50, { message: 'Tanggal event maksimal 50 karakter' })
  eventDate!: string;

  @IsOptional()
  @IsString({ message: 'Waktu mulai harus berupa teks' })
  @MaxLength(20, { message: 'Waktu mulai maksimal 20 karakter' })
  startTime?: string;

  @IsOptional()
  @IsString({ message: 'Waktu selesai harus berupa teks' })
  @MaxLength(20, { message: 'Waktu selesai maksimal 20 karakter' })
  endTime?: string;

  @IsNotEmpty({ message: 'Penyelenggara event wajib diisi' })
  @IsString({ message: 'Penyelenggara event harus berupa teks' })
  @MaxLength(150, { message: 'Penyelenggara event maksimal 150 karakter' })
  organizer!: string;

  @IsNotEmpty({ message: 'Format nomor sertifikat wajib diisi' })
  @IsString({ message: 'Format nomor sertifikat harus berupa teks' })
  @MaxLength(100, { message: 'Format nomor sertifikat maksimal 100 karakter' })
  @Matches(/\/$/, {
    message: "Format nomor sertifikat harus diakhiri dengan tanda garis miring '/' (contoh: 041/HIMAPROSIF/XI/2026/)",
  })
  certificatePrefix!: string;
}

export class UpdateEventDto {
  @IsOptional()
  @IsString({ message: 'Nama event harus berupa teks' })
  @MaxLength(150, { message: 'Nama event maksimal 150 karakter' })
  eventName?: string;

  @IsOptional()
  @IsString({ message: 'Tanggal event harus berupa teks' })
  @MaxLength(50, { message: 'Tanggal event maksimal 50 karakter' })
  eventDate?: string;

  @IsOptional()
  @IsString({ message: 'Waktu mulai harus berupa teks' })
  @MaxLength(20, { message: 'Waktu mulai maksimal 20 karakter' })
  startTime?: string;

  @IsOptional()
  @IsString({ message: 'Waktu selesai harus berupa teks' })
  @MaxLength(20, { message: 'Waktu selesai maksimal 20 karakter' })
  endTime?: string;

  @IsOptional()
  @IsString({ message: 'Penyelenggara event harus berupa teks' })
  @MaxLength(150, { message: 'Penyelenggara event maksimal 150 karakter' })
  organizer?: string;

  @IsOptional()
  @IsString({ message: 'Format nomor sertifikat harus berupa teks' })
  @MaxLength(100, { message: 'Format nomor sertifikat maksimal 100 karakter' })
  @Matches(/\/$/, {
    message: "Format nomor sertifikat harus diakhiri dengan tanda garis miring '/' (contoh: 041/HIMAPROSIF/XI/2026/)",
  })
  certificatePrefix?: string;
}

export class CreateRecipientDto {
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
}
