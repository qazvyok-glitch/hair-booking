import { createClient } from "@supabase/supabase-js";
const supabaseUrl = "https://hevlwcaoksfbtcovpmml.supabase.co";
const supabaseKey = "sb_publishable_Yc4jcqjQvMgqwkcoCdLU9w_5cVA-cVo";
export const supabase = createClient(supabaseUrl, supabaseKey);
