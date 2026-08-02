import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes with Argon2id and verifies the right password', async () => {
    const hash = await service.hash('a-long-test-password');
    expect(hash).toContain('$argon2id$');
    await expect(service.verify(hash, 'a-long-test-password')).resolves.toBe(true);
    await expect(service.verify(hash, 'wrong-password')).resolves.toBe(false);
  });

  it('treats malformed hashes as failed verification', async () => {
    await expect(service.verify('not-an-argon-hash', 'password')).resolves.toBe(false);
  });

  it('enforces the minimum password length for administrative creation', () => {
    expect(() => service.assertAcceptableNewPassword('too-short')).toThrow(
      'between 12 and 1024',
    );
    expect(() => service.assertAcceptableNewPassword('long-enough-password')).not.toThrow();
  });
});
