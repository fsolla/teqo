import { Router } from "express";
import { rateLimiterHigh } from "src/lib/rateLimiter";
import { metadataRouter } from "./metadata";

const router = Router();

router.use(rateLimiterHigh);

router.use(metadataRouter);

export const coinRouter = router;
