import { hash } from 'bcryptjs';
import type { IPasswordHasher } from '@vire/core';

export class BcryptPasswordHasher implements IPasswordHasher {
  hash(plain: string): Promise<string> {
    return hash(plain, 12);
  }
}
