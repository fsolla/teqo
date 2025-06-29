// routes/auth/eligible.ts
import express from "express";
import { prisma } from "../../lib/prisma";
import { rateLimiterLowest } from "../../lib/rateLimiter";

export const eligibleRouter = express
  .Router()
  .post("/eligible", rateLimiterLowest, async (req, res) => {
    const email = req.body.email?.trim().toLowerCase();

    if (!email?.trim().match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      res.status(400).json({ error: "Invalid email" });
      return;
    }

    const entry = await prisma.waitlist.findUnique({
      where: { email: email.toLowerCase() },
    });

    res.status(200).json({ eligible: !!entry?.approved });
  });
