import { ethers } from "ethers";
import dotenv from "dotenv";
import Election3ABI from "../abi/Election3.json" with { type: "json" };

dotenv.config();

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

export const adminSigner = new ethers.Wallet(
  process.env.PRIVATE_KEY,
  provider
);

export const electionContractV3 = new ethers.Contract(
  process.env.CONTRACT_ADDRESS_V3,
  Election3ABI.abi,
  adminSigner
);
