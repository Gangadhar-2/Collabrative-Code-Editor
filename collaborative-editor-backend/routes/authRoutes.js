const express = require('express');
const router = express.Router();
const { 
  register, 
  login, 
  refreshToken, 
  logout, 
  getMe,
  changePassword,
  getSessions,
  revokeSession
} = require('../auth');
const { verifyToken } = require('../auth');

router.post('/register', register);
router.post('/login', login);
router.post('/refresh-token', refreshToken);

router.post('/logout', verifyToken, logout);
router.get('/me', verifyToken, getMe);
router.post('/change-password', verifyToken, changePassword);
router.get('/sessions', verifyToken, getSessions);
router.delete('/sessions/:sessionId', verifyToken, revokeSession);

module.exports = router;