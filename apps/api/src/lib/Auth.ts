import type { Request, Response } from "express";
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
  static async validate<Req extends Request, Res extends Response>(
    req: Req,
    res: Res
  ): Promise<boolean> {
    const token = req.cookies.teqo_session;

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

    this.refreshCookie(res, payload.userId);

    return true;
  }

  static refreshCookie<R extends Response>(res: R, userId: string): void {
    res.cookie("teqo_session", Auth.generate(userId), {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    });
  }
}
