import express from "express";
import { prisma } from "../../lib/prisma";
import { rateLimiterLowest } from "../../lib/rateLimiter";
import { VerificationCode } from "../../lib/VerificationCode";

export const requestRouter = express
  .Router()
  .post("/request", rateLimiterLowest, async (req, res) => {
    const email = req.body.email?.trim().toLowerCase();

    if (!email?.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      res.status(400).json({ error: "Invalid email" });
      return;
    }

    try {
      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        const waitlistEntry = await prisma.waitlist.findUnique({
          where: { email },
        });

        if (!waitlistEntry?.approved) {
          res
            .status(403)
            .json({ error: "Not eligible to create an account yet" });
          return;
        }
      }

      await VerificationCode.create(email);
      res.status(200).json({ success: true });
    } catch (err) {
      console.error("Error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
