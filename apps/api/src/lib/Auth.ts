import jwt from "jsonwebtoken";
import { prisma } from "./prisma";

export class Auth {
  /**
   * Generates a JWT (JSON Web Token) for a given user ID.
   * The token is signed using the JWT_SECRET from environment variables
   * and is set to expire in 7 days.
   *
   * @param userId - The ID of the user for whom to generate the token.
   * @returns A string representing the generated JWT.
   */
  static generate(userId: string): string {
    return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
  }

  /**
   * Validates a given JWT.
   * It verifies the token's signature, checks if the payload contains a valid userId,
   * and confirms that the user exists in the database.
   * If valid, it generates and returns a new token for the user.
   *
   * @param token - The JWT string to validate.
   * @returns A promise that resolves to a new JWT string if the input token is valid,
   *          or `false` if the token is invalid or the user does not exist.
   */
  static async validate(token: string): Promise<false | string> {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    if (
      typeof payload !== "object" ||
      !payload.userId ||
      typeof payload.userId !== "string"
    ) {
      return false;
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      return false;
    }

    return this.generate(payload.userId);
  }
}
