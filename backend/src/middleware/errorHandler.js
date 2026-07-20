function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  if (status === 500) {
    console.error('[Errore non gestito]', err);
  }
  res.status(status).json({ errore: err.message || 'Errore interno' });
}


module.exports = errorHandler;