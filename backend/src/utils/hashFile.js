import fs from 'fs';
import crypto from 'crypto';

export function sha256FileSync(absPath) {
  const hash = crypto.createHash('sha256');
  const buf = fs.readFileSync(absPath);
  hash.update(buf);
  return hash.digest('hex');
}

