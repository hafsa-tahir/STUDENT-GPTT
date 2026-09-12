export function isEmailConfirmationError(message: string) {
  return message.toLowerCase().includes("email not confirmed");
}
