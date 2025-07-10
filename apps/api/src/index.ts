import cors from "cors";
import express from "express";
import { rateLimiterHighest } from "./lib/rateLimiter";
import { authRouter } from "./routes/auth";
import { coinRouter } from "./routes/coin";
import { fernRouter } from "./routes/fern";
import { subscribeRouter } from "./routes/subscribe";

const app = express();
const PORT = process.env.PORT || 4000;

const allowedOrigins = process.env.ALLOWED_ORIGINS.split(",");

app.set("trust proxy", 1);

app.use(rateLimiterHighest);

app.use(
  cors({
    origin: (origin, callback) => {
      if (
        process.env.NODE_ENV === "development" ||
        // Allow requests with no origin (like mobile apps, curl, or same-origin requests)
        !origin ||
        allowedOrigins.includes(origin)
      ) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
  })
);

app.use(express.json());

app.use("/auth", authRouter);

app.use("/coin", coinRouter);

app.use(subscribeRouter);

app.use(fernRouter);

app.get("/ping", (_, res) => {
  res.json({ pong: true });
});

app.use((req, res) => {
  console.log("404 hit:", req.url);
  res.status(404).send("Not Found");
});

app.listen(PORT, () => {
  console.log(`🚀 API listening on http://127.0.0.1:${PORT}`);
});
