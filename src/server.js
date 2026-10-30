import express from 'express';
import cors from 'cors';
import { pool } from './db.js';

//IMPORTACIÓN 
import obrasRouter from './routes/obras.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;

// REGISTRO DE LA RUTA 
app.use('/obras', obrasRouter);

app.listen(PORT, () => {
  console.log(`Servidor funcionando en http://localhost:${PORT}`);
});