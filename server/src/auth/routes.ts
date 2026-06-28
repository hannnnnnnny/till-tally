import { Router } from 'express';
import { prisma } from '../db/prisma';
import { hashPassword, verifyPassword } from './password';
import { signAccessToken } from './tokens';

export const authRouter = Router();

const INVALID_CREDENTIALS_ERROR = 'Invalid email or password';

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

authRouter.post('/register', async (req, res) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (!name || name.length > 120) {
    return res.status(400).json({ error: 'Name is required' });
  }

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const passwordHash = await hashPassword(password);

  try {
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    const accessToken = signAccessToken(user.id);

    return res.status(201).json({
      user,
      accessToken,
      expiresIn: 900,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return res.status(409).json({ error: 'Email is already taken' });
    }

    throw error;
  }
});

authRouter.post('/login', async (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (!email || !email.includes('@') || !password) {
    return res.status(400).json({ error: 'Valid email and password are required' });
  }

  const user = await prisma.user.findUnique({
    where: {
      email,
    },
    select: {
      id: true,
      name: true,
      email: true,
      passwordHash: true,
    },
  });

  if (!user) {
    return res.status(401).json({ error: INVALID_CREDENTIALS_ERROR });
  }

  const isValidPassword = await verifyPassword(password, user.passwordHash);

  if (!isValidPassword) {
    return res.status(401).json({ error: INVALID_CREDENTIALS_ERROR });
  }

  const accessToken = signAccessToken(user.id);

  return res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
    accessToken,
    expiresIn: 900,
  });
});
