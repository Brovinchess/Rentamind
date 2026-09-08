import { createClient } from "@supabase/supabase-js";
import { createMindsClient } from "@animocabrands/minds-client-lib";
import crypto from "crypto";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
function decrypt(stored){ const [v,iv,tag,data]=stored.split("."); const k=crypto.scryptSync(process.env.SESSION_SECRET,"ram-key-enc-v1",32); const d=crypto.createDecipheriv("aes-256-gcm",k,Buffer.from(iv,"base64url")); d.setAuthTag(Buffer.from(tag,"base64url")); return Buffer.concat([d.update(Buffer.from(data,"base64url")),d.final()]).toString("utf8"); }
const T = (l,t)=>console.log(`  ${l}: ${Date.now()-t}ms`);
// getDuePlans
let t=Date.now();
const { data: due } = await db.from("ram_training_plans").select("*").eq("is_studying",true).lte("next_study_at",new Date().toISOString());
console.log("getDuePlans:", due.length, "plans", Date.now()-t+"ms");
const keys={};
for (const plan of due) {
  console.log(`\n[${plan.persona_name}] owner ${plan.owner_email}`);
  if(!keys[plan.owner_email]){ const {data:u}=await db.from("ram_users").select("builder_key").eq("email",plan.owner_email).single(); keys[plan.owner_email]=u?decrypt(u.builder_key):null; }
  const key=keys[plan.owner_email]; if(!key){console.log("  NO KEY");continue;}
  const c=createMindsClient({builderApiKey:key});
  const alias=`ram-${plan.mind_id.slice(0,8)}`;
  try{ t=Date.now(); const b=await c.getCognitionBalance(plan.mind_id); T("balance "+Math.round(b.cognition),t);
    t=Date.now(); await c.ensureConversation(alias,plan.mind_id); T("ensureConversation",t);
    t=Date.now(); const fp=await c.getLatestHistoryFingerprint(alias); T("getLatestFingerprint",t);
  }catch(e){ console.log("  ERR:",e.message); }
}
console.log("\nDONE");
