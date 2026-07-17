export type AppErrorCode =
  | "NETWORK"
  | "TIMEOUT"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "VALIDATION"
  | "INVALID_RESPONSE"
  | "UPSTREAM"
  | "UNKNOWN";

type AppErrorParams = {
  code: AppErrorCode;
  message: string;
  status?: number;
  requestId?: string;
  details?: unknown;
  cause?: unknown;
};

export class AppError extends Error {
  code: AppErrorCode;
  status?: number;
  requestId?: string;
  details?: unknown;

  constructor({ code, message, status, requestId, details, cause }: AppErrorParams) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.requestId = requestId;
    this.details = details;
    if (cause !== undefined) {
      (this as { cause?: unknown }).cause = cause;
    }
  }
}

export const httpStatusToAppErrorCode = (status: number): AppErrorCode => {
  if (status === 408 || status === 504) return "TIMEOUT";
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 400 && status < 500) return "VALIDATION";
  if (status >= 500) return "UPSTREAM";
  return "UNKNOWN";
};

export const isAppError = (error: unknown): error is AppError =>
  error instanceof AppError;

export const toAppError = (error: unknown): AppError => {
  if (error instanceof AppError) return error;
  if (error instanceof Error) {
    return new AppError({
      code: "UNKNOWN",
      message: error.message || "An error occurred. Please try again.",
      cause: error,
    });
  }
  return new AppError({
    code: "UNKNOWN",
    message: "An error occurred. Please try again.",
    details: error,
  });
};

export const getUserMessageForAppError = (error: AppError) => {
  const suffix = error.requestId ? ` (request-id: ${error.requestId})` : "";
  const message = error.message?.trim();

  if ((error.code === "UNAUTHORIZED" || error.code === "VALIDATION") && message) {
    return `${message}${suffix}`;
  }

  switch (error.code) {
    case "TIMEOUT":
      return `Request timed out. Please try again.${suffix}`;
    case "NETWORK":
      return `A network error occurred. Please try again.${suffix}`;
    case "UNAUTHORIZED":
      return `Your session has expired. Please log in again.${suffix}`;
    case "FORBIDDEN":
      return `You do not have permission for this action.${suffix}`;
    case "NOT_FOUND":
      return `Requested resource not found.${suffix}`;
    case "RATE_LIMITED":
      return `Too many requests. Please try again later.${suffix}`;
    case "VALIDATION":
      return `Invalid information entered. Please check.${suffix}`;
    case "INVALID_RESPONSE":
      return `Unexpected response from the server. Please try again.${suffix}`;
    case "UPSTREAM":
      if (error.status === 502 || error.status === 503) {
        return `Server unreachable. Please try again.${suffix}`;
      }
      return `A server error occurred. Please try again.${suffix}`;
    default:
      return `An error occurred. Please try again.${suffix}`;
  }
};
