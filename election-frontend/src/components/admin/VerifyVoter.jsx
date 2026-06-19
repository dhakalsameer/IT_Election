import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { API_URL } from "../../config";
import { AuthContext } from "../../context/AuthContextValue";

const STATUS = {
  WALLET_MISSING: "wallet_missing",
  WALLET_UNVERIFIED: "wallet_unverified",
  READY: "ready",
  VERIFIED: "verified",
};

function statusOf(student) {
  if (student.eligible_to_vote) return STATUS.VERIFIED;
  if (!student.wallet_address) return STATUS.WALLET_MISSING;
  if (!student.wallet_verified) return STATUS.WALLET_UNVERIFIED;
  return STATUS.READY;
}

const STATUS_BADGE = {
  [STATUS.WALLET_MISSING]: { label: "No wallet linked", cls: "bg-slate-100 text-slate-500" },
  [STATUS.WALLET_UNVERIFIED]: { label: "Wallet unverified", cls: "bg-amber-100 text-amber-800" },
  [STATUS.READY]: { label: "Ready to verify", cls: "bg-blue-100 text-blue-800" },
  [STATUS.VERIFIED]: { label: "Verified", cls: "bg-emerald-100 text-emerald-800" },
};

export default function VerifyVoter() {
  const { wallet } = useContext(AuthContext);
  const [students, setStudents] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [filter, setFilter] = useState(""); // simple text filter
  const [verifyingId, setVerifyingId] = useState(null); // for per-row spinner

  // Bulk import state
  const [importText, setImportText] = useState("");
  const [defaultPassword, setDefaultPassword] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState("");

  const loadStudents = useCallback(async () => {
    setFetching(true);
    try {
      const response = await fetch(`${API_URL}/api/students/all`);
      const data = await response.json();
      setStudents(Array.isArray(data) ? data : []);
      setSelectedIds((current) =>
        current.filter((id) =>
          data.some((s) => s.student_id === id && statusOf(s) === STATUS.READY)
        )
      );
    } catch (err) {
      console.error(err);
      alert("Failed to load students");
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        (s.name || "").toLowerCase().includes(q) ||
        (s.student_id || "").toLowerCase().includes(q) ||
        (s.wallet_address || "").toLowerCase().includes(q)
    );
  }, [students, filter]);

  const pendingStudents = useMemo(
    () => filtered.filter((s) => s.eligible_to_vote !== true && s.wallet_address),
    [filtered]
  );

  const verifiedStudents = useMemo(
    () => filtered.filter((s) => s.eligible_to_vote === true),
    [filtered]
  );

  const toggleStudent = (studentId) => {
    setSelectedIds((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    );
  };

  const selectAllReady = () => {
    setSelectedIds(
      pendingStudents.filter((s) => statusOf(s) === STATUS.READY).map((s) => s.student_id)
    );
  };

  // Per-student verify (calls /api/voters/verify-bulk with one id).
  async function verifyOne(studentId) {
    setVerifyingId(studentId);
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/voters/verify-bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_ids: [studentId], version: "v3", adminWallet: wallet }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Verification failed");
      alert(
        `Verified ${studentId}. Tx: ${data.txHash || "(see backend logs)"}`
      );
      await loadStudents();
    } catch (err) {
      console.error(err);
      alert(err.message || "Verification failed");
    } finally {
      setLoading(false);
      setVerifyingId(null);
    }
  }

  // Bulk verify for the current selection.
  async function verifySelected() {
    if (selectedIds.length === 0) {
      return alert("Select at least one student to verify");
    }
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/voters/verify-bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_ids: selectedIds, version: "v3", adminWallet: wallet }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Verification failed");
      alert(
        `Verified ${data.verifiedCount} student(s) and updated Merkle root. Tx: ${data.txHash || "(see backend logs)"}`
      );
      setSelectedIds([]);
      await loadStudents();
    } catch (err) {
      console.error(err);
      alert(err.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  function parseImportData(text) {
    const trimmed = text.trim();
    if (!trimmed) return [];
    // Try JSON first
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        // fall through to CSV
      }
    }
    // CSV parser
    const lines = trimmed.split(/\r?\n/).filter((l) => l.trim());
    const hasHeader = lines[0].toLowerCase().includes("student_id");
    const dataLines = hasHeader ? lines.slice(1) : lines;
    return dataLines.map((line) => {
      const cols = line.split(",").map((c) => c.trim());
      return {
        student_id: cols[0],
        name: cols[1],
        year: cols[2] || undefined,
        gender: cols[3] || undefined,
      };
    }).filter((r) => r.student_id && r.name);
  }

  async function handleImport() {
    setImportError("");
    setImportResult(null);
    const records = parseImportData(importText);
    if (records.length === 0) {
      setImportError("No valid records found. Check format.");
      return;
    }
    if (defaultPassword.length < 6) {
      setImportError("Default password must be at least 6 characters.");
      return;
    }
    setImporting(true);
    try {
      const response = await fetch(`${API_URL}/api/students/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ students: records, defaultPassword, adminWallet: wallet }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Import failed");
      setImportResult(data);
      setImportText("");
      await loadStudents();
    } catch (err) {
      setImportError(err.message || "Import failed");
    } finally {
      setImporting(false);
    }
  }

  async function revokeStudent(studentId) {
    if (!confirm(`Revoke ${studentId}? This removes them from the Merkle tree.`)) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/voters/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: studentId, adminWallet: wallet }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Revoke failed");
      alert(`Revoked ${studentId}. Tx: ${data.txHash || "(see backend logs)"}`);
      await loadStudents();
    } catch (err) {
      console.error(err);
      alert(err.message || "Revoke failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xl font-semibold">Verify Eligible Voters</h3>
        <p className="text-sm text-gray-600">
          Each verification updates the on-chain Merkle root so the student can vote.
          A student must first link their wallet via the Student Portal.
        </p>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-center">
          <p className="text-2xl font-black text-slate-800">{students.length}</p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Students</p>
        </div>
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-center">
          <p className="text-2xl font-black text-amber-700">{pendingStudents.length}</p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Pending</p>
        </div>
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-center">
          <p className="text-2xl font-black text-emerald-700">{verifiedStudents.length}</p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Verified</p>
        </div>
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-center">
          <p className="text-2xl font-black text-blue-700">{students.filter(s => !s.wallet_address).length}</p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">No Wallet</p>
        </div>
      </div>

      {/* Bulk Import Panel */}
      <div className="rounded border border-slate-200 bg-slate-50 p-4 space-y-3">
        <h4 className="font-semibold text-slate-800 text-sm">📥 Bulk Import IT Club Students</h4>
        <p className="text-xs text-slate-500">
          Paste CSV or JSON array. CSV columns: <code className="bg-white px-1 rounded border">student_id,name,year,gender</code>.
          All imported students share the default password below.
        </p>
        <textarea
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          rows={4}
          placeholder={`21001,John Doe,1st,male
21002,Jane Smith,2nd,female
21003,Ram Thapa,3rd,male`}
          className="w-full rounded border border-slate-300 px-3 py-2 text-xs font-mono focus:border-blue-500 focus:outline-none"
        />
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={defaultPassword}
            onChange={(e) => setDefaultPassword(e.target.value)}
            placeholder="Default password (min 6 chars)"
            className="flex-1 min-w-[160px] rounded border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            onClick={handleImport}
            disabled={importing || !importText.trim() || defaultPassword.length < 6}
            className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-slate-300"
          >
            {importing ? "Importing…" : "Import Students"}
          </button>
        </div>
        {importError && <p className="text-xs font-medium text-red-600">{importError}</p>}
        {importResult && (
          <div className="text-xs space-y-1">
            <p className="text-emerald-700 font-medium">✅ Imported {importResult.importedCount} student(s)</p>
            {importResult.skippedCount > 0 && <p className="text-slate-500">⏭️ Skipped {importResult.skippedCount} duplicate(s)</p>}
            {importResult.errors.length > 0 && (
              <div className="text-red-600">
                <p className="font-medium">⚠️ {importResult.errors.length} error(s):</p>
                <ul className="list-disc pl-4 max-h-24 overflow-y-auto">
                  {importResult.errors.map((e, i) => (
                    <li key={i}>{e.student_id} — {e.reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search by name, ID, or wallet…"
          className="flex-1 min-w-[180px] rounded border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          onClick={selectAllReady}
          className="rounded border border-purple-300 px-3 py-2 text-sm font-medium text-purple-700 hover:bg-purple-50"
        >
          Select All Ready
        </button>
        <button
          onClick={verifySelected}
          disabled={loading || selectedIds.length === 0}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? "Working..." : `Verify ${selectedIds.length || ""} & Update Merkle`}
        </button>
      </div>

      {fetching ? (
        <p className="text-gray-500">Loading students...</p>
      ) : (
        <div className="grid gap-4">
          {/* Pending */}
          <section className="space-y-2">
            <h4 className="font-semibold text-gray-700">
              Pending{" "}
              <span className="text-xs font-normal text-gray-400">
                ({pendingStudents.length})
              </span>
            </h4>
            {pendingStudents.length === 0 ? (
              <p className="text-gray-500">No pending students.</p>
            ) : (
              <div className="max-h-80 space-y-2 overflow-y-auto rounded border p-3">
                {pendingStudents.map((student) => {
                  const status = statusOf(student);
                  const badge = STATUS_BADGE[status];
                  const canVerify = status === STATUS.READY;
                  const busy = verifyingId === student.student_id;

                  return (
                    <div
                      key={student.student_id}
                      className={`flex items-center gap-3 rounded border p-3 ${
                        canVerify ? "border-gray-200 bg-white" : "border-gray-100 bg-gray-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(student.student_id)}
                        disabled={!canVerify || loading}
                        onChange={() => toggleStudent(student.student_id)}
                        className="h-4 w-4"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900">{student.name}</p>
                          {student.year && (
                            <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{student.year} year</span>
                          )}
                          {student.gender && (
                            <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded capitalize">{student.gender}</span>
                          )}
                        </div>
                        <p className="break-all text-sm text-gray-500">
                          {student.student_id}
                          {student.wallet_address && (
                            <> &middot; <span className="font-mono">{student.wallet_address.slice(0, 6)}…{student.wallet_address.slice(-4)}</span></>
                          )}
                        </p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badge.cls}`}>
                        {badge.label}
                      </span>
                      <button
                        onClick={() => verifyOne(student.student_id)}
                        disabled={!canVerify || loading}
                        className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:bg-gray-300 disabled:text-gray-500"
                        title={canVerify ? "Verify this student and update Merkle root" : "Student must link wallet first"}
                      >
                        {busy ? "..." : "Verify"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Verified */}
          <section className="space-y-2">
            <h4 className="font-semibold text-gray-700">
              Verified{" "}
              <span className="text-xs font-normal text-gray-400">
                ({verifiedStudents.length})
              </span>
            </h4>
            {verifiedStudents.length === 0 ? (
              <p className="text-gray-500">No verified students yet.</p>
            ) : (
              <div className="max-h-56 space-y-2 overflow-y-auto rounded border p-3">
                {verifiedStudents.map((student) => (
                  <div
                    key={student.student_id}
                    className="flex items-center gap-3 rounded border border-emerald-100 bg-emerald-50 p-3"
                  >
                    <span className="text-emerald-600 font-bold">✓</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{student.name}</p>
                        {student.year && (
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded">{student.year} year</span>
                        )}
                        {student.gender && (
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded capitalize">{student.gender}</span>
                        )}
                      </div>
                      <p className="break-all text-sm text-gray-500">
                        {student.student_id}
                        {student.wallet_address && (
                          <> &middot; <span className="font-mono">{student.wallet_address.slice(0, 6)}…{student.wallet_address.slice(-4)}</span></>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => revokeStudent(student.student_id)}
                      disabled={loading}
                      className="rounded border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:text-gray-400"
                    >
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
