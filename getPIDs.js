const { getConnection } = require('./db');

async function getActivePIDsWithNames() {
  try {
    const pool = await getConnection();
    const result = await pool
      .request()
      .query('SELECT pid, name FROM PidRegistry WHERE isActive = 1');
    
    // Mappa pid → name
    const pidMap = {};
    result.recordset.forEach(row => {
      pidMap[row.pid.toString()] = row.name;
    });

    return pidMap;    
      // return result.recordset.map(row => row.pid.toString());
  } catch (err) {
    console.error('[!] Errore nella connessione al DB:', err.message);
    return [];
  }
}

// 👇 QUESTA è la parte importante!
module.exports = {
    getActivePIDsWithNames
  };