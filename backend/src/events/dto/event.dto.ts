import {
  IsNotEmpty,
  IsString,
  MaxLength,
  IsOptional,
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

  @IsNotEmpty({ message: 'Penyelenggara event wajib diisi' })
  @IsString({ message: 'Penyelenggara event harus berupa teks' })
  @MaxLength(150, { message: 'Penyelenggara event maksimal 150 karakter' })
  organizer!: string;
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
  @IsString({ message: 'Penyelenggara event harus berupa teks' })
  @MaxLength(150, { message: 'Penyelenggara event maksimal 150 karakter' })
  organizer?: string;
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
