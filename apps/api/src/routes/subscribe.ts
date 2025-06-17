import express from "express";
import { rateLimiterLowest } from "src/lib/rateLimiter";
import { prisma } from "../lib/prisma";

export const subscribeRouter = express
  .Router()
  .post("/subscribe", rateLimiterLowest, async (req, res) => {
    const { email } = req.body;

    if (!email?.trim().match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      res.status(400).json({ error: "Invalid email" });
    }

    await prisma.waitlist.upsert({
      where: { email },
      update: {},
      create: { email },
    });

    res.status(200).json({ ok: true });
  });
