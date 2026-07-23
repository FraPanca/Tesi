const authService = require('../services/authService');


async function postLogin(req, res) {
  const { username, password } = req.body;
  const token = await authService.login(username, password);
  res.json({ token });
}


module.exports = { postLogin };