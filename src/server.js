import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';
import { pool } from './db.js';
import obrasRouter from './routes/obras.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());

// Archivos estáticos
app.use(express.static(path.join(__dirname, '../public')));

// Ruta principal para cargar index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// --- ENDPOINT DE AUTENTICACIÓN (LOGIN) ---
app.post('/login', async (req, res) => {
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

// Función para auto-crear la tabla de usuarios y un admin por defecto al arrancar
async function inicializarBaseDeDatos() {
    try {
        // 1. Crear la tabla usuarios si no existe
        await pool.query(`
            CREATE TABLE IF NOT EXISTS usuarios (
              id INT AUTO_INCREMENT PRIMARY KEY,
              cedula VARCHAR(20) NOT NULL UNIQUE,
              password VARCHAR(255) NOT NULL,
              rol INT NOT NULL DEFAULT 1
            )
        `);
        console.log("Tabla 'usuarios' verificada o creada exitosamente.");

        // 2. Verificar si ya existe un admin (por ejemplo, con cédula '1073890123')
        const [rows] = await pool.query('SELECT * FROM usuarios WHERE cedula = ?', ['1073890123']);
        if (rows.length === 0) {
            // Si no existe, lo creamos con contraseña hasheada (ej: '12ad34m')
            const bcrypt = require('bcrypt');
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

// Ejecutar esta función justo después de que conectes tu servidor
inicializarBaseDeDatos();

// --- RUTAS DE OBRAS ---
app.use('/obras', obrasRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor funcionando en http://localhost:${PORT}`);
});