import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

// ROUTE: LOGIN (Autenticación de administrador)
router.post('/login', (req, res) => {
  const { usuario, password } = req.body;

  // Credenciales de acceso administrativo (puedes cambiarlas por las que desees)
  const USUARIO_ADMIN = "admin";
  const PASSWORD_ADMIN = "12345";

  if (usuario === USUARIO_ADMIN && password === PASSWORD_ADMIN) {
      res.status(200).json({ exito: true, mensaje: "Autenticación exitosa" });
  } else {
      res.status(401).json({ exito: false, mensaje: "Usuario o contraseña incorrectos" });
  }
});

// READ (Consultar todas las obras)
router.get('/', async (req, res) => {
  try {
    const [filas] = await pool.query(
      'SELECT * FROM obras ORDER BY id'
    );
    res.json(filas);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Error al consultar las obras'
    });
  }
});

// CREATE (Registrar una nueva obra)
router.post('/', async (req, res) => {
  try {
    const { nombre, sector, presupuesto, estado, avance_porcentaje } = req.body;

    const [resultado] = await pool.execute(
      `INSERT INTO obras 
      (nombre, sector, presupuesto, estado, avance_porcentaje) 
      VALUES (?, ?, ?, ?, ?)`,
      [nombre, sector, presupuesto, estado, avance_porcentaje]
    );

    const [filas] = await pool.execute(
      'SELECT * FROM obras WHERE id = ?',
      [resultado.insertId]
    );

    res.status(201).json({
      mensaje: 'Obra creada correctamente',
      obra: filas[0]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Error al crear la obra'
    });
  }
});

// UPDATE (Actualizar una obra existente)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, sector, presupuesto, estado, avance_porcentaje } = req.body;

    const [resultado] = await pool.execute(
      `UPDATE obras 
       SET nombre = ?, 
           sector = ?, 
           presupuesto = ?, 
           estado = ?, 
           avance_porcentaje = ? 
       WHERE id = ?`,
      [nombre, sector, presupuesto, estado, avance_porcentaje, id]
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({
        error: 'Obra no encontrada'
      });
    }

    const [filas] = await pool.execute(
      'SELECT * FROM obras WHERE id = ?',
      [id]
    );

    res.json({
      mensaje: 'Obra actualizada correctamente',
      obra: filas[0]
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Error al actualizar la obra'
    });
  }
});

// DELETE (Eliminar una obra existente)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Verificar si la obra existe antes de eliminarla
    const [filas] = await pool.execute(
      'SELECT * FROM obras WHERE id = ?',
      [id]
    );

    if (filas.length === 0) {
      return res.status(404).json({
        error: 'Obra no encontrada'
      });
    }

    // 2. Ejecutar la eliminación en MySQL
    await pool.execute(
      'DELETE FROM obras WHERE id = ?',
      [id]
    );

    // 3. Responder con éxito devolviendo la obra que fue eliminada
    res.json({
      mensaje: 'Obra eliminada correctamente',
      obra: filas[0]
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: 'Error al eliminar la obra'
    });
  }
});

export default router;