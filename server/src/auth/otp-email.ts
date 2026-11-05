/**
 * Passwordless NovaBot sign-in transport. The API key and OTP never enter logs
 * or a browser response. Email delivery is fail-closed; no fake "sent" state.
 * Resend requires a sender domain configured and verified by the operator.
 */
export async function sendNovabotOtp(
  config: { apiKey: string; from: string },
  input: { email: string; otp: string; type: string },
  fetcher: typeof fetch = fetch,
): Promise<void> {
  if (input.type !== "sign-in") {
    throw new Error("Only sign-in email verification is enabled.");
  }
  if (!/^\d{6,8}$/.test(input.otp)) {
    throw new Error("OTP length or format is invalid.");
  }
  const response = await fetcher("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: config.from,
      to: [input.email],
      subject: "Seu código de acesso ao NovaBot",
      text: `Seu código de acesso ao NovaBot é ${input.otp}.\n\nEle expira em 5 minutos. Não compartilhe o código com ninguém.\nSe você não solicitou este acesso, ignore este e-mail.`,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    // Status is safe for operators, unlike response body (which might contain details).
    throw new Error(
      `Email service refused the delivery (HTTP ${response.status}).`,
    );
  }
}
