import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Res,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { EventsService, CreateRecipientDto } from './events.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { LsbSteganoService } from '../security/lsb-stego.service';
import * as fs from 'fs';
import * as path from 'path';

@Controller('api/events')
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly lsbService: LsbSteganoService,
  ) {}

  @Get()
  getAll() {
    return this.eventsService.getAllEvents();
  }

  @Get('recipients/template-csv')
  downloadCsvTemplate(@Res() res: Response) {
    const csv = this.eventsService.getCsvTemplate();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="template_penerima_sertifikat.csv"');
    res.send(csv);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.eventsService.getEventById(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post()
  @UseInterceptors(
    FileInterceptor('templateImage', {
      limits: { fileSize: 10 * 1024 * 1024 }, // Maksimal 10 MB (Spec F-03)
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
    @Body()
    body: {
      eventName: string;
      eventDate: string;
      organizer: string;
    },
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    let templateImagePath: string | undefined = undefined;

    if (file) {
      // Validasi Magic Bytes PNG (89 50 4E 47 0D 0A 1A 0A) (Spec F-03)
      if (!this.lsbService.isPng(file.buffer)) {
        throw new BadRequestException('Berkas bukan berkas PNG valid (magic bytes mismatch)');
      }

      const fileName = `template-${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const coversDir = path.join(process.cwd(), 'uploads', 'covers');
      if (!fs.existsSync(coversDir)) {
        fs.mkdirSync(coversDir, { recursive: true });
      }
      const filePath = path.join(coversDir, fileName);
      fs.writeFileSync(filePath, file.buffer);
      templateImagePath = fileName;
    }

    return this.eventsService.createEvent({
      eventName: body.eventName,
      eventDate: body.eventDate,
      organizer: body.organizer,
      templateImagePath,
      createdBy: req.user?.username || 'admin',
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body()
    body: {
      eventName?: string;
      eventDate?: string;
      organizer?: string;
      isActive?: boolean;
    },
  ) {
    return this.eventsService.updateEvent(id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Delete(':id')
  delete(@Param('id') id: string) {
    return { success: this.eventsService.deleteEvent(id) };
  }

  // F-04: Penerima Event
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

  // F-05: Impor Massal CSV
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post(':id/recipients/import')
  @UseInterceptors(FileInterceptor('csvFile'))
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
