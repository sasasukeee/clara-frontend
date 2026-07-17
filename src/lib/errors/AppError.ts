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
      message: error.message || "Bir hata oluştu. Lütfen tekrar deneyin.",
      cause: error,
    });
  }
  return new AppError({
    code: "UNKNOWN",
    message: "Bir hata oluştu. Lütfen tekrar deneyin.",
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
      return `İstek zaman aşımına uğradı. Lütfen tekrar deneyin.${suffix}`;
    case "NETWORK":
      return `Ağ hatası oluştu. Lütfen tekrar deneyin.${suffix}`;
    case "UNAUTHORIZED":
      return `Oturum süreniz doldu. Lütfen tekrar giriş yapın.${suffix}`;
    case "FORBIDDEN":
      return `Bu işlem için yetkiniz yok.${suffix}`;
    case "NOT_FOUND":
      return `İstenen kaynak bulunamadı.${suffix}`;
    case "RATE_LIMITED":
      return `Çok fazla istek atıldı. Lütfen biraz sonra tekrar deneyin.${suffix}`;
    case "VALIDATION":
      return `Girilen bilgiler geçersiz. Lütfen kontrol edin.${suffix}`;
    case "INVALID_RESPONSE":
      return `Sunucudan beklenmeyen yanıt alındı. Lütfen tekrar deneyin.${suffix}`;
    case "UPSTREAM":
      if (error.status === 502 || error.status === 503) {
        return `Sunucuya ulaşılamadı. Lütfen tekrar deneyin.${suffix}`;
      }
      return `Sunucu hatası oluştu. Lütfen tekrar deneyin.${suffix}`;
    default:
      return `Bir hata oluştu. Lütfen tekrar deneyin.${suffix}`;
  }
};
