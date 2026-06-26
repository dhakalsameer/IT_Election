#!/usr/bin/env bash
set -euo pipefail

# Deploy Election3.sol with multi-vote castVote() to Sepolia
# Usage: bash scripts/deploy_v4.sh

RPC_URL="${RPC_URL:-https://eth-sepolia.g.alchemy.com/v2/95pRrhpYhS2hhiYfaqfDw}"
PRIVATE_KEY="${PRIVATE_KEY:-0x4c54307a0f284fb4493ecf28b1f3fc3e05623c4293672c7081077e8187749d63}"

echo "Deploying Election3 (castVote) to Sepolia..."
forge create src/Election3.sol:Election3 \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --constructor-args "0x0000000000000000000000000000000000000000000000000000000000000000" \
  --legacy

echo "Done."
