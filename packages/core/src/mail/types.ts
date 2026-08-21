/** A fully-rendered email ready for a transport. */
export interface MailMessage {
  from?: { address: string; name?: string };
  to: Array<{ address: string; name?: string }>;
  cc?: Array<{ address: string; name?: string }>;
  bcc?: Array<{ address: string; name?: string }>;
  replyTo?: { address: string; name?: string };
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{ filename: string; content: string | Buffer }>;
}

/** The contract every mail transport implements (Laravel: Mail contract). */
export interface MailDriver {
  send(message: MailMessage): Promise<void>;
}
