import { createClient } from "@supabase/supabase-js";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const email = process.argv[2];
const redirectTo = process.argv[3];
let r = await admin.auth.admin.generateLink({ type: "magiclink", email, options: { redirectTo } });
if (r.error) {
  await admin.auth.admin.createUser({ email, email_confirm: true });
  r = await admin.auth.admin.generateLink({ type: "magiclink", email, options: { redirectTo } });
  if (r.error) throw r.error;
}
console.log(r.data.properties.action_link);
