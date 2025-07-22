import { 
  Connection, 
  Keypair, 
  PublicKey, 
  LAMPORTS_PER_SOL,
  clusterApiUrl
} from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import { WalletInfo } from '../types';
import { config } from '../config';
import { Logger } from './logger';

export class WalletManager {
  private connection: Connection;

  constructor(rpcUrl?: string) {
    this.connection = new Connection(
      rpcUrl || config.rpcUrl,
      config.commitment
    );
  }

  /**
   * Generate a new wallet keypair
   */
  generateWallet(): Keypair {
    return Keypair.generate();
  }

  /**
   * Load wallet from private key array or base58 string
   */
  loadWallet(privateKey: number[] | string): Keypair {
    try {
      if (typeof privateKey === 'string') {
        // If it's a base58 string
        return Keypair.fromSecretKey(
          new Uint8Array(JSON.parse(privateKey))
        );
      } else {
        // If it's an array of numbers
        return Keypair.fromSecretKey(new Uint8Array(privateKey));
      }
    } catch (error) {
      Logger.error(`Failed to load wallet: ${error}`);
      throw error;
    }
  }

  /**
   * Load wallet from JSON file
   */
  loadWalletFromFile(filePath: string): Keypair {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`Wallet file not found: ${filePath}`);
      }

      const walletData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return this.loadWallet(walletData);
    } catch (error) {
      Logger.error(`Failed to load wallet from file: ${error}`);
      throw error;
    }
  }

  /**
   * Save wallet to JSON file
   */
  saveWalletToFile(keypair: Keypair, filePath: string): void {
    try {
      const walletData = Array.from(keypair.secretKey);
      fs.writeFileSync(filePath, JSON.stringify(walletData, null, 2));
      Logger.success(`Wallet saved to ${filePath}`);
    } catch (error) {
      Logger.error(`Failed to save wallet: ${error}`);
      throw error;
    }
  }

  /**
   * Get wallet balance in SOL
   */
  async getSOLBalance(publicKey: PublicKey): Promise<number> {
    try {
      const balance = await this.connection.getBalance(publicKey);
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      Logger.error(`Failed to get SOL balance: ${error}`);
      throw error;
    }
  }

  /**
   * Get comprehensive wallet information
   */
  async getWalletInfo(keypair: Keypair): Promise<WalletInfo> {
    try {
      const balance = await this.getSOLBalance(keypair.publicKey);
      
      return {
        publicKey: keypair.publicKey,
        privateKey: keypair.secretKey,
        balance
      };
    } catch (error) {
      Logger.error(`Failed to get wallet info: ${error}`);
      throw error;
    }
  }

  /**
   * Display wallet information
   */
  async displayWalletInfo(keypair: Keypair): Promise<void> {
    try {
      const walletInfo = await this.getWalletInfo(keypair);
      
      Logger.header('WALLET INFORMATION');
      Logger.wallet(walletInfo.publicKey.toBase58());
      Logger.balance('SOL Balance', walletInfo.balance, 'SOL');
    } catch (error) {
      Logger.error(`Failed to display wallet info: ${error}`);
    }
  }

  /**
   * Check if address is valid
   */
  isValidAddress(address: string): boolean {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create default wallet directory if it doesn't exist
   */
  ensureWalletDirectory(): string {
    const walletDir = path.join(process.cwd(), 'wallets');
    if (!fs.existsSync(walletDir)) {
      fs.mkdirSync(walletDir, { recursive: true });
    }
    return walletDir;
  }

  /**
   * Get connection object
   */
  getConnection(): Connection {
    return this.connection;
  }
} 