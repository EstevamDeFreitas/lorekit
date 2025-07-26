const jwt = require('jsonwebtoken');
const { runWithContext } = require('../requestContext');

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) return res.status(401).json({ error: 'Token não fornecido' });

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    runWithContext(userId, () => {
      next();
    });
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido' + error.message });
  }
}

module.exports = authMiddleware;