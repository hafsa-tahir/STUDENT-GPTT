import "dotenv/config";
import { createExpressApp } from "./server/app";

const app = createExpressApp();

export default app;
