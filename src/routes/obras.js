import express from 'express';
import { pool } from '../db.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
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

function normalizarPresupuesto(valor) {
  if (typeof valor === 'number') {
    return Number.isFinite(valor) ? valor : 0;
  }
  const limpio = String(valor ?? '')
    .trim()
    .replace(/\$/g, '')
    .replace(/\s+/g, '')
    .replace(/\./g, '')
    .replace(/,/g, '.');
  const num = Number(limpio);
  return Number.isFinite(num) ? num : 0;
}

// Filtro automático en servidor para evitar mensajes inadecuados o spam
function validarContenidoComentario(autor, mensaje) {
  const autorLimpio = (autor || 'Anónimo').trim();
  const textoLimpio = (mensaje || '').trim();

  if (!textoLimpio || textoLimpio.length < 3) {
    return { valido: false, error: 'El comentario debe tener al menos 3 caracteres.' };
  }
  if (textoLimpio.length > 400) {
    return { valido: false, error: 'El comentario no puede superar los 400 caracteres.' };
  }

  const tieneEnlace = /(https?:\/\/|www\.|\.(com|co|net|org|io|gg|me|ly)\b)/i.test(textoLimpio);
  if (tieneEnlace) {
    return { valido: false, error: 'No se permiten enlaces ni direcciones web en los comentarios.' };
  }

  if (/(.)\1{6,}/i.test(textoLimpio)) {
    return { valido: false, error: 'Evita repetir el mismo carácter muchas veces seguidas.' };
  }

  const palabrasBloqueadas = [
    'idiota', 'imbecil', 'imbécil', 'estupido', 'estúpido',
    'basura', 'mierda', 'puta', 'puto', 'malparido', 'gonorrea', 'hp'
  ];
  const normalizado = textoLimpio
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const bloqueada = palabrasBloqueadas.find((palabra) => {
    const escapada = palabra.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escapada}\\b`, 'i').test(normalizado);
  });

  if (bloqueada) {
    return { valido: false, error: 'El comentario contiene lenguaje inadecuado.' };
  }

  return { valido: true, autor: autorLimpio || 'Anónimo', mensaje: textoLimpio };
}

// Sembrado automático y creación/actualización automática de tablas en MySQL
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS obras (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL,
        sector VARCHAR(255) NOT NULL,
        presupuesto DECIMAL(15,2) DEFAULT 0,
        estado VARCHAR(100) DEFAULT 'En ejecución',
        avance_porcentaje INT DEFAULT 0,
        latitud DECIMAL(10,8) DEFAULT 8.96500000,
        longitud DECIMAL(11,8) DEFAULT -75.84500000,
        justificacion TEXT DEFAULT NULL,
        ejecucion TEXT DEFAULT NULL
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS comentarios (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ciudadano VARCHAR(255) DEFAULT 'Anónimo',
        comentario TEXT NOT NULL,
        obra_id INT DEFAULT NULL,
        parent_id INT DEFAULT NULL,
        delete_token VARCHAR(100) DEFAULT NULL,
        reportes INT DEFAULT 0,
        fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS comentario_reacciones (
        id INT AUTO_INCREMENT PRIMARY KEY,
        comentario_id INT NOT NULL,
        device_id VARCHAR(100) NOT NULL,
        emoji VARCHAR(16) NOT NULL,
        UNIQUE KEY uniq_reaccion_dispositivo (comentario_id, device_id)
      )
    `);

    const columnasFaltantes = [
      "ALTER TABLE obras ADD COLUMN justificacion TEXT DEFAULT NULL",
      "ALTER TABLE obras ADD COLUMN ejecucion TEXT DEFAULT NULL",
      "ALTER TABLE comentarios ADD COLUMN ciudadano VARCHAR(255) DEFAULT 'Anónimo'",
      "ALTER TABLE comentarios ADD COLUMN comentario TEXT",
      "ALTER TABLE comentarios ADD COLUMN obra_id INT DEFAULT NULL",
      "ALTER TABLE comentarios ADD COLUMN parent_id INT DEFAULT NULL",
      "ALTER TABLE comentarios ADD COLUMN delete_token VARCHAR(100) DEFAULT NULL",
      "ALTER TABLE comentarios ADD COLUMN reportes INT DEFAULT 0",
      "ALTER TABLE comentarios ADD COLUMN fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
    ];

    for (const sql of columnasFaltantes) {
      try {
        await pool.query(sql);
      } catch (err) {
        // Ignorar si la columna ya existe (Error 1060)
      }
    }

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

// 2. ENDPOINTS DE AUTENTICACIÓN Y VISTAS PROTEGIDAS

router.get('/login', (req, res) => {
  res.sendFile(path.resolve('public/login.html'));
});

router.get('/admin', (req, res) => {
  if (req.session && req.session.adminAutenticado) {
    return res.sendFile(path.resolve('public/admin.html'));
  }
  res.redirect('/obras/login');
});

router.post('/login', async (req, res) => {
  const { cedula, password } = req.body;

  try {
    const [rows] = await pool.query('SELECT * FROM usuarios WHERE cedula = ?', [cedula]);

    if (rows.length === 0) {
      return res.status(401).json({ mensaje: 'Usuario o contraseña incorrecta' });
    }

    const usuario = rows[0];
    const coincide = await bcrypt.compare(password, usuario.password);

    if (!coincide) {
      return res.status(401).json({ mensaje: 'Usuario o contraseña incorrecta' });
    }

    if (usuario.rol !== 1) {
      return res.status(403).json({ mensaje: 'Acceso denegado. No tienes permisos de administrador.' });
    }

    req.session.adminAutenticado = true;
    req.session.cedula = usuario.cedula;

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

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ mensaje: 'Sesión cerrada correctamente' });
  });
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
  const {
    nombre,
    sector,
    presupuesto,
    estado,
    avance,
    porcentaje,
    latitud,
    longitud,
    justificacion,
    ejecucion
  } = req.body;

  const presupuestoLimpio = normalizarPresupuesto(presupuesto);
  const valorAvance = avance !== undefined && avance !== '' ? avance : (porcentaje !== undefined && porcentaje !== '' ? porcentaje : 0);
  const lat = latitud ? parseFloat(latitud) : 8.96500000;
  const lng = longitud ? parseFloat(longitud) : -75.84500000;
  const justTexto = justificacion && String(justificacion).trim() !== '' ? String(justificacion).trim() : null;
  const ejecTexto = ejecucion && String(ejecucion).trim() !== '' ? String(ejecucion).trim() : null;

  try {
    const [resultado] = await pool.query(
      'INSERT INTO obras (nombre, sector, presupuesto, estado, avance_porcentaje, latitud, longitud, justificacion, ejecucion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [nombre, sector, presupuestoLimpio, estado, valorAvance, lat, lng, justTexto, ejecTexto]
    );
    res.status(201).json({ mensaje: 'Obra registrada con éxito', id: resultado.insertId });
  } catch (error) {
    console.error('Error al crear obra:', error);
    res.status(500).json({ mensaje: 'Error al registrar la obra' });
  }
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const {
    nombre,
    sector,
    presupuesto,
    estado,
    avance,
    porcentaje,
    latitud,
    longitud,
    justificacion,
    ejecucion
  } = req.body;

  const presupuestoLimpio = normalizarPresupuesto(presupuesto);
  const valorAvance = avance !== undefined && avance !== '' ? avance : (porcentaje !== undefined && porcentaje !== '' ? porcentaje : 0);
  const justTexto = justificacion && String(justificacion).trim() !== '' ? String(justificacion).trim() : null;
  const ejecTexto = ejecucion && String(ejecucion).trim() !== '' ? String(ejecucion).trim() : null;

  try {
    const camposUpdate = [
      'nombre = ?',
      'sector = ?',
      'presupuesto = ?',
      'estado = ?',
      'avance_porcentaje = ?',
      'justificacion = ?',
      'ejecucion = ?'
    ];
    const valoresUpdate = [
      nombre,
      sector,
      presupuestoLimpio,
      estado,
      valorAvance,
      justTexto,
      ejecTexto
    ];

    if (latitud !== undefined && latitud !== null && !Number.isNaN(parseFloat(latitud))) {
      camposUpdate.push('latitud = ?');
      valoresUpdate.push(parseFloat(latitud));
    }
    if (longitud !== undefined && longitud !== null && !Number.isNaN(parseFloat(longitud))) {
      camposUpdate.push('longitud = ?');
      valoresUpdate.push(parseFloat(longitud));
    }

    valoresUpdate.push(id);

    const [resultado] = await pool.query(
      `UPDATE obras SET ${camposUpdate.join(', ')} WHERE id = ?`,
      valoresUpdate
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

// 4. ENDPOINTS DE COMENTARIOS, RESPUESTAS, REACCIONES Y ELIMINACIÓN PROPIA

router.get('/comentarios', async (req, res) => {
  const deviceId = String(req.query.deviceId || '').trim();

  try {
    const [comentarios] = await pool.query(`
      SELECT c.id, c.ciudadano, c.comentario, c.obra_id, c.parent_id, c.reportes, c.fecha,
             o.nombre AS obra_nombre
      FROM comentarios c
      LEFT JOIN obras o ON c.obra_id = o.id
      ORDER BY c.id DESC
    `);

    const [reacciones] = await pool.query(`
      SELECT comentario_id, emoji, COUNT(*) AS total
      FROM comentario_reacciones
      GROUP BY comentario_id, emoji
    `);

    let misReacciones = {};
    if (deviceId) {
      const [mias] = await pool.query(
        'SELECT comentario_id, emoji FROM comentario_reacciones WHERE device_id = ?',
        [deviceId]
      );
      mias.forEach((r) => {
        misReacciones[r.comentario_id] = r.emoji;
      });
    }

    const mapaReacciones = {};
    reacciones.forEach((r) => {
      if (!mapaReacciones[r.comentario_id]) mapaReacciones[r.comentario_id] = {};
      mapaReacciones[r.comentario_id][r.emoji] = Number(r.total || 0);
    });

    const enriquecidos = comentarios.map((c) => ({
      ...c,
      reacciones: mapaReacciones[c.id] || {},
      mi_reaccion: misReacciones[c.id] || null
    }));

    res.json(enriquecidos);
  } catch (error) {
    console.error('Error al obtener comentarios:', error);
    res.json([]);
  }
});

router.post('/comentarios', async (req, res) => {
  try {
    const { ciudadano, nombre, comentario, texto, obra_id, parent_id } = req.body;
    const validacion = validarContenidoComentario(ciudadano || nombre, comentario || texto);

    if (!validacion.valido) {
      return res.status(400).json({ error: validacion.error });
    }

    const autor = validacion.autor;
    const mensaje = validacion.mensaje;
    const idObra = obra_id ? Number(obra_id) : null;
    const idPadre = parent_id && /^\d+$/.test(String(parent_id)) ? Number(parent_id) : null;
    const deleteToken = crypto.randomBytes(16).toString('hex');

    const [columnas] = await pool.query('SHOW COLUMNS FROM comentarios');
    const nombresColumnas = columnas.map((c) => c.Field);

    const campos = [];
    const valores = [];

    if (nombresColumnas.includes('ciudadano')) {
      campos.push('ciudadano');
      valores.push(autor);
    }
    if (nombresColumnas.includes('nombre')) {
      campos.push('nombre');
      valores.push(autor);
    }
    if (nombresColumnas.includes('comentario')) {
      campos.push('comentario');
      valores.push(mensaje);
    }
    if (nombresColumnas.includes('texto')) {
      campos.push('texto');
      valores.push(mensaje);
    }
    if (nombresColumnas.includes('obra_id')) {
      campos.push('obra_id');
      valores.push(idObra);
    }
    if (nombresColumnas.includes('parent_id')) {
      campos.push('parent_id');
      valores.push(idPadre);
    }
    if (nombresColumnas.includes('delete_token')) {
      campos.push('delete_token');
      valores.push(deleteToken);
    }

    const placeholders = campos.map(() => '?').join(', ');
    const sql = `INSERT INTO comentarios (${campos.join(', ')}) VALUES (${placeholders})`;

    const [resultado] = await pool.query(sql, valores);

    return res.status(201).json({
      mensaje: 'Comentario guardado',
      id: resultado.insertId,
      delete_token: deleteToken
    });
  } catch (error) {
    console.error('Error real de MySQL al guardar comentario:', error);
    res.status(500).json({
      error: 'Error al guardar el comentario',
      detalle: error.sqlMessage || error.message
    });
  }
});

// Reaccionar con emoji (alterna o cambia la reacción del dispositivo)
router.post('/comentarios/:id/reaccionar', async (req, res) => {
  const { id } = req.params;
  const { emoji, deviceId } = req.body || {};
  const emojisPermitidos = ['👍', '❤️', '👏', '😮', '😢'];

  if (!/^\d+$/.test(String(id)) || !emojisPermitidos.includes(emoji) || !deviceId) {
    return res.status(400).json({ error: 'Reacción no válida.' });
  }

  try {
    const [existente] = await pool.query(
      'SELECT emoji FROM comentario_reacciones WHERE comentario_id = ? AND device_id = ?',
      [id, String(deviceId)]
    );

    if (existente.length > 0 && existente[0].emoji === emoji) {
      await pool.query(
        'DELETE FROM comentario_reacciones WHERE comentario_id = ? AND device_id = ?',
        [id, String(deviceId)]
      );
    } else if (existente.length > 0) {
      await pool.query(
        'UPDATE comentario_reacciones SET emoji = ? WHERE comentario_id = ? AND device_id = ?',
        [emoji, id, String(deviceId)]
      );
    } else {
      await pool.query(
        'INSERT INTO comentario_reacciones (comentario_id, device_id, emoji) VALUES (?, ?, ?)',
        [id, String(deviceId), emoji]
      );
    }

    res.json({ mensaje: 'Reacción actualizada' });
  } catch (error) {
    console.error('Error al reaccionar:', error);
    res.status(500).json({ error: 'No se pudo registrar la reacción' });
  }
});

// Reportar comentario
router.post('/comentarios/:id/reportar', async (req, res) => {
  const { id } = req.params;
  if (!/^\d+$/.test(String(id))) {
    return res.status(200).json({ mensaje: 'Reporte registrado localmente', reportes: 0, oculto: false });
  }

  try {
    await pool.query('UPDATE comentarios SET reportes = COALESCE(reportes, 0) + 1 WHERE id = ?', [id]);
    const [filas] = await pool.query('SELECT reportes FROM comentarios WHERE id = ?', [id]);
    const totalReportes = filas.length > 0 ? Number(filas[0].reportes || 0) : 0;

    res.json({
      mensaje: 'Comentario reportado',
      reportes: totalReportes,
      oculto: totalReportes >= 3
    });
  } catch (error) {
    console.error('Error al registrar reporte en MySQL:', error);
    res.status(200).json({ mensaje: 'Reporte registrado', reportes: 0, oculto: false });
  }
});

// Eliminar comentario (autor con delete_token O administrador autenticado)
router.delete('/comentarios/:id', async (req, res) => {
  const { id } = req.params;
  const esAdmin = Boolean(req.session && req.session.adminAutenticado);
  const tokenCliente = String((req.body && req.body.delete_token) || req.headers['x-delete-token'] || '').trim();

  try {
    if (!esAdmin) {
      if (!tokenCliente) {
        return res.status(403).json({ error: 'No tienes permiso para eliminar este comentario.' });
      }
      const [rows] = await pool.query('SELECT delete_token FROM comentarios WHERE id = ?', [id]);
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Comentario no encontrado.' });
      }
      if (!rows[0].delete_token || rows[0].delete_token !== tokenCliente) {
        return res.status(403).json({ error: 'Solo quien publicó este comentario puede eliminarlo.' });
      }
    }

    // Borra también sus respuestas hijas y reacciones asociadas
    await pool.query('DELETE FROM comentario_reacciones WHERE comentario_id = ?', [id]).catch(() => {});
    await pool.query('DELETE FROM comentarios WHERE parent_id = ?', [id]).catch(() => {});
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