import "server-only";

/** Server-only secrets. Never import this module from a Client Component. */
export const serverEnv = {
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || "",
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || "",
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || "",
  resendApiKey: process.env.RESEND_API_KEY || "",
  emailFrom: process.env.EMAIL_FROM || "",
  staffAlertEmail: process.env.STAFF_ALERT_EMAIL || "",
  whatsappAccessToken: process.env.WHATSAPP_ACCESS_TOKEN || "",
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
  whatsappTemplateBookingConfirmed: process.env.WHATSAPP_TEMPLATE_BOOKING_CONFIRMED || "",
  whatsappTemplateLanguage: process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en",
  whatsappApiVersion: process.env.WHATSAPP_API_VERSION || "v23.0",
  cronSecret: process.env.CRON_SECRET || "",
  ipHashSalt: process.env.IP_HASH_SALT || "",
};

export const integrations = {
  supabaseAdmin: () => Boolean(serverEnv.supabaseSecretKey),
  razorpay: () => Boolean(serverEnv.razorpayKeyId && serverEnv.razorpayKeySecret),
  razorpayWebhook: () => Boolean(serverEnv.razorpayWebhookSecret),
  email: () => Boolean(serverEnv.resendApiKey && serverEnv.emailFrom),
  whatsapp: () =>
    Boolean(serverEnv.whatsappAccessToken && serverEnv.whatsappPhoneNumberId && serverEnv.whatsappTemplateBookingConfirmed),
};
