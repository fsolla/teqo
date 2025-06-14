import express from "express";
import { Auth } from "../../lib/Auth";
import { rateLimiterLowest } from "../../lib/rateLimiter";

export const validateRouter = express
  .Router()
  .get("/validate", rateLimiterLowest, async (req, res) => {
    try {
      const valid = await Auth.validate(req, res);
      res.status(200).json({ valid });
    } catch (err) {
      console.error("Invalid token or error in validate:", err);
      res.status(200).json({ valid: false });
    }
  });
