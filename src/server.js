import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';
import session from 'express-session';
import { pool } from './db.js';
import obrasRouter from './routes/obras.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. Configuramos las sesiones en el servidor
app.use(session({
  secret: 'clave_secreta_super_segura_veeduria_san_pelayo',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Cambiar a true solo si usas HTTPS estricto en producción
}));

// Middleware para proteger rutas administrativas
function requerirAdmin(req, res, next) {
  if (req.session && req.session.adminAutenticado) {
    return next();
  }
  return res.status(401).json({ mensaje: 'No autorizado. Inicia sesión como administrador.' });
}

// --- BLOQUEO DE SEGURIDAD ANTES DE LOS ARCHIVOS ESTÁTICOS ---

app.get('/admin.html', (req, res) => {
  return res.redirect('/login');
});

// Archivos estáticos públicos (index.html, login.html, estilos, app.js, /hero, /galeria, etc.)
app.use(express.static(path.join(__dirname, '../public')));

// Ruta principal para cargar index.html (Nota: si tu index.html está en public, déjalo con ../public/index.html)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Ruta pública para el login (carga login.html)
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/login.html'));
});

// 3. RUTA BLINDADA DEL PANEL ADMINISTRATIVO
app.get('/admin', (req, res) => {
  // Verifica si hay una sesión activa de administrador
  if (req.session && req.session.adminAutenticado) {
    // Si está autenticado, le entrega el admin.html protegido desde la carpeta 'views'
    return res.sendFile(path.join(__dirname, '../views/admin.html'));
  }
  // Si no ha iniciado sesión, lo redirige al login por seguridad
  return res.redirect('/login');
});

// --- RUTA PÚBLICA DE IMÁGENES DEL HERO ---
app.get('/api/hero-imagenes', async (req, res) => {
  try {
    const [filas] = await pool.query(
      'SELECT id, titulo, url_imagen, orden FROM hero_imagenes WHERE activa = 1 ORDER BY orden ASC, id ASC'
    );
    res.json({ imagenes: filas });
  } catch (error) {
    console.error('Error al obtener imágenes del hero:', error);
    res.status(500).json({ mensaje: 'Error interno al cargar las imágenes de portada' });
  }
});

// --- RUTAS ADMINISTRATIVAS DE IMÁGENES DEL HERO (PERSONAS PROPIAS) ---
app.get('/api/admin/hero-imagenes', requerirAdmin, async (req, res) => {
  try {
    const [filas] = await pool.query(
      'SELECT id, titulo, url_imagen, orden, activa, creado_en FROM hero_imagenes ORDER BY orden ASC, id ASC'
    );
    res.json({ imagenes: filas });
  } catch (error) {
    console.error('Error al listar imágenes del hero en admin:', error);
    res.status(500).json({ mensaje: 'Error al obtener las imágenes de portada' });
  }
});

app.post('/api/admin/hero-imagenes', requerirAdmin, async (req, res) => {
  const { titulo, url_imagen, orden = 1, activa = 1 } = req.body;

  if (!titulo || !url_imagen) {
    return res.status(400).json({ mensaje: 'El título y la ruta/URL de la imagen son obligatorios' });
  }

  try {
    const [resultado] = await pool.query(
      'INSERT INTO hero_imagenes (titulo, url_imagen, orden, activa) VALUES (?, ?, ?, ?)',
      [titulo.trim(), url_imagen.trim(), Number(orden) || 1, Number(activa) ? 1 : 0]
    );
    res.status(201).json({
      mensaje: 'Imagen agregada al banner principal',
      id: resultado.insertId
    });
  } catch (error) {
    console.error('Error al agregar imagen al hero:', error);
    res.status(500).json({ mensaje: 'Error al guardar la imagen de portada' });
  }
});

app.put('/api/admin/hero-imagenes/:id', requerirAdmin, async (req, res) => {
  const { id } = req.params;
  const { titulo, url_imagen, orden, activa } = req.body;

  try {
    const [actual] = await pool.query('SELECT * FROM hero_imagenes WHERE id = ?', [id]);
    if (actual.length === 0) {
      return res.status(404).json({ mensaje: 'Imagen no encontrada' });
    }

    const fila = actual[0];
    const nuevoTitulo = titulo !== undefined ? String(titulo).trim() : fila.titulo;
    const nuevaUrl = url_imagen !== undefined ? String(url_imagen).trim() : fila.url_imagen;
    const nuevoOrden = orden !== undefined ? Number(orden) : fila.orden;
    const nuevaActiva = activa !== undefined ? (Number(activa) ? 1 : 0) : fila.activa;

    await pool.query(
      'UPDATE hero_imagenes SET titulo = ?, url_imagen = ?, orden = ?, activa = ? WHERE id = ?',
      [nuevoTitulo, nuevaUrl, nuevoOrden, nuevaActiva, id]
    );

    res.json({ mensaje: 'Imagen del banner actualizada' });
  } catch (error) {
    console.error('Error al actualizar imagen del hero:', error);
    res.status(500).json({ mensaje: 'Error al actualizar la imagen de portada' });
  }
});

app.delete('/api/admin/hero-imagenes/:id', requerirAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const [resultado] = await pool.query('DELETE FROM hero_imagenes WHERE id = ?', [id]);
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ mensaje: 'Imagen no encontrada' });
    }
    res.json({ mensaje: 'Imagen eliminada del banner principal' });
  } catch (error) {
    console.error('Error al eliminar imagen del hero:', error);
    res.status(500).json({ mensaje: 'Error al eliminar la imagen de portada' });
  }
});

// --- ENDPOINT DE AUTENTICACIÓN (LOGIN) ---
app.post('/obras/login', async (req, res) => {
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

    // 4. Guardamos la sesión en el servidor al autenticarse con éxito
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

// Endpoint para cerrar sesión
app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ mensaje: 'Sesión cerrada correctamente' });
  });
});

// Función para auto-crear tablas necesarias al arrancar
async function inicializarBaseDeDatos() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id INT AUTO_INCREMENT PRIMARY KEY,
        cedula VARCHAR(20) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        rol INT NOT NULL DEFAULT 1
      )
    `);
    console.log("Tabla 'usuarios' verificada o creada exitosamente.");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS hero_imagenes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        titulo VARCHAR(120) NOT NULL,
        url_imagen VARCHAR(255) NOT NULL,
        orden INT NOT NULL DEFAULT 1,
        activa TINYINT(1) NOT NULL DEFAULT 1,
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("Tabla 'hero_imagenes' verificada o creada exitosamente.");

    const [rows] = await pool.query('SELECT * FROM usuarios WHERE cedula = ?', ['1073890123']);
    if (rows.length === 0) {
      const hashedPassword = await bcrypt.hash('12ad34m', 10);

      await pool.query('INSERT INTO usuarios (cedula, password, rol) VALUES (?, ?, ?)',
        ['1073890123', hashedPassword, 1]
      );
      console.log("Usuario administrador predeterminado creado con éxito.");
    }
  } catch (error) {
    console.error("Error al inicializar la base de datos:", error);
  }
}

// Ejecutar la inicialización al arrancar
inicializarBaseDeDatos();

// --- RUTAS DE OBRAS ---
app.use('/obras', obrasRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor funcionando en http://localhost:${PORT}`);
});