import { createClient } from "@supabase/supabase-js";

// SuperCool managed database (public url + anon key).
const url = "https://prj6cfecc458b3228ba34cd.databasepad.com";
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjIwZGY0NDcxLTJkMjItNGM4Yy1iZDNjLTA1OTM2NGJmZmU4NiJ9.eyJwcm9qZWN0SWQiOiJwcmo2Y2ZlY2M0NThiMzIyOGJhMzRjZCIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzg5NzQ4OTQ5LCJleHAiOjIxMDUxMDg5NDksImlzcyI6ImZhbW91cy5kYXRhYmFzZXBhZCIsImF1ZCI6ImZhbW91cy5jbGllbnRzIn0.KiUUdbrVPFH8kTsX1zJ2PqFnka2CdZRXCSb3MQnpOaI";

export const db = createClient(url, anonKey);
export default db;
