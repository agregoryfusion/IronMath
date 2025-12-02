// backend_main.js - shared backend helpers (auth, user tracking, shared supabase client)
const FM = (window.FastMath = window.FastMath || {});

// Supabase config (shared)
const SUPABASE_URL = "https://jfjlznxvofhjjlommdrd.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_bSFpnR01TewY44SI8mLuLA_aX3bF3Lk";

// Reuse existing client if already created by another module
const supabase = FM.supabaseClient || window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
FM.supabaseClient = supabase;

async function recordUserLogin(email, name) {
  const nowIso = new Date().toISOString();

  const { data: existingUser, error: findErr } = await supabase
    .from("users")
    .select("*")
    .eq("name", name)
    .maybeSingle();

  if (findErr) {
    console.error("User lookup error:", findErr);
  }

  let userId = null;

  if (existingUser) {
    userId = existingUser.user_id;
    const updatedEmail = existingUser.email || email;

    const { error: updateErr } = await supabase
      .from("users")
      .update({
        email: updatedEmail,
        last_login_at: nowIso
      })
      .eq("user_id", userId);

    if (updateErr) {
      console.error("User update failed:", updateErr);
    }
  } else {
    const { data: inserted, error: insertErr } = await supabase
      .from("users")
      .insert({
        name,
        email,
        last_login_at: nowIso
      })
      .select()
      .single();

    if (insertErr) {
      console.error("User insert failed:", insertErr);
    } else {
      userId = inserted.user_id;
    }
  }

  if (userId !== null) {
    const { error: loginErr } = await supabase
      .from("logins")
      .insert({
        user_id: userId,
        name,
        login_at: nowIso
      });

    if (loginErr) {
      console.error("Login insert failed:", loginErr);
    }
  }

  return userId;
}

FM.backendMain = {
  supabase,
  recordUserLogin
};
