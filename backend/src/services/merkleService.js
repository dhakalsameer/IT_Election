import { MerkleTree } from "merkletreejs";
import keccak256 from "keccak256";
import { ethers } from "ethers";

/**
 * Generates a Merkle Root from an array of wallet addresses.
 * @param {string[]} wallets 
 * @returns {string} The Merkle Root (hex)
 */
export function generateMerkleRoot(wallets) {
  if (!wallets || wallets.length === 0) return ethers.ZeroHash;
  
  const leaves = wallets.map(addr => 
    keccak256(ethers.solidityPacked(["address"], [ethers.getAddress(addr)]))
  );
  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
  return tree.getHexRoot();
}

/**
 * Generates a Merkle Proof for a specific wallet address.
 * @param {string[]} allWallets 
 * @param {string} targetWallet 
 * @returns {string[]} The Merkle Proof (array of hex strings)
 */
export function generateMerkleProof(allWallets, targetWallet) {
  const leaves = allWallets.map(addr => 
    keccak256(ethers.solidityPacked(["address"], [ethers.getAddress(addr)]))
  );
  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
  const leaf = keccak256(ethers.solidityPacked(["address"], [ethers.getAddress(targetWallet)]));
  return tree.getHexProof(leaf);
}
