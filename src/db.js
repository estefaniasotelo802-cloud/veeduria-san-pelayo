import mysql from 'mysql2/promise';
import 'dotenv/config';

export const pool = mysql.createPool({
  host: 'tramway.proxy.rlwy.net',
  user: 'root',
  password: 'HjCvdubQawvkDzuVpHMQxRgPkoTaOCaS',
  database: 'railway',
  port: 33818,
  charset: 'utf8mb4'
});

console.log('Pool de MySQL configurado');