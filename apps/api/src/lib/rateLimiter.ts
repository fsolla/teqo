import { rateLimit } from "express-rate-limit";

// Very permissive, for global app level
export const rateLimiterHighest = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
});

// Permissive, for general routes
export const rateLimiterHigh = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

// Medium strictness, for sensitive endpoints
export const rateLimiterMedium = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
});

// Low, for things like request and verify login
export const rateLimiterLow = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

// Lowest, for extremely sensitive endpoints
export const rateLimiterLowest = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
});
