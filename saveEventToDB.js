const { getConnection } = require('./db');

async function saveEventToDB(event) {
  try {
    const pool = await getConnection();
    const query = `
      INSERT INTO PIDEvents (pid, name, price, percentage_change, direction, time_str, change, volume, timestamp_utc)
      VALUES (@pid, @name, @price, @pcp, @direction, @time, @pc, @turnover_numeric, GETDATE())
    `;

    await pool.request()
      .input('pid', event.pid)
      .input('name', event.name)
      .input('price', event.last)
      .input('pcp', event.pcp)
      .input('direction', event.last_dir)
      .input('time', event.time)
      .input('pc', event.pc)
      .input('turnover_numeric', event.turnover_numeric)
      .query(query);
  } catch (err) {
    console.error('[!] Errore salvataggio evento DB:', err.message);
  }
}

module.exports = { saveEventToDB };
