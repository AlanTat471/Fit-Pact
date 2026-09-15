/** Map Supabase Auth email/OTP errors to user-friendly copy. */
export function formatAuthEmailError(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes("rate limit") ||
    lower.includes("over_email_send_rate_limit") ||
    lower.includes("too many requests")
  ) {
    return (
      "Too many verification emails were sent (this often happens after lots of sign-in testing). " +
      "Wait about 60 minutes, then tap Send code once. " +
      "If you already have a code in your inbox from the last hour, enter that code instead of requesting a new one."
    );
  }
  return message;
}

export function isAuthEmailRateLimitError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("rate limit") ||
    lower.includes("over_email_send_rate_limit") ||
    lower.includes("too many requests")
  );
}
