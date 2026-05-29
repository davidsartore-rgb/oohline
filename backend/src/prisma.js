'use strict';
const { PrismaClient } = require('@prisma/client');
const { PrismaMysql } = require('@prisma/adapter-mysql');
const mysql = require('mysql2/promise');

// Parse socket path from DATABASE_URL if present
// e.g. mysql://user:pass@localhost:3306/db?socket=/var/lib/mysql/mysql.sock
const dbUrl = new URL(process.env.DATABASE_URL);
const socketPath = dbUrl.searchParams.get('socket');
const user = decodeURIComponent(dbUrl.username);
const password = decodeURIComponent(dbUrl.password);
const database = dbUrl.pathname.slice(1);

const poolConfig = socketPath
  ? { socketPath, user, password, database }
  : { host: dbUrl.hostname, port: Number(dbUrl.port) || 3306, user, password, database };

const pool = mysql.createPool(poolConfig);
const adapter = new PrismaMysql(pool);

const prisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'warn', 'error']
    : ['warn', 'error'],
});

module.exports = prisma;
