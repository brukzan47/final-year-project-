import { ethers } from 'ethers';
import { env } from '../config/env.js';

function getNetworkLabel(provider) {
  try { return env.blockchain.networkName || (provider && provider.network ? provider.network.name : '') || ''; } catch { return env.blockchain.networkName || ''; }
}

export async function anchorHashRawTx(hexHash) {
  if (!hexHash) throw new Error('hash required');
  if (!env.blockchain.rpcUrl || !env.blockchain.privateKey) throw new Error('blockchain not configured');
  const provider = new ethers.JsonRpcProvider(env.blockchain.rpcUrl, env.blockchain.chainId);
  const wallet = new ethers.Wallet(env.blockchain.privateKey, provider);
  const data = hexHash.startsWith('0x') ? hexHash : ('0x' + hexHash);
  const tx = await wallet.sendTransaction({ to: wallet.address, value: 0n, data });
  const receipt = await tx.wait();
  return {
    network: getNetworkLabel(provider),
    txHash: receipt?.hash || tx.hash,
    hashAnchored: data,
  };
}

export async function anchorHash(hexHash) {
  if (!env.blockchain.enabled || env.blockchain.mode === 'stub') {
    return { network: 'stub', txHash: `stub-${Date.now()}`, hashAnchored: hexHash.startsWith('0x') ? hexHash : ('0x' + hexHash) };
  }
  if (env.blockchain.mode === 'rawtx') {
    return anchorHashRawTx(hexHash);
  }
  // Future: support contract anchoring via ABI + contract address
  return anchorHashRawTx(hexHash);
}

