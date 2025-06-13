"use client";

import { useAccountStore } from "@/features/accounts/hooks/useAccountStore";
import type { BitcoinWallet } from "@/features/wallet/types";
import { HDKey } from "@scure/bip32";
import { generateMnemonic, mnemonicToSeed } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
import { Keypair } from "@solana/web3.js";
import * as bitcoin from "bitcoinjs-lib";
import { derivePath } from "ed25519-hd-key";
import sodium from "libsodium-wrappers";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { hdKeyToAccount } from "viem/accounts";
import { useCreateAccountStore } from "./useCreateAccountStore";

export const AccountCreationManager = () => {
  const router = useRouter();

  useEffect(() => {
    const { emailConfirmed, pinConfirmed, pin, name } =
      useCreateAccountStore.getState();

    if (!emailConfirmed) {
      router.push("/welcome/create-account/email-input");
      return;
    }

    if (!pin || !pinConfirmed) {
      router.push("/welcome/create-account/pin-input");
      return;
    }

    if (!name) {
      router.push("/welcome/create-account/name");
      return;
    }

    getAccount(pin, generateMnemonic(wordlist)).then((account) => {
      useCreateAccountStore.getState().reset();
      useAccountStore.getState().addAccount({
        ...account,
        name,
      });
    });

    router.push("/main");
  }, [router]);
};

const getAccount = (pin: string, mnemonic: string) =>
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
  const buffer = Buffer.from(seed);
  const key = derivePath("m/44'/501'/0'/0'", buffer.toString("hex")).key;
  const keyPair = Keypair.fromSeed(key);
  return keyPair.publicKey.toString();
};

const getBtcAddress = (root: HDKey) => {
  const child = root.derive("m/84'/0'/0'/0/0");
  return bitcoin.payments.p2wpkh({
    pubkey: Buffer.from(child.publicKey!),
    network: bitcoin.networks.bitcoin, // use bitcoin.networks.testnet for testnet
  }).address as BitcoinWallet["address"];
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
