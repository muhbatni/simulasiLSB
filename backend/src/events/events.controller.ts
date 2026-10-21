import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { EventsService } from './events.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import * as fs from 'fs';
import * as path from 'path';

@Controller('api/events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  getAll() {
    return this.eventsService.getAllEvents();
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.eventsService.getEventById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(
    FileInterceptor('templateImage', {
      fileFilter: (req, file, cb) => {
        // Black-Box Skenario 4: Validasi Format
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext !== '.png' && file.mimetype !== 'image/png') {
          return cb(
            new BadRequestException('Hanya format PNG yang didukung'),
            false,
          );
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
      const fileName = `template-${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const filePath = path.join(process.cwd(), 'uploads', 'covers', fileName);
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

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  delete(@Param('id') id: string) {
    return { success: this.eventsService.deleteEvent(id) };
  }
}
