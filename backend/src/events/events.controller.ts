import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Param,
  Body,
  Res,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { EventsService } from './events.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { LsbSteganoService } from '../security/lsb-stego.service';
import { CertificateGeneratorService } from '../certificates/certificate-generator.service';
import { CreateEventDto, UpdateEventDto, CreateRecipientDto } from './dto/event.dto';
import * as fs from 'fs';
import * as path from 'path';

@Controller('api/events')
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly lsbService: LsbSteganoService,
    private readonly certGenerator: CertificateGeneratorService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  getAll() {
    return this.eventsService.getAllEvents();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('recipients/template-csv')
  downloadCsvTemplate(@Res() res: Response) {
    const csv = this.eventsService.getCsvTemplate();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="template_penerima_sertifikat.csv"');
    res.send(csv);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.eventsService.getEventById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/template-image')
  async getTemplateImage(@Param('id') id: string, @Res() res: Response) {
    const evt = await this.eventsService.getEventById(id);
    if (evt.templateImagePath) {
      const templatePath = path.join(process.cwd(), 'uploads', 'covers', evt.templateImagePath);
      if (fs.existsSync(templatePath)) {
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'no-cache');
        const stream = fs.createReadStream(templatePath);
        return stream.pipe(res);
      }
    }

    // Fallback: Jika event belum memiliki template kustom, sajikan template dasar resmi UIN
    const baseBuffer = await this.certGenerator.generateCertificateTemplateBase();
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-cache');
    return res.end(baseBuffer);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/next-certificate-number')
  async getNextCertificateNumber(@Param('id') id: string) {
    const nextCertificateNumber = await this.eventsService.getNextCertificateNumber(id);
    return { nextCertificateNumber };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post()
  @UseInterceptors(
    FileInterceptor('templateImage', {
      limits: { fileSize: 10 * 1024 * 1024 }, // Maksimal 10 MB
      fileFilter: (req, file, cb) => {
        if (file) {
          const ext = path.extname(file.originalname).toLowerCase();
          if (ext !== '.png' && file.mimetype !== 'image/png') {
            return cb(
              new BadRequestException('Hanya format PNG yang didukung'),
              false,
            );
          }
        }
        cb(null, true);
      },
    }),
  )
  async create(
    @Body() body: CreateEventDto,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    let templateImagePath: string | undefined = undefined;

    if (file) {
      // Validasi Magic Bytes PNG (89 50 4E 47 0D 0A 1A 0A)
      if (!this.lsbService.isPng(file.buffer)) {
        throw new BadRequestException('Berkas bukan berkas PNG valid (magic bytes mismatch)');
      }

      // Sanitasi nama berkas untuk mencegah path traversal
      const safeBasename = path.basename(file.originalname).replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `template-${Date.now()}-${safeBasename}`;
      const coversDir = path.join(process.cwd(), 'uploads', 'covers');
      if (!fs.existsSync(coversDir)) {
        fs.mkdirSync(coversDir, { recursive: true });
      }
      const filePath = path.join(coversDir, fileName);
      fs.writeFileSync(filePath, file.buffer);
      templateImagePath = fileName;
    }

    const certPrefix = (body.certificatePrefix || '041/HIMAPROSIF/XI/2026/').trim();
    if (!certPrefix.endsWith('/')) {
      throw new BadRequestException(
        "Format nomor sertifikat harus diakhiri dengan tanda garis miring '/' (contoh: 041/HIMAPROSIF/XI/2026/)",
      );
    }

    return this.eventsService.createEvent({
      eventName: body.eventName,
      eventDate: body.eventDate,
      startTime: body.startTime,
      endTime: body.endTime,
      organizer: body.organizer,
      certificatePrefix: certPrefix,
      templateImagePath,
      templatePositions: body.templatePositions,
      createdBy: req.user?.sub || 'admin',
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch(':id/template-positions')
  async updateTemplatePositions(
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const positions = body.templatePositions !== undefined ? body.templatePositions : body;
    return this.eventsService.updateTemplatePositions(id, positions);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch(':id')
  @Put(':id')
  @UseInterceptors(
    FileInterceptor('templateImage', {
      limits: { fileSize: 10 * 1024 * 1024 }, // Maksimal 10 MB
      fileFilter: (req, file, cb) => {
        if (file) {
          const ext = path.extname(file.originalname).toLowerCase();
          if (ext !== '.png' && file.mimetype !== 'image/png') {
            return cb(
              new BadRequestException('Hanya format PNG yang didukung'),
              false,
            );
          }
        }
        cb(null, true);
      },
    }),
  )
  async update(
    @Param('id') id: string,
    @Body() body: UpdateEventDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    let templateImagePath: string | undefined = undefined;

    if (file) {
      if (!this.lsbService.isPng(file.buffer)) {
        throw new BadRequestException('Berkas bukan berkas PNG valid (magic bytes mismatch)');
      }

      const safeBasename = path.basename(file.originalname).replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `template-${Date.now()}-${safeBasename}`;
      const coversDir = path.join(process.cwd(), 'uploads', 'covers');
      if (!fs.existsSync(coversDir)) {
        fs.mkdirSync(coversDir, { recursive: true });
      }
      const filePath = path.join(coversDir, fileName);
      fs.writeFileSync(filePath, file.buffer);
      templateImagePath = fileName;
    }

    if (body.certificatePrefix !== undefined) {
      const pfx = (body.certificatePrefix || '').trim();
      if (!pfx.endsWith('/')) {
        throw new BadRequestException(
          "Format nomor sertifikat harus diakhiri dengan tanda garis miring '/' (contoh: 041/HIMAPROSIF/XI/2026/)",
        );
      }
    }

    return this.eventsService.updateEvent(id, {
      ...body,
      ...(body.certificatePrefix !== undefined ? { certificatePrefix: body.certificatePrefix.trim() } : {}),
      ...(templateImagePath ? { templateImagePath } : {}),
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.eventsService.deleteEvent(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get(':id/recipients')
  getRecipients(@Param('id') id: string) {
    return this.eventsService.getEventRecipients(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post(':id/recipients')
  addRecipient(@Param('id') id: string, @Body() body: CreateRecipientDto) {
    return this.eventsService.addRecipient(id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post(':id/recipients/import')
  @UseInterceptors(
    FileInterceptor('csvFile', {
      limits: { fileSize: 5 * 1024 * 1024 }, // Maksimal 5 MB
    }),
  )
  importRecipients(
    @Param('id') id: string,
    @Body() body: { csvText?: string; preview?: string | boolean },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    let content = body.csvText || '';
    if (file) {
      content = file.buffer.toString('utf8');
    }

    if (!content.trim()) {
      throw new BadRequestException('Data CSV wajib disertakan lewat file atau teks');
    }

    const isPreview = body.preview === 'true' || body.preview === true;
    return this.eventsService.processCsvImport(id, content, !isPreview);
  }
}
