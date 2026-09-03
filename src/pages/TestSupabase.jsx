import { useEffect, useState } from "react";
import { customerService } from "../services/customerService";

export default function TestSupabase() {
  const [status, setStatus] = useState("Checking...");

  useEffect(() => {
    customerService
      .getAll()
      .then(() => setStatus("✅ Supabase Connected"))
      .catch((e) => setStatus(e.message));
  }, []);

  return (
    <main className="content">
      <h1>Supabase Test</h1>

      <div className="customer-card">
        <h2>{status}</h2>
      </div>
    </main>
  );
}