import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import architecturesRouter from "./architectures";
import versionsRouter from "./versions";
import auditRouter from "./audit";
import validationsRouter from "./validations";
import { requireAuth } from "../middlewares/require-auth";

const router: IRouter = Router();

// Public: health probe and the auth endpoints themselves.
router.use(healthRouter);
router.use(authRouter);

// Everything below requires a valid session.
router.use(requireAuth);
router.use(architecturesRouter);
router.use(versionsRouter);
router.use(auditRouter);
router.use(validationsRouter);

export default router;
