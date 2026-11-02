import express, { type Express, type ErrorRequestHandler } from "express";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import pinoHttp from "pino-http";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";
import { geminiProviderErrorHandler } from "./lib/skillsync-ai";
import { aiLimitErrorHandler } from "./lib/skillsync-ai-limits";

const app: Express = express();

const jsonApiErrorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const errorType =
    typeof error === "object" && error !== null && "type" in error
      ? error.type
      : undefined;
  if (errorType === "entity.parse.failed") {
    res.status(400).json({
      error: "Invalid JSON request body. / محتوى طلب JSON غير صالح.",
      code: "INVALID_JSON_BODY",
    });
    return;
  }
  if (errorType === "entity.too.large") {
    res.status(413).json({
      error: "Request body is too large. / محتوى الطلب كبير جداً.",
      code: "REQUEST_BODY_TOO_LARGE",
    });
    return;
  }

  logger.error(
    { errorType: error instanceof Error ? error.name : "UnknownError" },
    "Unhandled API request error",
  );
  res.status(500).json({
    error: "An unexpected server error occurred. Please try again. / حدث خطأ غير متوقع في الخادم. يرجى المحاولة لاحقاً.",
    code: "INTERNAL_SERVER_ERROR",
  });
};

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

app.use("/api", router);
app.use("/api", (_req, res) => {
  res.status(404).json({
    error: "API route not found. / مسار واجهة API غير موجود.",
    code: "API_ROUTE_NOT_FOUND",
  });
});
app.use("/api", aiLimitErrorHandler);
app.use("/api", geminiProviderErrorHandler);
app.use("/api", jsonApiErrorHandler);

export default app;
