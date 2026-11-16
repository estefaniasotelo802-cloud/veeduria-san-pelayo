import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';
import session from 'express-session'; // 1. Importamos express-session
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

// Archivos estáticos públicos (index.html, login.html, estilos, app.js, etc.)
app.use(express.static(path.join(__dirname, '../public')));

// Ruta principal para cargar index.html
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

// Bloquear por si alguien intenta escribir /admin.html directamente en la URL
app.get('/admin.html', (req, res) => {
  return res.redirect('/login');
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

// Función para auto-crear la tabla de usuarios y un admin por defecto al arrancar
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