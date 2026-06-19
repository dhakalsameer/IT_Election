import { ethers } from "ethers";
import ABI3 from "./abi/Election3.json";
import ABI1 from "./abi/Election1.json";
import { CONTRACT_ADDRESS, CONTRACT_ADDRESS_V3 } from "./config";


let cachedProvider;

function getProvider() {
    if (!window.ethereum) return null;
    if (!cachedProvider) {
        cachedProvider = new ethers.BrowserProvider(window.ethereum);
    }
    return cachedProvider;
}

export async function getContract(){
    const provider = getProvider();
    if (!provider) throw new Error("MetaMask or wallet provider not found");
    const signer = await provider.getSigner();
    return new ethers.Contract(CONTRACT_ADDRESS, ABI1.abi, signer);
}

export async function getContractV3(){
    const provider = getProvider();
    if (!provider) throw new Error("MetaMask or wallet provider not found");
    const signer = await provider.getSigner();
    return new ethers.Contract(CONTRACT_ADDRESS_V3 || CONTRACT_ADDRESS, ABI3.abi, signer);
}