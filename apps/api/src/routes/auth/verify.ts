import express from "express";
import { Auth } from "src/lib/Auth";
import { prisma } from "src/lib/prisma";
import { VerificationCode } from "src/lib/VerificationCode";

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

      let user = await prisma.user.findUnique({ where: { email } });

      if (!user) {
        user = await prisma.user.create({ data: { email } });
      }

      const token = Auth.generate(user.id);

      res.status(200).json({ token });
    } catch (err) {
      console.error("Error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
