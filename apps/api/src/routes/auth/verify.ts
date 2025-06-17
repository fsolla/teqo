import express from "express";
import { Auth } from "../../lib/Auth";
import { prisma } from "../../lib/prisma";
import { VerificationCode } from "../../lib/VerificationCode";

export const verifyRouter = express
  .Router()
  .post("/verify", async (req, res) => {
    const { email, code } = req.body;

    if (!email?.trim().match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      res.status(400).json({ error: "Invalid email" });
      return;
    }

    if (!VerificationCode.isValid(code)) {
      res.status(400).json({ error: "Invalid verification code" });
      return;
    }

    try {
      const verified = await VerificationCode.verify(email, code);

      if (!verified) {
        res.status(400).json({ error: "Invalid or expired verification code" });
        return;
      }

      const user = await prisma.user.upsert({
        where: { email },
        update: {},
        create: { email },
      });

      Auth.refreshCookie(res, user.id);

      res.status(200);
    } catch (err) {
      console.error("Error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
