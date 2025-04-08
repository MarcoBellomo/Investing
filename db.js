const sql = require('mssql');

const config = {
    user: 'sa',
    password: 'Zorro30071972', // sostituiscilo con la tua password
    server: '192.168.1.35',
    database: 'Investing',
    trustServerCertificate: true,
    options: {
      encrypt: false
    }
  };

async function getConnection() {
  try {
    const pool = await sql.connect(config);
    return pool;
  } catch (err) {
    console.error('[!] Errore connessione DB:', err.message);
    throw err;
  }
}

module.exports = { getConnection };
