// middleware/auth.js legge JWT_SECRET al momento del require() e lancia un'eccezione se manca: va impostata PRIMA di richiedere il modulo.
process.env.JWT_SECRET = 'test-secret';

const jwt = require('jsonwebtoken');
const { verifyToken } = require('../../../src/middleware/auth');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}


describe('middleware/auth.verifyToken', () => {
  test('chiama next() e valorizza req.admin se il token è valido', () => {
    const token = jwt.sign({ sub: 'admin' }, process.env.JWT_SECRET);
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();

    verifyToken(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.admin).toMatchObject({ sub: 'admin' });
    expect(res.status).not.toHaveBeenCalled();
  });

  test('risponde 401 "Token mancante" se l\'header Authorization è assente', () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();

    verifyToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ errore: 'Token mancante' });
    expect(next).not.toHaveBeenCalled();
  });

  test('risponde 401 se l\'header non è nel formato "Bearer <token>"', () => {
    const req = { headers: { authorization: 'Basic xyz' } };
    const res = mockRes();
    const next = jest.fn();

    verifyToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ errore: 'Token mancante' });
    expect(next).not.toHaveBeenCalled();
  });

  test('risponde 401 "Token non valido o scaduto" con un token scaduto', () => {
    const tokenScaduto = jwt.sign({ sub: 'admin' }, process.env.JWT_SECRET, { expiresIn: -10 });
    const req = { headers: { authorization: `Bearer ${tokenScaduto}` } };
    const res = mockRes();
    const next = jest.fn();

    verifyToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ errore: 'Token non valido o scaduto' });
    expect(next).not.toHaveBeenCalled();
  });

  test('risponde 401 con un token firmato con un secret diverso', () => {
    const tokenAltroSecret = jwt.sign({ sub: 'admin' }, 'secret-sbagliato');
    const req = { headers: { authorization: `Bearer ${tokenAltroSecret}` } };
    const res = mockRes();
    const next = jest.fn();

    verifyToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});