import { Router, type IRouter } from "express";
import healthRouter from "./health";
import skillSyncRouter from "./skillsync";

const router: IRouter = Router();

router.use(healthRouter);
router.use(skillSyncRouter);

export default router;
