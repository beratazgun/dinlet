/** E-posta kuyruğundaki job adları. */
export const EmailJobName = {
  SEND: "send-email",
} as const;

export type EmailJobName = (typeof EmailJobName)[keyof typeof EmailJobName];
