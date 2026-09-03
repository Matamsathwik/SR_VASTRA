import { useEffect, useState } from "react";
import CustomerForm from "../components/CustomerForm";
import CustomerTable from "../components/CustomerTable";
import CustomerProfile from "./CustomerProfile";
import { customerService } from "../services/customerService";
import { billService } from "../services/billService";


export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [editingCustomer, setEditingCustomer] = useState(null);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    const data = await customerService.getAll();
    setCustomers(data);
  };

  const saveCustomer = async (customer) => {
    
    // ---------- EDIT ----------
    if (editingCustomer) {
      try {
        await customerService.update(editingCustomer.id, {
          name: customer.name,
          phone: customer.phone,
          address: customer.address,
        });

        setCustomers((prev) =>
          prev.map((c) =>
            c.id === editingCustomer.id
              ? { ...c, ...customer }
              : c
          )
        );

        setEditingCustomer(null);
        alert("Customer updated.");
      } catch (e) {
        alert(e.message);
      }

      return;
    }

    // ---------- NEW ----------
    if (!customer.name.trim()) {
      alert("Customer name is required.");
      return;
    }

    const exists = customers.find(
      (c) =>
        c.name.toLowerCase() ===
        customer.name.toLowerCase()
    );

    if (exists) {
      alert("Customer name already exists.");
      return;
    }

    try {
  const created = await customerService.create(customer);

  setCustomers((prev) => [...prev, created]);

  alert("Customer added.");
} catch (e) {
  alert(e.message);
}

  };

  const deleteCustomer = async (customer) => {
  const bills = await billService.getByCustomer(customer.id);

  if (bills.length > 0) {
    alert("Cannot delete customer because bills already exist.");
    return;
  }

  if (!window.confirm(`Delete ${customer.name}?`)) return;

  try {
    await customerService.delete(customer.id);

    setCustomers((prev) =>
      prev.filter((c) => c.id !== customer.id)
    );

    alert("Customer deleted.");
  } catch (e) {
    alert(e.message);
  }
};

  const filtered = customers.filter((c) => {
    return (
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      String(c.id).includes(search) ||
      (c.phone || "").includes(search)
    );
  });

  if (selectedCustomer) {
    return (
      <CustomerProfile
        customer={selectedCustomer}
        goBack={() => setSelectedCustomer(null)}
      />
    );
  }

  return (
    <main className="content">
      <h1 className="customer-title">Customers</h1>

      <input
        className="search-box"
        placeholder="Search by Name, ID or Phone"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <CustomerForm
        onSave={saveCustomer}
        editingCustomer={editingCustomer}
        onCancel={() => setEditingCustomer(null)}
      />

      <CustomerTable
        customers={filtered}
        onSelect={setSelectedCustomer}
        onEdit={setEditingCustomer}
        onDelete={deleteCustomer}
      />
    </main>
  );
}