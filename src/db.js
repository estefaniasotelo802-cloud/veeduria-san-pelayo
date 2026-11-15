import mysql from 'mysql2/promise';
import 'dotenv/config';

const db = mysql.createConnection({
  host: 'tramway.proxy.rlwy.net',
  user: 'root',
  password: 'tu_password',
  database: 'railway',
  port: 33818,
  charset: 'utf8mb4' 
});

console.log('Pool de MySQL configurado');