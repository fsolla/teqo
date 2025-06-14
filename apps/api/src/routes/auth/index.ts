import { Router } from "express";
import { rateLimiterLow } from "../../lib/rateLimiter";
import { requestRouter } from "./request";
import { validateRouter } from "./validate";
import { verifyRouter } from "./verify";

const router = Router();

router.use(rateLimiterLow);

router.use(requestRouter);
router.use(validateRouter);
router.use(verifyRouter);

export const coinRouter = router;
