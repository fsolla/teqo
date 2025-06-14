import express from "express";
import { rateLimiterLowest } from "../../lib/rateLimiter";
import { VerificationCode } from "../../lib/VerificationCode";

export const requestRouter = express
  .Router()
  .post("/request", rateLimiterLowest, async (req, res) => {
    const { email } = req.body;

    if (!email?.trim().match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      res.status(400).json({ error: "Invalid email" });
      return;
    }

    try {
      await VerificationCode.create(email);
      res.status(200).json({ success: true });
    } catch (err) {
      console.error("Error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
