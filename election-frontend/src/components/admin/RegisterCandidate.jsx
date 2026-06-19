import { useState } from "react";
import { getContractV3 } from "../../contract";

export default function RegisterCandidate() {
  const [name, setName] = useState("");
  const [position, setPosition] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name.trim()) {
      return alert("Enter the candidate name");
    }

    setLoading(true);
    try {
      const contract = await getContractV3();
      const tx = await contract.addCandidate(name.trim(), position);

      await tx.wait();
      alert("Candidate registered on-chain");
      setName("");
    } catch (err) {
      console.error("Registration error:", err);
      alert(err.reason || err.shortMessage || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">Register Candidate</h3>

      <div className="flex flex-col gap-3">
        <input
          className="rounded border p-2"
          placeholder="Candidate Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <select
          className="rounded border p-2"
          value={position}
          onChange={(event) => setPosition(Number(event.target.value))}
        >
          <option value={0}>President</option>
          <option value={1}>Secretary</option>
          <option value={2}>General Member</option>
        </select>

        <button
          onClick={handleRegister}
          disabled={loading}
          className="rounded bg-red-600 py-2 font-bold text-white hover:bg-red-700 disabled:bg-gray-400"
        >
          {loading ? "Registering..." : "Register Candidate"}
        </button>
      </div>
    </div>
  );
}
