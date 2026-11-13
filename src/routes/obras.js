import express from 'express';
import { pool } from '../db.js';
import bcrypt from 'bcrypt';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// 1. LISTA DE ADMINISTRADORES AUTORIZADOS
const administradoresAutorizados = [
  { cedula: '1073890123', passwordPlana: '12ad34m' },
  { cedula: '1073821752', passwordPlana: '34angela76' },
  { cedula: '7350284', passwordPlana: 'val6790' }
];

// Sembrado automático al encender el servidor
(async () => {
  try {
    const saltRounds = 10;
    for (const admin of administradoresAutorizados) {
      const passwordHash = await bcrypt.hash(admin.passwordPlana, saltRounds);
      const [existe] = await pool.query('SELECT * FROM usuarios WHERE cedula = ?', [admin.cedula]);

      if (existe.length === 0) {
        await pool.query(
          'INSERT INTO usuarios (cedula, password, rol) VALUES (?, ?, ?)',
          [admin.cedula, passwordHash, 1]
        );
      } else {
        await pool.query(
          'UPDATE usuarios SET password = ?, rol = 1 WHERE cedula = ?',
          [passwordHash, admin.cedula]
        );
      }
    }
  } catch (error) {
    console.error('Error al sincronizar administradores:', error);
  }
})();

// 2. ENDPOINTS DE AUTENTICACIÓN Y VISTAS

// Ruta GET para mostrar la vista del login en el navegador (apuntando correctamente a la carpeta public de la raíz)
router.get('/login', (req, res) => {
  res.sendFile(path.resolve('public/login.html'));
});

// Ruta GET para mostrar el panel admin de forma limpia
router.get('/admin', (req, res) => {
  res.sendFile(path.resolve('public/admin.html'));
});

// Ruta POST para procesar el inicio de sesión
router.post('/login', async (req, res) => {
  const { cedula, password } = req.body;

  try {
    const [rows] = await pool.query('SELECT * FROM usuarios WHERE cedula = ?', [cedula]);

    if (rows.length === 0) {
      return res.status(401).json({ mensaje: 'Cédula o contraseña incorrectos' });
    }

    const usuario = rows[0];
    const coincide = await bcrypt.compare(password, usuario.password);

    if (!coincide) {
      return res.status(401).json({ mensaje: 'Cédula o contraseña incorrectos' });
    }

    if (usuario.rol !== 1) {
      return res.status(403).json({ mensaje: 'Acceso denegado. No tienes permisos de administrador.' });
    }

    res.json({
      mensaje: 'Acceso concedido',
      usuario: {
        id: usuario.id,
        cedula: usuario.cedula,
        rol: usuario.rol
      }
    });

  } catch (error) {
    console.error('Error en el proceso de login:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
});

// 3. ENDPOINTS DE GESTIÓN DE OBRAS

// Obtener todas las obras
router.get('/', async (req, res) => {
  try {
    const [obras] = await pool.query('SELECT * FROM obras ORDER BY id DESC');
    res.json(obras);
  } catch (error) {
    console.error('Error al obtener obras:', error);
    res.status(500).json({ mensaje: 'Error al consultar las obras' });
  }
});

// Crear una nueva obra 
router.post('/', async (req, res) => {
  const { nombre, sector, presupuesto, estado, avance, porcentaje, latitud, longitud } = req.body;
  
  const valorAvance = avance !== undefined && avance !== '' ? avance : (porcentaje !== undefined && porcentaje !== '' ? porcentaje : 0);
  const lat = latitud ? parseFloat(latitud) : 8.96500000;
  const lng = longitud ? parseFloat(longitud) : -75.84500000;

  try {
    const [resultado] = await pool.query(
      'INSERT INTO obras (nombre, sector, presupuesto, estado, avance_porcentaje, latitud, longitud) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [nombre, sector, presupuesto, estado, valorAvance, lat, lng]
    );
    res.status(201).json({ mensaje: 'Obra registrada con éxito', id: resultado.insertId });
  } catch (error) {
    console.error('Error al crear obra:', error);
    res.status(500).json({ mensaje: 'Error al registrar la obra' });
  }
});

// Actualizar una obra existente (PUT)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, sector, presupuesto, estado, avance, porcentaje } = req.body;

  const valorAvance = avance !== undefined && avance !== '' ? avance : (porcentaje !== undefined && porcentaje !== '' ? porcentaje : 0);

  try {
    const [resultado] = await pool.query(
      'UPDATE obras SET nombre = ?, sector = ?, presupuesto = ?, estado = ?, avance_porcentaje = ? WHERE id = ?',
      [nombre, sector, presupuesto, estado, valorAvance, id]
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({ mensaje: 'Obra no encontrada' });
    }

    res.json({ mensaje: 'Obra actualizada correctamente' });
  } catch (error) {
    console.error('Error al actualizar obra:', error);
    res.status(500).json({ mensaje: 'Error al actualizar la obra' });
  }
});

// Eliminar una obra
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [resultado] = await pool.query('DELETE FROM obras WHERE id = ?', [id]);
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ mensaje: 'Obra no encontrada' });
    }
    res.json({ mensaje: 'Obra eliminada correctamente' });
  } catch (error) {
    console.error('Error al eliminar obra:', error);
    res.status(500).json({ mensaje: 'Error al eliminar la obra' });
  }
});

// Obtener todos los comentarios
router.get('/comentarios', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM comentarios ORDER BY id DESC');
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener comentarios:', error);
        res.status(500).json({ mensaje: 'Error al obtener los comentarios' });
    }
});

// Registrar un nuevo comentario
router.post('/comentarios', async (req, res) => {
    const { nombre, comentario } = req.body;

    if (!nombre || !comentario) {
        return res.status(400).json({ mensaje: 'Todos los campos son obligatorios' });
    }

    try {
        await pool.query(
            'INSERT INTO comentarios (nombre, comentario) VALUES (?, ?)',
            [nombre, comentario]
        );
        res.status(201).json({ mensaje: 'Comentario publicado con éxito' });
    } catch (error) {
        console.error('Error al registrar comentario:', error);
        res.status(500).json({ mensaje: 'Error al publicar el comentario' });
    }
});

// Eliminar un comentario por ID
router.delete('/comentarios/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [resultado] = await pool.query('DELETE FROM comentarios WHERE id = ?', [id]);
        if (resultado.affectedRows === 0) {
            return res.status(404).json({ mensaje: 'Comentario no encontrado' });
        }
        res.json({ mensaje: 'Comentario eliminado correctamente' });
    } catch (error) {
        console.error('Error al eliminar comentario:', error);
        res.status(500).json({ mensaje: 'Error al eliminar el comentario' });
    }
});

export default router;