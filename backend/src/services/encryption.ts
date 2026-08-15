import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || ''; // Must be 32 bytes (64 hex characters)

/**
 * Encrypts clear text using AES-256-GCM.
 * Output format: iv_hex:encrypted_hex:auth_tag_hex
 */
export function encrypt(text: string): string {
  if (!text) return '';
  
  // Graceful fallback for mock mode if key is unconfigured
  if (process.env.MOCK_MODE === 'true' && ENCRYPTION_KEY.length !== 64) {
    return `mock_enc_${text}`;
  }

  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be a 32-byte hex string (64 characters)');
  }
  
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const tag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${encrypted}:${tag.toString('hex')}`;
}

/**
 * Decrypts text encrypted with AES-256-GCM.
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) return '';

  // Graceful fallback for mock mode if key is unconfigured
  if (process.env.MOCK_MODE === 'true' && !encryptedText.includes(':')) {
    return encryptedText.startsWith('mock_enc_') ? encryptedText.slice(9) : encryptedText;
  }

  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted token format');
  }
  
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = Buffer.from(parts[1], 'hex');
  const tag = Buffer.from(parts[2], 'hex');
  
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be a 32-byte hex string (64 characters)');
  }
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  
  let decrypted = decipher.update(encrypted as any, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
