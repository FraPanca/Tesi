// Retry con backoff esponenziale per operazioni critiche legate ai topic MQTT (optimized, commands). 
async function retryConBackoff(fn, { tentativiMax = 5, baseMs = 500 } = {}) {
  let ultimoErrore;

  for (let tentativo = 1; tentativo <= tentativiMax; tentativo++) {
    try {
      return await fn();
    } catch (err) {
      ultimoErrore = err;
      if (tentativo === tentativiMax) break;

      const attesa = baseMs * 2 ** (tentativo - 1);
      console.warn(`[Retry] tentativo ${tentativo}/${tentativiMax} fallito, riprovo tra ${attesa}ms:`, err.message);
      await new Promise((resolve) => setTimeout(resolve, attesa));
    }
  }

  throw ultimoErrore;
}


module.exports = { retryConBackoff };