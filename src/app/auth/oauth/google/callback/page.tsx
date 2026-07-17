import { GoogleOAuthCallbackPage } from "@/features/auth/google/GoogleOAuthCallbackPage";

export default function Page() {
  return <GoogleOAuthCallbackPage callbackPath="/auth/oauth/google/callback" />;
}

