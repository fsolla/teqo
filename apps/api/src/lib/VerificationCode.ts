import crypto from "crypto";
import { redis } from "./redis";
import { resend } from "./resend";

export class VerificationCode {
  /**
   * Generates a new verification code, stores it in Redis for the given email
   * with a 10-minute Time To Live (TTL), and sends it via email.
   *
   * This method combines the `generate()`, `set()`, and `sendEmail()` operations.
   *
   * @param email - The email address for which to create, store, and send the verification code.
   * @returns A promise that resolves when the operations are complete.
   */
  static async create(email: string): Promise<void> {
    const code = this.generate();
    await this.set(email, code);
    await this.sendEmail(email, code);
  }

  /**
   * Verifies the provided code against the one stored in Redis for the given email.
   * If the code is correct, it's deleted from Redis to prevent reuse.
   *
   * @param email - The email address associated with the verification code.
   * @param code - The verification code to check.
   * @returns A promise that resolves to `true` if the code is valid, `false` otherwise.
   */
  static async verify(email: string, code: string): Promise<boolean> {
    const storedCode = await this.get(email);
    const result = storedCode === code && this.isValid(code); // Ensure code format is also checked

    if (result) {
      await redis.del(this.getKey(email));
    }

    return result;
  }

  /**
   * Validates if the provided code is a 6-digit string.
   *
   * @param code - The verification code to validate.
   * @returns True if the code is a 6-digit string, false otherwise.
   */
  static isValid(code: string): boolean {
    return !!code?.trim().match(/^\d{6}$/);
  }

  // --- Private Helper Methods ---

  /**
   * Generates a cryptographically secure 6-digit verification code.
   *
   * @returns A string representing the 6-digit verification code, padded with leading zeros if necessary.
   */
  private static generate() {
    const buffer = crypto.randomBytes(4);
    const randomInt = buffer.readUInt32BE() % 1000000;
    return randomInt.toString().padStart(6, "0");
  }

  /**
   * Generates the Redis key for storing a verification code.
   *
   * @param email - The email address associated with the verification code.
   * @returns The Redis key string.
   */
  private static getKey(email: string): string {
    return `verify-code:${email}`;
  }

  /**
   * Retrieves a verification code from Redis for the given email.
   *
   * @param email - The email address to retrieve the code for.
   * @returns A promise that resolves to the verification code string or null if not found.
   */
  private static async get(email: string): Promise<string | null> {
    return await redis.get(this.getKey(email));
  }

  /**
   * Stores a verification code in Redis for the given email with a 10-minute TTL.
   * @param email - The email address to associate with the code.
   * @param code - The verification code to store.
   */
  private static async set(email: string, code: string): Promise<void> {
    await redis.set(this.getKey(email), code, "EX", 10 * 60);
  }

  /**
   * Sends the verification code to the user's email.
   * @param email - The recipient's email address.
   * @param code - The verification code to send.
   */
  private static async sendEmail(email: string, code: string): Promise<void> {
    await resend.emails.send({
      from: "Teqo <no-reply@teqo.app>",
      to: email,
      subject: "Your Teqo verification code",
      html: `
          <p>Your verification code is:</p>
          <h2>${code}</h2>
          <p>This code will expire in 10 minutes.</p>
          <p>If you did not request this, please ignore this email.</p>
        `,
    });
  }
}
