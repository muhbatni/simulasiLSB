import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService, EventEntity } from '../database/database.service';

@Injectable()
export class EventsService {
  constructor(private readonly db: DatabaseService) {}

  getAllEvents(): EventEntity[] {
    return this.db.events.map((evt) => {
      const count = this.db.certificates.filter((c) => c.eventId === evt.id).length;
      return { ...evt, totalCertificates: count };
    });
  }

  getEventById(id: string): EventEntity {
    const evt = this.db.events.find((e) => e.id === id);
    if (!evt) throw new NotFoundException(`Event dengan ID ${id} tidak ditemukan`);
    const count = this.db.certificates.filter((c) => c.eventId === evt.id).length;
    return { ...evt, totalCertificates: count };
  }

  createEvent(data: {
    eventName: string;
    eventDate: string;
    organizer: string;
    templateImagePath?: string;
    createdBy: string;
  }): EventEntity {
    const newEvent: EventEntity = {
      id: `evt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      eventName: data.eventName,
      eventDate: data.eventDate,
      organizer: data.organizer,
      templateImagePath: data.templateImagePath,
      createdBy: data.createdBy,
      createdAt: new Date().toISOString(),
    };

    this.db.events.unshift(newEvent);
    this.db.saveData();
    return newEvent;
  }

  deleteEvent(id: string): boolean {
    const idx = this.db.events.findIndex((e) => e.id === id);
    if (idx === -1) throw new NotFoundException(`Event dengan ID ${id} tidak ditemukan`);
    this.db.events.splice(idx, 1);
    this.db.saveData();
    return true;
  }
}
