import * as dotenv from 'dotenv';
dotenv.config();

export const config = {
  // Solana network configuration
  rpcUrl: process.env.RPC_URL || 'https://api.mainnet-beta.solana.com',
  network: process.env.SOLANA_NETWORK || 'mainnet-beta',
  
  // Jupiter API configuration
  jupiterApiUrl: 'https://quote-api.jup.ag/v6',
  
  // Transaction configuration
  slippageBps: parseInt(process.env.SLIPPAGE_BPS || '300'), // 3% default slippage
  priorityFee: parseInt(process.env.PRIORITY_FEE || '1000'), // 1000 lamports
  
  // Wallet configuration
  commitment: 'confirmed' as const,
  privateKey: process.env.PRIVATE_KEY,
  
  // Known token mints
  tokens: {
    WSOL: 'So11111111111111111111111111111111111111112',
    USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    RAY: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
    SRM: 'SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt'
  },
  
  // Display configuration
  decimals: 9, // SOL has 9 decimals
  displayPrecision: 6
} as const; 