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

// Sembrado automático al encender el servidor y creación automática de tablas si faltan
(async () => {
  try {
    // Asegurar que la tabla comentarios exista en MySQL
    await pool.query(`
      CREATE TABLE IF NOT EXISTS comentarios (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ciudadano VARCHAR(255) DEFAULT 'Anónimo',
        comentario TEXT NOT NULL,
        obra_id INT DEFAULT NULL,
        fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

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
    console.error('Error al inicializar la base de datos:', error);
  }
})();

// 2. ENDPOINTS DE AUTENTICACIÓN Y VISTAS

router.get('/login', (req, res) => {
  res.sendFile(path.resolve('public/login.html'));
});

router.get('/admin', (req, res) => {
  res.sendFile(path.resolve('public/admin.html'));
});

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

router.get('/', async (req, res) => {
  try {
    const [obras] = await pool.query('SELECT * FROM obras ORDER BY id DESC');
    res.json(obras);
  } catch (error) {
    console.error('Error al obtener obras:', error);
    res.status(500).json({ mensaje: 'Error al consultar las obras' });
  }
});

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

// 4. ENDPOINTS DE COMENTARIOS (Blindados con auto-creación de tabla y respaldos)

router.get('/comentarios', async (req, res) => {
    try {
        const [comentarios] = await pool.query(`
            SELECT c.*, o.nombre AS obra_nombre 
            FROM comentarios c
            LEFT JOIN obras o ON c.obra_id = o.id
            ORDER BY c.id DESC
        `);
        res.json(comentarios);
    } catch (error1) {
        try {
            const [comentariosSimples] = await pool.query('SELECT * FROM comentarios ORDER BY id DESC');
            res.json(comentariosSimples);
        } catch (error2) {
            console.error('Error al obtener comentarios:', error2);
            res.json([]);
        }
    }
});

router.post('/comentarios', async (req, res) => {
    try {
        const { ciudadano, nombre, comentario, texto, obra_id } = req.body;
        const autor = ciudadano || nombre || 'Anónimo';
        const mensaje = comentario || texto || '';
        const idObra = obra_id ? obra_id : null;

        try {
            const [resultado] = await pool.query(
                'INSERT INTO comentarios (ciudadano, comentario, obra_id, fecha) VALUES (?, ?, ?, NOW())',
                [autor, mensaje, idObra]
            );
            return res.status(201).json({ mensaje: 'Comentario guardado', id: resultado.insertId });
        } catch (e1) {
            try {
                const [resultado] = await pool.query(
                    'INSERT INTO comentarios (nombre, texto) VALUES (?, ?)',
                    [autor, mensaje]
                );
                return res.status(201).json({ mensaje: 'Comentario guardado', id: resultado.insertId });
            } catch (e2) {
                const [resultado] = await pool.query(
                    'INSERT INTO comentarios (ciudadano, comentario) VALUES (?, ?)',
                    [autor, mensaje]
                );
                return res.status(201).json({ mensaje: 'Comentario guardado', id: resultado.insertId });
            }
        }
    } catch (error) {
        console.error('Error al guardar comentario:', error);
        res.status(500).json({ error: 'Error al guardar el comentario' });
    }
});

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