// ==================== STORAGE (SUPABASE MODE) ====================

// Temporary compatibility file.
// Data now comes from Supabase services.

const safeRead = (key, fallback) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

// ---------- Compatibility stubs ----------
// These keep old imports from crashing during the final cleanup.

export const getCustomers = () => [];
export const saveCustomers = () => {};

export const getBills = () => [];
export const saveBills = () => {};

export const getReturns = () => [];
export const saveReturns = () => {};

export const getStock = () => [];
export const saveStock = () => {};

export const getActivity = () => [];
export const saveActivity = () => {};
export const addActivity = () => {};

export const nextBillNumber = () => Date.now();
export const nextReturnNumber = () => 1;
export const nextStockNumber = () => `ST-${Date.now()}`;

// ---------- Users (legacy compatibility) ----------
// Safe to keep until every page uses Supabase auth directly.

const CURRENT_USER = "sr_vastra_current_user";

export const getUsers = () => [];
export const saveUsers = () => {};

export const loginUser = (user) => {
  localStorage.setItem(CURRENT_USER, JSON.stringify(user));
};

export const getCurrentUser = () => safeRead(CURRENT_USER, null);

export const logoutUser = () => {
  localStorage.removeItem(CURRENT_USER);
};

// ---------- Backup ----------
// Keeps export/import working for local settings if needed.

export const exportBackup = () => {
  const backup = {
    exportedAt: new Date().toISOString(),
  };

  const blob = new Blob(
    [JSON.stringify(backup, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `SR_Vastra_Backup_${new Date().toISOString().split("T")[0]}.json`;
  a.click();

  URL.revokeObjectURL(url);
};

export const importBackup = () => {
  console.warn("Import Backup is disabled in Supabase mode.");
};