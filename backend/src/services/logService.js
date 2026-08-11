const logRepository = require('../repositories/logRepository');

class ServiceError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}


const LIVELLI_VALIDI = ['info', 'warn', 'error'];
const ORIGINI_VALIDE = ['admin', 'sistema'];

async function cercaLog({ evento, livello, origine, da, a, limite } = {}) {
  if (livello && !LIVELLI_VALIDI.includes(livello)) {
    throw new ServiceError(`livello deve essere uno tra: ${LIVELLI_VALIDI.join(', ')}`, 400);
  }
  if (origine && !ORIGINI_VALIDE.includes(origine)) {
    throw new ServiceError(`origine deve essere una tra: ${ORIGINI_VALIDE.join(', ')}`, 400);
  }

  const daDate = da ? new Date(da) : undefined;
  const aDate = a ? new Date(a) : undefined;
  if ((da && Number.isNaN(daDate.getTime())) || (a && Number.isNaN(aDate.getTime()))) {
    throw new ServiceError('da/a devono essere date valide (es. 2026-07-01)', 400);
  }

  return logRepository.trova({
    evento,
    livello,
    origine,
    da: daDate,
    a: aDate,
    limite: limite ? Number(limite) : undefined,
  });
}


async function creaLog({ origine, livello, evento, messaggio, metadati } = {}) {
  if (!evento) {
    throw new ServiceError('evento è obbligatorio', 400);
  }
  if (!messaggio) {
    throw new ServiceError('messaggio è obbligatorio', 400);
  }
  if (livello && !LIVELLI_VALIDI.includes(livello)) {
    throw new ServiceError(`livello deve essere uno tra: ${LIVELLI_VALIDI.join(', ')}`, 400);
  }
  if (!ORIGINI_VALIDE.includes(origine)) {
    throw new ServiceError(`origine deve essere una tra: ${ORIGINI_VALIDE.join(', ')}`, 400);
  }

  return logRepository.crea({ origine, livello, evento, messaggio, metadati });
}


module.exports = { ServiceError, cercaLog, creaLog };