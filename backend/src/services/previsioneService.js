const previsioneRepository = require('../repositories/previsioneRepository');

class ServiceError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}


// Rifiuta qualunque data priva di timezone esplicito su ds/orizzonte.da/orizzonte.a .
const REGEX_TIMEZONE_ESPLICITO = /(Z|[+-]\d{2}:\d{2})$/i;

function haTimezoneEsplicito(valore) {
  if (valore instanceof Date) {
    return !Number.isNaN(valore.getTime());
  }
  if (typeof valore !== 'string') return false;

  const stringa = valore.trim();
  if (!REGEX_TIMEZONE_ESPLICITO.test(stringa)) return false;

  return !Number.isNaN(new Date(stringa).getTime());
}


async function salvaPrevisione(presaId, { orizzonte, valoriPrevisti, metriche, suggerimenti, anomalie } = {}) {
  if (!orizzonte || !orizzonte.da || !orizzonte.a) {
    throw new ServiceError('orizzonte.da e orizzonte.a sono obbligatori', 400);
  }
  if (!haTimezoneEsplicito(orizzonte.da)) {
    throw new ServiceError('orizzonte.da deve avere un timezone esplicito (es. "Z" o "+02:00"): formato ricevuto ambiguo', 400);
  }
  if (!haTimezoneEsplicito(orizzonte.a)) {
    throw new ServiceError('orizzonte.a deve avere un timezone esplicito (es. "Z" o "+02:00"): formato ricevuto ambiguo', 400);
  }

  if (!Array.isArray(valoriPrevisti) || valoriPrevisti.length === 0) {
    throw new ServiceError('valoriPrevisti deve essere un array non vuoto', 400);
  }
  const indicePuntoAmbiguo = valoriPrevisti.findIndex((punto) => !haTimezoneEsplicito(punto && punto.ds));
  if (indicePuntoAmbiguo !== -1) {
    throw new ServiceError(
      `valoriPrevisti[${indicePuntoAmbiguo}].ds deve avere un timezone esplicito (es. "Z" o "+02:00"): formato ricevuto ambiguo`,
      400
    );
  }

  if (Array.isArray(anomalie)) {
    const indiceAnomaliaAmbigua = anomalie.findIndex((punto) => !haTimezoneEsplicito(punto && punto.ds));
    if (indiceAnomaliaAmbigua !== -1) {
      throw new ServiceError(
        `anomalie[${indiceAnomaliaAmbigua}].ds deve avere un timezone esplicito (es. "Z" o "+02:00"): formato ricevuto ambiguo`,
        400
      );
    }
  }

  // Ogni chiamata crea un nuovo documento, mai un update-in-place.
  return previsioneRepository.crea({
    presaId,
    orizzonte,
    valoriPrevisti,
    metriche,
    suggerimenti,
    anomalie,
  });
}

async function ultimaPrevisione(presaId) {
  const previsione = await previsioneRepository.trovaUltimaPerPresa(presaId);
  if (!previsione) {
    throw new ServiceError('Nessuna previsione disponibile per questa presa', 404);
  }
  return previsione;
}


module.exports = { ServiceError, salvaPrevisione, ultimaPrevisione };