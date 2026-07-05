import { Router, type IRouter } from "express";
import healthRouter from "./health";
import architecturesRouter from "./architectures";
import validationsRouter from "./validations";

const router: IRouter = Router();

router.use(healthRouter);
router.use(architecturesRouter);
router.use(validationsRouter);

export default router;
