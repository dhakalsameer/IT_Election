import { getContractV3 } from "../../contract";
import { useMemo, useState } from "react";

function toDateTimeLocal(date) {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function toUnixSeconds(value) {
  return Math.floor(new Date(value).getTime() / 1000);
}

export default function ElectionControl() {
  const defaults = useMemo(() => {
    const now = new Date();
    const registrationEnd = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const votingStart = new Date(registrationEnd.getTime() + 5 * 60 * 1000);
    const votingEnd = new Date(votingStart.getTime() + 60 * 60 * 1000);

    return {
      registrationStart: toDateTimeLocal(now),
      registrationEnd: toDateTimeLocal(registrationEnd),
      votingStart: toDateTimeLocal(votingStart),
      votingEnd: toDateTimeLocal(votingEnd),
    };
  }, []);

  const [registrationStart, setRegistrationStart] = useState(defaults.registrationStart);
  const [registrationEnd, setRegistrationEnd] = useState(defaults.registrationEnd);
  const [votingStart, setVotingStart] = useState(defaults.votingStart);
  const [votingEnd, setVotingEnd] = useState(defaults.votingEnd);
  const [loading, setLoading] = useState(false);

  async function startRegistration() {
    setLoading(true);
    try {
      const contract = await getContractV3();
      const tx = await contract.startRegistration(
        toUnixSeconds(registrationEnd)
      );
      await tx.wait();
      alert("Registration window started");
    } catch (err) {
      console.error(err);
      alert(err.reason || err.shortMessage || "Error starting registration");
    } finally {
      setLoading(false);
    }
  }

  async function startElection() {
    setLoading(true);
    try {
      const contract = await getContractV3();
      const tx = await contract.startVoting(
        toUnixSeconds(votingEnd)
      );
      await tx.wait();
      alert("Voting window scheduled");
    } catch (err) {
      console.error(err);
      alert(err.reason || err.shortMessage || "Error starting election");
    } finally {
      setLoading(false);
    }
  }

  async function finalizeElection() {
    setLoading(true);
    try {
      const contract = await getContractV3();
      const tx = await contract.endElection();
      await tx.wait();
      alert("Election finalized");
    } catch (err) {
      console.error(err);
      alert(err.reason || err.shortMessage || "Error finalizing election");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">Election Control</h3>

      <div className="grid gap-3">
        <label className="grid gap-1 text-sm font-medium text-gray-700">
          Registration Start
          <input
            type="datetime-local"
            value={registrationStart}
            onChange={(event) => setRegistrationStart(event.target.value)}
            className="rounded border p-2 font-normal text-gray-900"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium text-gray-700">
          Registration End
          <input
            type="datetime-local"
            value={registrationEnd}
            onChange={(event) => setRegistrationEnd(event.target.value)}
            className="rounded border p-2 font-normal text-gray-900"
          />
        </label>
        <button
          onClick={startRegistration}
          disabled={loading}
          className="rounded bg-blue-600 py-2 font-medium text-white hover:bg-blue-700 disabled:bg-gray-400"
        >
          Start Registration
        </button>
      </div>

      <div className="grid gap-3 border-t pt-4">
        <label className="grid gap-1 text-sm font-medium text-gray-700">
          Voting Start
          <input
            type="datetime-local"
            value={votingStart}
            onChange={(event) => setVotingStart(event.target.value)}
            className="rounded border p-2 font-normal text-gray-900"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium text-gray-700">
          Voting End
          <input
            type="datetime-local"
            value={votingEnd}
            onChange={(event) => setVotingEnd(event.target.value)}
            className="rounded border p-2 font-normal text-gray-900"
          />
        </label>
        <button
          onClick={startElection}
          disabled={loading}
          className="rounded bg-green-600 py-2 font-medium text-white hover:bg-green-700 disabled:bg-gray-400"
        >
          Start Voting
        </button>
      </div>

      <button
        onClick={finalizeElection}
        disabled={loading}
        className="w-full rounded bg-red-600 py-2 font-medium text-white hover:bg-red-700 disabled:bg-gray-400"
      >
        Finalize Election
      </button>
    </div>
  );
}
