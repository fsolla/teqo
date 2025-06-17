import cors from "cors";
import express from "express";
import { rateLimiterHighest } from "./lib/rateLimiter";
import { coinRouter } from "./routes/coin";

const app = express();
const PORT = process.env.PORT || 4000;

const allowedOrigins = [
  "https://mycelia.solla.dev",
  "https://teqo.app",
  "https://www.teqo.app",
  "https://my.teqo.app",
  "https://api.teqo.app",
];

if (process.env.NODE_ENV === "development") {
  allowedOrigins.unshift("http://localhost:3000");
}

app.use(rateLimiterHighest);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or same-origin requests)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
  })
);

app.use(express.json());

app.use("/coin", coinRouter);

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
