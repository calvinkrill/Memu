/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Gender = 'male' | 'female';

export interface User {
  username: string;
  nickname: string;
  gender: Gender;
  publicKeyJwk: JsonWebKey;
  createdAt?: string;
  isOnline?: boolean;
}

export interface WorldMessage {
  id: string;
  sender: string;
  nickname: string;
  gender: Gender;
  text: string;
  timestamp: string;
}

export interface DirectMessage {
  id: string;
  sender: string;
  senderNickname: string;
  senderGender: Gender;
  recipient: string;
  recipientNickname: string;
  recipientGender: Gender;
  ciphertext: string; // Base64
  iv: string; // Base64
  encryptedKeyForRecipient: string; // Base64
  encryptedKeyForSender: string; // Base64
  timestamp: string;
}

// In-memory or state representation of decrypted Direct Message
export interface DecryptedDirectMessage {
  id: string;
  sender: string;
  senderNickname: string;
  senderGender: Gender;
  recipient: string;
  recipientNickname: string;
  recipientGender: Gender;
  text: string; // Plaintext after decryption
  timestamp: string;
  isDecryptionFailed?: boolean;
}

export interface AuthState {
  token: string;
  user: {
    username: string;
    nickname: string;
    gender: Gender;
  };
}
