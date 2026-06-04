/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Helper functions for ArrayBuffer <-> Base64 conversion
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Generate RSA-OAEP 2048 Key Pair for End-to-End Encryption
export async function generateE2EKeys(): Promise<{
  publicKeyJwk: JsonWebKey;
  privateKeyJwk: JsonWebKey;
}> {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true, // extractable
    ['encrypt', 'decrypt']
  );

  const publicKeyJwk = await window.crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const privateKeyJwk = await window.crypto.subtle.exportKey('jwk', keyPair.privateKey);

  return { publicKeyJwk, privateKeyJwk };
}

// Encrypt message payload for both recipient and sender (so sender can view sent history)
export async function encryptMessage(
  plaintext: string,
  recipientPublicKeyJwk: JsonWebKey,
  senderPublicKeyJwk: JsonWebKey
): Promise<{
  ciphertext: string;
  iv: string;
  encryptedKeyForRecipient: string;
  encryptedKeyForSender: string;
}> {
  // 1. Generate an ephemeral AES-GCM 256 key
  const aesKey = await window.crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true, // extractable
    ['encrypt', 'decrypt']
  );

  // 2. Encrypt the plaintext using the temporary AES key
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const plaintextBuffer = encoder.encode(plaintext);

  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    aesKey,
    plaintextBuffer
  );

  // 3. Export the raw AES key material
  const rawAesKey = await window.crypto.subtle.exportKey('raw', aesKey);

  // 4. Import RSA public keys
  const recipientRsaKey = await window.crypto.subtle.importKey(
    'jwk',
    recipientPublicKeyJwk,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    false,
    ['encrypt']
  );

  const senderRsaKey = await window.crypto.subtle.importKey(
    'jwk',
    senderPublicKeyJwk,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    false,
    ['encrypt']
  );

  // 5. Encrypt raw AES key with both recipient and sender RSA public keys
  const encryptedKeyRecipientBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'RSA-OAEP',
    },
    recipientRsaKey,
    rawAesKey
  );

  const encryptedKeySenderBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'RSA-OAEP',
    },
    senderRsaKey,
    rawAesKey
  );

  return {
    ciphertext: arrayBufferToBase64(ciphertextBuffer),
    iv: arrayBufferToBase64(iv),
    encryptedKeyForRecipient: arrayBufferToBase64(encryptedKeyRecipientBuffer),
    encryptedKeyForSender: arrayBufferToBase64(encryptedKeySenderBuffer),
  };
}

// Decrypt message payload using RSA Private Key (from local storage)
export async function decryptMessage(
  ciphertextBase64: string,
  ivBase64: string,
  encryptedAesKeyBase64: string,
  privateKeyJwk: JsonWebKey
): Promise<string> {
  try {
    // 1. Import RSA private key
    const rsaPrivateKey = await window.crypto.subtle.importKey(
      'jwk',
      privateKeyJwk,
      {
        name: 'RSA-OAEP',
        hash: 'SHA-256',
      },
      false,
      ['decrypt']
    );

    // 2. Decrypt the AES key using RSA private key
    const encryptedKeyBuffer = base64ToArrayBuffer(encryptedAesKeyBase64);
    const rawAesKeyBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'RSA-OAEP',
      },
      rsaPrivateKey,
      encryptedKeyBuffer
    );

    // 3. Import decrypted raw AES key as CryptoKey
    const aesKey = await window.crypto.subtle.importKey(
      'raw',
      rawAesKeyBuffer,
      {
        name: 'AES-GCM',
        length: 256,
      },
      false,
      ['decrypt']
    );

    // 4. Decrypt original ciphertext with AES key
    const ciphertext = base64ToArrayBuffer(ciphertextBase64);
    const iv = base64ToArrayBuffer(ivBase64);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      aesKey,
      ciphertext
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Could not decrypt message. Private key may be incorrect or missing.');
  }
}

// Derive a direct AES-GCM key from username and password using PBKDF2
async function derivePasswordKey(password: string, username: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode(username.toLowerCase()),
      iterations: 100000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Encrypt the private key using password-derived GCM key (ZKP Backup)
export async function backupPrivateKey(
  privateKeyJwk: JsonWebKey,
  password: string,
  username: string
): Promise<{ ciphertext: string; iv: string }> {
  const aesKey = await derivePasswordKey(password, username);
  const enc = new TextEncoder();
  const rawData = enc.encode(JSON.stringify(privateKeyJwk));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    aesKey,
    rawData
  );

  return {
    ciphertext: arrayBufferToBase64(ciphertextBuffer),
    iv: arrayBufferToBase64(iv),
  };
}

// Decrypt the private key using password-derived GCM key
export async function recoverPrivateKey(
  backup: { ciphertext: string; iv: string },
  password: string,
  username: string
): Promise<JsonWebKey> {
  const aesKey = await derivePasswordKey(password, username);
  const ciphertext = base64ToArrayBuffer(backup.ciphertext);
  const iv = base64ToArrayBuffer(backup.iv);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    aesKey,
    ciphertext
  );

  const dec = new TextDecoder();
  return JSON.parse(dec.decode(decryptedBuffer));
}
