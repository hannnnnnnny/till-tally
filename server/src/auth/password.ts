import bcrypt from 'bcrypt';

const PASSWORD_SALT_ROUNDS = 12;

export async function hashPassword(plainPassword: string): Promise<string> {
  if (!plainPassword) {
    throw new Error('Password is required');
  }

  return bcrypt.hash(plainPassword, PASSWORD_SALT_ROUNDS);
}

export async function verifyPassword(
  plainPassword: string,
  passwordHash: string,
): Promise<boolean> {
  if (!plainPassword || !passwordHash) {
    return false;
  }

  return bcrypt.compare(plainPassword, passwordHash);
}
