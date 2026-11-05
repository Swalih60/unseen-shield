// Revoking: set the approval back to zero.
//
// This is the one step that can't be private. A revoke is a transaction, and
// every transaction is public on Ethereum. Your wallet (MetaMask, Rabby...)
// sends it, so the interface says so before you click.

import { createWalletClient, custom, erc20Abi, getAddress, type Address, type EIP1193Provider } from "viem";
import { mainnet } from "viem/chains";
import { PERMIT2 } from "./registry";
import { permit2Abi, type Approval } from "./scan";

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

export class RevokeError extends Error {}

export async function revoke(approval: Approval, owner: Address): Promise<`0x${string}`> {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new RevokeError("No wallet found. Install MetaMask or Rabby to revoke.");
  }
  const wallet = createWalletClient({ chain: mainnet, transport: custom(window.ethereum) });
  const [account] = await wallet.requestAddresses();
  if (getAddress(account) !== getAddress(owner)) {
    throw new RevokeError(`Switch your wallet to ${owner.slice(0, 6)}…${owner.slice(-4)}. Only the owner can revoke.`);
  }
  const chainId = await wallet.getChainId();
  if (chainId !== mainnet.id) await wallet.switchChain({ id: mainnet.id });

  if (approval.viaPermit2) {
    return wallet.writeContract({
      account,
      address: PERMIT2,
      abi: permit2Abi,
      functionName: "approve",
      args: [approval.token.address, approval.spender.address, 0n, 0],
    });
  }
  return wallet.writeContract({
    account,
    address: approval.token.address,
    abi: erc20Abi,
    functionName: "approve",
    args: [approval.spender.address, 0n],
  });
}
