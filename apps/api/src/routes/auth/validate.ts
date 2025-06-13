import express from "express";
import { Auth } from "src/lib/Auth";
import { rateLimiterLowest } from "src/lib/rateLimiter";

export const validateRouter = express
  .Router()
  .get("/validate", rateLimiterLowest, async (req, res) => {
    const authHeader = req.headers["authorization"];

    if (!authHeader?.startsWith("Bearer ")) {
      res.status(200).json({ valid: false });
      return;
    }

    const token = authHeader.slice(7);

    try {
      const newToken = Auth.validate(token);

      if (!newToken) {
        res.status(200).json({ valid: false });
        return;
      }

      res.status(200).json({ valid: true, token: newToken });
    } catch (err) {
      console.error("Invalid token or error in validate:", err);
      res.status(200).json({ valid: false });
    }
  });
