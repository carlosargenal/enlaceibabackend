// src/services/blog.service.js
import { mysqlPool } from '../config/database.js';
import { 
  ValidationError, 
  NotFoundError, 
  DatabaseError,
  AuthorizationError 
} from '../utils/errors/index.js';

// Importar el modelo Blog
import { Blog } from '../models/mysql/blog.model.js';

export class BlogService {
  static async createBlog(blogData, userId) {
    // Validaciones iniciales
    if (!blogData.title || !blogData.category || !blogData.content) {
      throw new ValidationError('Datos de blog incompletos', [
        'title',
        'category',
        'content'
      ]);
    }

    const connection = await mysqlPool.getConnection();
    try {
      // Crear el blog
      const blogId = await Blog.create({
        ...blogData,
        author_id: userId,
        is_featured: blogData.is_featured || false
      });

      return blogId;
    } catch (error) {
      console.error('Error creating blog:', error);
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError('Error al crear el blog');
    } finally {
      connection.release();
    }
  }

  // Modificación en src/services/blog.service.js
// Método getBlogs mejorado para manejar la visualización de blogs activos/inactivos
static async getBlogs(filters = {}) {
  try {
    // Asegurarse de que limit y offset son números
    if (filters.limit) {
      filters.limit = parseInt(filters.limit);
    }
    if (filters.offset) {
      filters.offset = parseInt(filters.offset);
    }
    
    // Obtener blogs con los filtros proporcionados (incluyendo posiblemente active)
    const blogs = await Blog.findAll(filters);
    
    // Usar los mismos filtros para obtener el total
    const total = await Blog.count(filters);
    
    return {
      blogs,
      total,
      page: filters.offset ? Math.floor(filters.offset / filters.limit) + 1 : 1,
      limit: filters.limit ? filters.limit : blogs.length
    };
  } catch (error) {
    console.error('Error getting blogs:', error);
    throw new DatabaseError('Error al obtener los blogs');
  }
}
// Método específico para obtener blogs para administradores (incluidos inactivos)
static async getAdminBlogs(filters = {}) {
  try {
    // Asegurar que limit y offset son números
    if (filters.limit) {
      filters.limit = parseInt(filters.limit);
    }
    if (filters.offset) {
      filters.offset = parseInt(filters.offset);
    }
    
    // Para administradores, permitir filtrado específico de active si se proporciona
    // Si no se proporciona, mostrar todos los blogs (activos e inactivos)
    
    // Obtener blogs sin filtro de active por defecto
    const blogs = await Blog.findAll(filters);
    
    // Obtener total con los mismos filtros
    const total = await Blog.count(filters);
    
    return {
      blogs,
      total,
      page: filters.offset ? Math.floor(filters.offset / filters.limit) + 1 : 1,
      limit: filters.limit ? filters.limit : blogs.length
    };
  } catch (error) {
    console.error('Error getting admin blogs:', error);
    throw new DatabaseError('Error al obtener los blogs para administración');
  }
}
static async getFeaturedBlogs(limit = 2) {
  try {
    // Asegurarse de que limit es un número
    const limitValue = parseInt(limit);
    
    // Obtener blogs destacados
    const blogs = await Blog.getFeatured(limitValue);
    
    return blogs;
  } catch (error) {
    console.error('Error getting featured blogs:', error);
    throw new DatabaseError('Error al obtener los blogs destacados');
  }
}

  

  static async getBlogById(id) {
    if (!id) {
      throw new ValidationError('ID de blog es requerido');
    }

    try {
      const blog = await Blog.findById(id);
      
      if (!blog) {
        throw new NotFoundError('Blog no encontrado');
      }
      
      return blog;
    } catch (error) {
      console.error('Error getting blog:', error);
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Error al obtener el blog');
    }
  }

  static async updateBlog(id, blogData, userId) {
    if (!id) {
      throw new ValidationError('ID de blog es requerido');
    }

    const connection = await mysqlPool.getConnection();
    try {
      // Verificar si el blog existe
      const blog = await Blog.findById(id);
      
      if (!blog) {
        throw new NotFoundError('Blog no encontrado');
      }
      
      // Verificar autorización - solo el autor puede actualizar
      if (blog.author_id !== parseInt(userId)) {
        throw new AuthorizationError('No autorizado para actualizar este blog');
      }

      // Actualizar blog
      const updated = await Blog.update(id, blogData);
      
      return updated;
    } catch (error) {
      console.error('Error updating blog:', error);
      if (error instanceof ValidationError || 
          error instanceof NotFoundError || 
          error instanceof AuthorizationError) {
        throw error;
      }
      throw new DatabaseError('Error al actualizar el blog');
    } finally {
      connection.release();
    }
  }
  // Añadir al final de src/services/blog.service.js
static async updateBlogStatus(id, isActive, userId) {
  if (!id) {
    throw new ValidationError('ID de blog es requerido');
  }

  const connection = await mysqlPool.getConnection();
  try {
    // Verificar si el blog existe
    const blog = await Blog.findById(id);
    
    if (!blog) {
      throw new NotFoundError('Blog no encontrado');
    }
    
    // Verificar autorización - solo el autor puede cambiar el estado
    if (blog.author_id !== parseInt(userId)) {
      throw new AuthorizationError('No autorizado para actualizar este blog');
    }

    // Actualizar estado activo
    const updated = await Blog.updateActiveStatus(id, isActive);
    
    return updated;
  } catch (error) {
    console.error('Error updating active status:', error);
    if (error instanceof ValidationError || 
        error instanceof NotFoundError || 
        error instanceof AuthorizationError) {
      throw error;
    }
    throw new DatabaseError('Error al actualizar el estado del blog');
  } finally {
    connection.release();
  }
}

  static async deleteBlog(id, userId) {
    if (!id) {
      throw new ValidationError('ID de blog es requerido');
    }

    const connection = await mysqlPool.getConnection();
    try {
      // Verificar si el blog existe
      const blog = await Blog.findById(id);
      
      if (!blog) {
        throw new NotFoundError('Blog no encontrado');
      }
      
      // Verificar autorización - solo el autor puede eliminar
      if (blog.author_id !== parseInt(userId)) {
        throw new AuthorizationError('No autorizado para eliminar este blog');
      }

      // Eliminar blog
      const deleted = await Blog.delete(id);
      
      return deleted;
    } catch (error) {
      console.error('Error deleting blog:', error);
      if (error instanceof ValidationError || 
          error instanceof NotFoundError ||
          error instanceof AuthorizationError) {
        throw error;
      }
      throw new DatabaseError('Error al eliminar el blog');
    } finally {
      connection.release();
    }
  }
  
  static async getBlogCategories() {
    try {
      const categories = await Blog.getCategories();
      return categories;
    } catch (error) {
      console.error('Error getting blog categories:', error);
      throw new DatabaseError('Error al obtener las categorías de blog');
    }
  }
  
  static async getBlogsByAuthor(authorId, limit = 10) {
    if (!authorId) {
      throw new ValidationError('ID de autor es requerido');
    }
    
    try {
      const blogs = await Blog.findAll({
        author_id: authorId,
        limit: limit
      });
      
      return blogs;
    } catch (error) {
      console.error('Error getting blogs by author:', error);
      throw new DatabaseError('Error al obtener los blogs del autor');
    }
  }

  static async updateFeaturedStatus(id, isFeatured, userId) {
  if (!id) {
    throw new ValidationError('ID de blog es requerido');
  }

  const connection = await mysqlPool.getConnection();
  try {
    // Verificar si el blog existe
    const blog = await Blog.findById(id);
    
    if (!blog) {
      throw new NotFoundError('Blog no encontrado');
    }
    
    // Buscar información del usuario para verificar si es admin
    const [userRows] = await connection.query(
      'SELECT role FROM users WHERE id = ?', 
      [userId]
    );
    
    const isAdmin = userRows.length > 0 && userRows[0].role === 'admin';
    
    // Verificar autorización - solo el autor o admins pueden cambiar el estado destacado
    if (blog.author_id !== parseInt(userId) && !isAdmin) {
      throw new AuthorizationError('No autorizado para actualizar este blog');
    }

    // Actualizar estado destacado
    const updated = await Blog.updateFeaturedStatus(id, isFeatured);
    
    return updated;
  } catch (error) {
    console.error('Error updating featured status:', error);
    if (error instanceof ValidationError || 
        error instanceof NotFoundError || 
        error instanceof AuthorizationError) {
      throw error;
    }
    throw new DatabaseError('Error al actualizar el estado destacado del blog');
  } finally {
    connection.release();
  }
}
}