import { Router, type IRouter } from "express";
import healthRouter from "./health";
import architecturesRouter from "./architectures";

const router: IRouter = Router();

router.use(healthRouter);
router.use(architecturesRouter);

export default router;
