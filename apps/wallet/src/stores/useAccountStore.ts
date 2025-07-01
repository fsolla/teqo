import { HDKey } from "@scure/bip32";
import { generateMnemonic, mnemonicToSeed } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
import * as btc from "@scure/btc-signer";
import { Keypair } from "@solana/web3.js";
import { Buffer } from "buffer";
import sodium from "libsodium-wrappers-sumo";
import slip10 from "micro-key-producer/slip10.js";
import { hdKeyToAccount, type Address } from "viem/accounts";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createSelectors } from "./createSelectors";

interface Account {
  name: string;
  ethereum: Address[];
  solana: string[];
  bitcoin: string[];
  encryptedMnemonic: string;
  argonSalt: string;
  aesGcmIV: string;
}

interface AccountStore {
  accounts: Account[];
  createAccount: (name: string, pin: string) => Promise<void>;
}

export const useAccountStore = createSelectors(
  create<AccountStore>()(
    persist(
      (set) => ({
        accounts: [] as Account[],
        createAccount: async (name: string, pin: string) => {
          const data = await getAccountData(
            pin,
            generateMnemonic(wordlist, 256)
          );

          set((state) => ({
            accounts: [...state.accounts, { name, ...data }],
          }));
        },
      }),
      { name: "account-store" }
    )
  )
);

const getAccountData = (pin: string, mnemonic: string) =>
  Promise.all([
    getAddresses(mnemonic),
    encryptMnemonicWithPIN(mnemonic, pin),
  ]).then(([addresses, encryptedData]) => ({
    ...addresses,
    ...encryptedData,
  }));

export const getAddresses = async (mnemonic: string) => {
  const seed = await mnemonicToSeed(mnemonic);

  const root = HDKey.fromMasterSeed(seed);

  return {
    ethereum: [getEthAddress(root)],
    solana: [getSolAddress(seed)],
    bitcoin: [getBtcAddress(root)],
  };
};

const getEthAddress = (root: HDKey) => hdKeyToAccount(root).address;

const getSolAddress = (seed: Uint8Array) => {
  const hdkey = slip10.fromMasterSeed(seed);
  const key = hdkey.derive("m/44'/501'/0'/0'").privateKey;
  const keyPair = Keypair.fromSeed(key);
  return keyPair.publicKey.toString();
};

const getBtcAddress = (root: HDKey) => {
  const child = root.derive("m/84'/0'/0'/0/0");
  return btc.getAddress("wpkh", child.privateKey!) as string;
};

const encryptMnemonicWithPIN = async (mnemonic: string, pin: string) => {
  await sodium.ready;

  // Step 1 — Generate Argon2 salt (16 bytes)
  const argonSalt = sodium.randombytes_buf(16);

  // Step 2 — Derive key from PIN
  const derivedKey = sodium.crypto_pwhash(
    32, // Output length (256 bits for AES key)
    pin,
    argonSalt,
    sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE, // Good tradeoff for UX
    sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_ALG_ARGON2ID13
  );

  // Step 3 — Generate AES-GCM IV (12 bytes)
  const aesGcmIV = sodium.randombytes_buf(12);

  // Step 4 — Encrypt mnemonic with AES-GCM
  const aesKey = await window.crypto.subtle.importKey(
    "raw",
    derivedKey,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: aesGcmIV,
    },
    aesKey,
    new TextEncoder().encode(mnemonic)
  );

  return {
    encryptedMnemonic: Buffer.from(encryptedBuffer).toString("base64"),
    argonSalt: Buffer.from(argonSalt).toString("base64"),
    aesGcmIV: Buffer.from(aesGcmIV).toString("base64"),
  };
};

export async function decryptMnemonicWithPIN(
  encryptedMnemonicBase64: string,
  argonSaltBase64: string,
  aesGcmIVBase64: string,
  pin: string
) {
  await sodium.ready;

  // Decode stored values
  const argonSalt = Buffer.from(argonSaltBase64, "base64");
  const aesGcmIV = Buffer.from(aesGcmIVBase64, "base64");
  const encryptedMnemonic = Buffer.from(encryptedMnemonicBase64, "base64");

  // Derive key again from PIN + argonSalt
  const derivedKey = sodium.crypto_pwhash(
    32,
    pin,
    argonSalt,
    sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_ALG_ARGON2ID13
  );

  // Import key into WebCrypto
  const aesKey = await window.crypto.subtle.importKey(
    "raw",
    derivedKey,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  // Decrypt
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: aesGcmIV,
    },
    aesKey,
    encryptedMnemonic
  );

  return new TextDecoder().decode(decryptedBuffer);
}
