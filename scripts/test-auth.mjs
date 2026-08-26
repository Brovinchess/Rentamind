// Auth test helper: creates/gets a user's OTP via admin API (no email sent).
import { createClient } from "@supabase/supabase-js";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const email = process.argv[2];
const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
if (error) {
  // user may not exist yet — create then retry
  const c = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (c.error) throw c.error;
  const l2 = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (l2.error) throw l2.error;
  console.log(l2.data.properties.email_otp);
} else {
  console.log(link.properties.email_otp);
}
