// Bundle with esbuild --bundle --platform=node --format=esm, then run node --test on the output.
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { POST } from "../app/api/materials/route.js";

const originalFetch=globalThis.fetch;
before(()=>{process.env.NEXT_PUBLIC_SUPABASE_URL="https://example.supabase.co";process.env.SUPABASE_SERVICE_ROLE_KEY="test-service-key";});
after(()=>{globalThis.fetch=originalFetch;delete process.env.NEXT_PUBLIC_SUPABASE_URL;delete process.env.SUPABASE_SERVICE_ROLE_KEY;});

test("materials API rejects a plan with gaps before writing it",async()=>{
  globalThis.fetch=async url=>String(url).includes("/auth/v1/user")?Response.json({id:"00000000-0000-4000-8000-000000000001"}):Response.json([]);
  const response=await POST(new Request("http://local/api/materials",{method:"POST",headers:{Authorization:"Bearer token"},body:JSON.stringify({cleanedText:"Dit is een volledige tekst.",segments:[{index:0,start:1,end:25,text:"it is een volledige tekst."}]})}));
  assert.equal(response.status,400);assert.match((await response.json()).error,/boundaries/);
});

test("materials API requires an authenticated user",async()=>{
  const response=await POST(new Request("http://local/api/materials",{method:"POST",body:"{}"}));
  assert.equal(response.status,401);
});
