const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const env = require('../config/env');

const JWT_ALGORITHM =
  'HS256';

const signAccessToken = (
  user
) =>
  jwt.sign(
    {
      sub:
        user.id,

      role:
        user.role,

      type:
        'access',
    },
    env.JWT_ACCESS_SECRET,
    {
      algorithm:
        JWT_ALGORITHM,

      expiresIn:
        env.JWT_ACCESS_EXPIRES_IN,
    }
  );

const signRefreshToken = (
  user
) =>
  jwt.sign(
    {
      sub:
        user.id,

      type:
        'refresh',
    },
    env.JWT_REFRESH_SECRET,
    {
      algorithm:
        JWT_ALGORITHM,

      expiresIn:
        env.JWT_REFRESH_EXPIRES_IN,

      jwtid:
        crypto.randomUUID(),
    }
  );

const verifyAccessToken = (
  token
) =>
  jwt.verify(
    token,
    env.JWT_ACCESS_SECRET,
    {
      algorithms: [
        JWT_ALGORITHM,
      ],
    }
  );

const verifyRefreshToken = (
  token
) =>
  jwt.verify(
    token,
    env.JWT_REFRESH_SECRET,
    {
      algorithms: [
        JWT_ALGORITHM,
      ],
    }
  );

const hashToken = (
  token
) =>
  crypto
    .createHash(
      'sha256'
    )
    .update(
      token
    )
    .digest(
      'hex'
    );

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
};