// src/services/event.service.js
import { mysqlPool } from '../config/database.js';
import { 
  ValidationError, 
  NotFoundError, 
  DatabaseError,
  AuthorizationError 
} from '../utils/errors/index.js';

// Importar el modelo Event
import { Event } from '../models/mysql/event.model.js';

export class EventService {
  static async createEvent(eventData, userId) {
  // Validaciones iniciales
  if (!eventData.event_name || !eventData.event_date || !eventData.event_time || !eventData.location || !eventData.event_type) {
    throw new ValidationError('Datos de evento incompletos', [
      'event_name',
      'event_date',
      'event_time',
      'location',
      'event_type'
    ]);
  }

  // Asegurarse de que event_time tiene el formato correcto HH:MM:SS
  if (eventData.event_time && eventData.event_time.split(':').length === 2) {
    eventData.event_time = `${eventData.event_time}:00`;
  }

  console.log('Datos de evento a crear:', JSON.stringify(eventData, null, 2));

  const connection = await mysqlPool.getConnection();
  try {
    // Crear el evento
    const eventId = await Event.create({
      ...eventData,
      created_by: userId,
      is_featured: eventData.is_featured === true || eventData.is_featured === 'true' ? true : false
      // Eliminado: is_home ya que no existe en la tabla
    });

    console.log(`Evento creado con ID: ${eventId}`);
    return eventId;
  } catch (error) {
    console.error('Error detallado al crear evento:', error);
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new DatabaseError(`Error al crear el evento: ${error.message}`);
  } finally {
    connection.release();
  }
}

// En event.service.js - método updateEvent
static async updateEvent(id, eventData, userId) {
  if (!id) {
    throw new ValidationError('ID de evento es requerido');
  }

  console.log(`Actualizando evento ${id} con datos:`, JSON.stringify(eventData, null, 2));

  const connection = await mysqlPool.getConnection();
  try {
    // Verificar si el evento existe
    const event = await Event.findById(id);
    
    if (!event) {
      throw new NotFoundError('Evento no encontrado');
    }
    
    // Verificar autorización - solo el creador puede actualizar
    if (event.created_by !== parseInt(userId)) {
      throw new AuthorizationError('No autorizado para actualizar este evento');
    }

    // Eliminar campos no permitidos para actualización
    delete eventData.created_by;
    delete eventData.created_at; 
    delete eventData.updated_at;

    // Asegurarse de que event_time tiene el formato correcto
    if (eventData.event_time && eventData.event_time.split(':').length === 2) {
      eventData.event_time = `${eventData.event_time}:00`;
    }

    // Convertir is_featured a booleano si es string
    if (eventData.is_featured !== undefined) {
      eventData.is_featured = eventData.is_featured === true || eventData.is_featured === 'true';
    }

    // Actualizar evento
    const updated = await Event.update(id, eventData);
    
    console.log(`Evento ${id} actualizado con éxito:`, updated);
    return updated;
  } catch (error) {
    console.error(`Error detallado al actualizar evento ${id}:`, error);
    if (error instanceof ValidationError || 
        error instanceof NotFoundError || 
        error instanceof AuthorizationError) {
      throw error;
    }
    throw new DatabaseError(`Error al actualizar el evento: ${error.message}`);
  } finally {
    connection.release();
  }
}

  static async getEvents(filters = {}) {
    try {
      // Asegurarse de que limit y offset son números
      if (filters.limit) {
        filters.limit = parseInt(filters.limit);
      }
      if (filters.offset) {
        filters.offset = parseInt(filters.offset);
      }
      
      // Este es un método público general, por defecto NO es panel de admin
      const isAdminPanel = filters.isAdminPanel || false;
      
      // Obtener eventos con los filtros proporcionados
      const events = await Event.findAll({
        ...filters,
        isAdminPanel: isAdminPanel
      });
      
      // Obtener el total de eventos con los mismos filtros (sin paginación)
      const total = await Event.count({
        ...filters,
        isAdminPanel: isAdminPanel
      });
      
      return {
        events,
        total,
        page: filters.offset ? Math.floor(filters.offset / filters.limit) + 1 : 1,
        limit: filters.limit ? filters.limit : events.length
      };
    } catch (error) {
      console.error('Error getting events:', error);
      throw new DatabaseError('Error al obtener los eventos');
    }
  }

  // Método específico para el panel de admin
  static async getAdminEvents(filters = {}) {
    try {
      return await EventService.getEvents({
        ...filters,
        isAdminPanel: true
      });
    } catch (error) {
      console.error('Error getting admin events:', error);
      throw new DatabaseError('Error al obtener los eventos para administración');
    }
  }

  static async getFeaturedEvents(limit = 3) {
    try {
      // Asegurarse de que limit es un número
      const limitValue = parseInt(limit);
      
      // Obtener eventos destacados
      const events = await Event.getFeatured(limitValue);
      
      return events;
    } catch (error) {
      console.error('Error getting featured events:', error);
      throw new DatabaseError('Error al obtener los eventos destacados');
    }
  }

  static async getHomeEvents(limit = 6) {
    try {
      // Asegurarse de que limit es un número
      const limitValue = parseInt(limit);
      
      // Obtener eventos para la página de inicio
      const events = await Event.getHomeEvents(limitValue);
      
      return events;
    } catch (error) {
      console.error('Error getting home events:', error);
      throw new DatabaseError('Error al obtener los eventos para la página de inicio');
    }
  }

  static async getEventById(id, isAdmin = false) {
    if (!id) {
      throw new ValidationError('ID de evento es requerido');
    }

    try {
      const event = await Event.findById(id);
      
      if (!event) {
        throw new NotFoundError('Evento no encontrado');
      }
      
      // Si no es admin y el evento no está activo, no mostrar
      if (!isAdmin && event.status !== 'activo') {
        throw new NotFoundError('Evento no encontrado');
      }
      
      return event;
    } catch (error) {
      console.error('Error getting event:', error);
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Error al obtener el evento');
    }
  }

  
  static async deleteEvent(id, userId) {
    if (!id) {
      throw new ValidationError('ID de evento es requerido');
    }

    const connection = await mysqlPool.getConnection();
    try {
      // Verificar si el evento existe
      const event = await Event.findById(id);
      
      if (!event) {
        throw new NotFoundError('Evento no encontrado');
      }
      
      // Verificar autorización - solo el creador puede eliminar
      if (event.created_by !== parseInt(userId)) {
        throw new AuthorizationError('No autorizado para eliminar este evento');
      }

      // Eliminar evento
      const deleted = await Event.delete(id);
      
      return deleted;
    } catch (error) {
      console.error('Error deleting event:', error);
      if (error instanceof ValidationError || 
          error instanceof NotFoundError ||
          error instanceof AuthorizationError) {
        throw error;
      }
      throw new DatabaseError('Error al eliminar el evento');
    } finally {
      connection.release();
    }
  }
  
  static async getEventTypes() {
    try {
      const types = await Event.getEventTypes();
      return types;
    } catch (error) {
      console.error('Error getting event types:', error);
      throw new DatabaseError('Error al obtener los tipos de evento');
    }
  }
  
  static async getEventsByCreator(creatorId, limit = 10) {
    if (!creatorId) {
      throw new ValidationError('ID de creador es requerido');
    }
    
    try {
      const events = await Event.getEventsByCreator(creatorId, limit);
      
      return events;
    } catch (error) {
      console.error('Error getting events by creator:', error);
      throw new DatabaseError('Error al obtener los eventos del creador');
    }
  }

  static async updateFeaturedStatus(id, isFeatured, userId) {
    if (!id) {
      throw new ValidationError('ID de evento es requerido');
    }

    const connection = await mysqlPool.getConnection();
    try {
      // Verificar si el evento existe
      const event = await Event.findById(id);
      
      if (!event) {
        throw new NotFoundError('Evento no encontrado');
      }
      
      // Verificar autorización - solo el creador puede cambiar el estado destacado
      if (event.created_by !== parseInt(userId)) {
        throw new AuthorizationError('No autorizado para actualizar este evento');
      }

      // Actualizar estado destacado
      const updated = await Event.updateFeaturedStatus(id, isFeatured);
      
      return updated;
    } catch (error) {
      console.error('Error updating featured status:', error);
      if (error instanceof ValidationError || 
          error instanceof NotFoundError || 
          error instanceof AuthorizationError) {
        throw error;
      }
      throw new DatabaseError('Error al actualizar el estado destacado del evento');
    } finally {
      connection.release();
    }
  }
  
  static async updateHomeStatus(id, isHome, userId) {
    if (!id) {
      throw new ValidationError('ID de evento es requerido');
    }

    const connection = await mysqlPool.getConnection();
    try {
      // Verificar si el evento existe
      const event = await Event.findById(id);
      
      if (!event) {
        throw new NotFoundError('Evento no encontrado');
      }
      
      // Verificar autorización - solo el creador puede cambiar el estado de inicio
      if (event.created_by !== parseInt(userId)) {
        throw new AuthorizationError('No autorizado para actualizar este evento');
      }

      // Actualizar estado de inicio
      const updated = await Event.updateHomeStatus(id, isHome);
      
      return updated;
    } catch (error) {
      console.error('Error updating home status:', error);
      if (error instanceof ValidationError || 
          error instanceof NotFoundError || 
          error instanceof AuthorizationError) {
        throw error;
      }
      throw new DatabaseError('Error al actualizar el estado de inicio del evento');
    } finally {
      connection.release();
    }
  }
  
  static async updateEventStatus(id, status, userId) {
    if (!id) {
      throw new ValidationError('ID de evento es requerido');
    }
    
    if (!status || !['activo', 'cancelado', 'pospuesto', 'completado'].includes(status)) {
      throw new ValidationError('Estado de evento inválido');
    }

    const connection = await mysqlPool.getConnection();
    try {
      // Verificar si el evento existe
      const event = await Event.findById(id);
      
      if (!event) {
        throw new NotFoundError('Evento no encontrado');
      }
      
      // Verificar autorización - solo el creador puede cambiar el estado
      if (event.created_by !== parseInt(userId)) {
        throw new AuthorizationError('No autorizado para actualizar este evento');
      }

      // Actualizar estado
      const updated = await Event.updateStatus(id, status);
      
      return updated;
    } catch (error) {
      console.error('Error updating event status:', error);
      if (error instanceof ValidationError || 
          error instanceof NotFoundError || 
          error instanceof AuthorizationError) {
        throw error;
      }
      throw new DatabaseError('Error al actualizar el estado del evento');
    } finally {
      connection.release();
    }
  }
  
  static async getUpcomingEvents(limit = 6) {
    try {
      const events = await Event.getUpcomingEvents(limit);
      return events;
    } catch (error) {
      console.error('Error getting upcoming events:', error);
      throw new DatabaseError('Error al obtener los próximos eventos');
    }
  }
}