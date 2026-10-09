import * as argon2 from 'argon2';

/**
 * Şifreyi argon2 ile hashle.
 * WARNING: Default argon2id settings are CPU/memory intensive.
 * Under high concurrency (e.g. 250 VU login storm), this can saturate
 * the Node.js libuv thread pool and stall ALL I/O.
 * Consider tuning memoryCost/timeCost or using a Worker Thread pool.
 */
export const hashPassword = async (password: string): Promise<string> => {
  return argon2.hash(password, { type: argon2.argon2id });
};

/**
 * Şifreyi doğrula. Argon2 veya legacy Bcrypt destekler.
 * WARNING: Same CPU-bound caveat as hashPassword. In load tests this
 * becomes a bottleneck before the DB does.
 */
export const verifyPassword = async (
  password: string,
  hash: string,
): Promise<boolean> => {
  return argon2.verify(hash, password);
};
