import { useEffect, useState } from "react";

export default function CustomerForm({
  onSave,
  editingCustomer,
  onCancel
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    if (editingCustomer) {
      setName(editingCustomer.name || "");
      setPhone(editingCustomer.phone || "");
      setAddress(editingCustomer.address || "");
    } else {
      setName("");
      setPhone("");
      setAddress("");
    }
  }, [editingCustomer]);

  const handleSubmit = (e) => {
    e.preventDefault();

    onSave({
      name,
      phone,
      address,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="customer-card">
      <h2>{editingCustomer ? "Edit Customer" : "Add Customer"}</h2>

      <div className="customer-form">
        <input
          placeholder="Customer Name *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <input
        placeholder="Phone Number"
        type="tel"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={10}
        value={phone}
        onChange={(e) =>
          setPhone(e.target.value.replace(/\D/g, ""))
        }
      />

        <input
          placeholder="Address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="full"
        />

        <button type="submit" className="save-btn">
          {editingCustomer ? "Update Customer" : "Save Customer"}
        </button>

        {editingCustomer && (
          <button
            type="button"
            className="delete-btn"
            onClick={onCancel}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}