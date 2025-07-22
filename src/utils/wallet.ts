import { 
  Connection, 
  Keypair, 
  PublicKey, 
  LAMPORTS_PER_SOL,
  clusterApiUrl
} from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import bs58 from 'bs58';
import { WalletInfo } from '../types';
import { config } from '../config';
import { Logger } from './logger';

export class WalletManager {
  private connection: Connection;
  private walletDir: string;
  private distributedDir: string;

  constructor(rpcUrl?: string) {
    this.connection = new Connection(
      rpcUrl || config.rpcUrl,
      config.commitment
    );
    this.walletDir = path.join(process.cwd(), 'wallet');
    this.distributedDir = path.join(this.walletDir, 'distributed');
    this.ensureWalletDirectories();
  }

  /**
   * Generate a new wallet keypair
   */
  generateWallet(): Keypair {
    return Keypair.generate();
  }

  /**
   * Get base58 private key from keypair
   */
  getPrivateKeyBase58(keypair: Keypair): string {
    return this.encodePrivateKey(keypair.secretKey);
  }

  /**
   * Convert private key to base58 string for storage
   */
  private encodePrivateKey(secretKey: Uint8Array): string {
    return bs58.encode(secretKey);
  }

  /**
   * Decode private key from base58 string
   */
  private decodePrivateKey(base58Key: string): Uint8Array {
    try {
      // Try to decode as base58 first
      return bs58.decode(base58Key);
    } catch (error) {
      // Fallback for legacy formats (backward compatibility)
      try {
        // Try as JSON array format
        const secretKeyArray = JSON.parse(base58Key);
        return new Uint8Array(secretKeyArray);
      } catch {
        // Try as encrypted format (legacy)
        try {
          const [keyHex, ivHex, encrypted] = base58Key.split(':');
          if (keyHex && ivHex && encrypted) {
            throw new Error('Legacy encrypted format is no longer supported. Please regenerate your wallet.');
          }
        } catch {
          // Not encrypted format
        }
        throw new Error('Invalid private key format. Expected base58 string.');
      }
    }
  }

  /**
   * Load wallet from private key array or base58 string
   */
  loadWallet(privateKey: number[] | string): Keypair {
    try {
      if (typeof privateKey === 'string') {
        // If it's a string, decode it as base58 or fallback to legacy formats
        const secretKey = this.decodePrivateKey(privateKey);
        return Keypair.fromSecretKey(secretKey);
      } else {
        // If it's an array of numbers (legacy format)
        return Keypair.fromSecretKey(new Uint8Array(privateKey));
      }
    } catch (error) {
      Logger.error(`Failed to load wallet: ${error}`);
      throw error;
    }
  }

  /**
   * Load wallet from file (supports base58 and legacy formats)
   */
  loadWalletFromFile(filePath: string): Keypair {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`Wallet file not found: ${filePath}`);
      }

      const walletData = fs.readFileSync(filePath, 'utf8').trim();
      return this.loadWallet(walletData);
    } catch (error) {
      Logger.error(`Failed to load wallet from file: ${error}`);
      throw error;
    }
  }

  /**
   * Save wallet to file with base58 private key
   */
  saveWalletToFile(keypair: Keypair, filePath: string): void {
    try {
      const base58PrivateKey = this.encodePrivateKey(keypair.secretKey);
      fs.writeFileSync(filePath, base58PrivateKey, 'utf8');
      Logger.success(`Wallet saved to ${filePath}`);
    } catch (error) {
      Logger.error(`Failed to save wallet: ${error}`);
      throw error;
    }
  }

  /**
   * Save main wallet
   */
  saveMainWallet(keypair: Keypair): void {
    const mainWalletPath = path.join(this.walletDir, 'main.json');
    this.saveWalletToFile(keypair, mainWalletPath);
  }

  /**
   * Load main wallet
   */
  loadMainWallet(): Keypair {
    const mainWalletPath = path.join(this.walletDir, 'main.json');
    return this.loadWalletFromFile(mainWalletPath);
  }

  /**
   * Check if main wallet exists
   */
  hasMainWallet(): boolean {
    const mainWalletPath = path.join(this.walletDir, 'main.json');
    return fs.existsSync(mainWalletPath);
  }

  /**
   * Create and save a distributed wallet
   */
  createDistributedWallet(index: number): Keypair {
    const keypair = this.generateWallet();
    const walletPath = path.join(this.distributedDir, `wallet-${index}.json`);
    this.saveWalletToFile(keypair, walletPath);
    return keypair;
  }

  /**
   * Load all distributed wallets
   */
  loadDistributedWallets(): Keypair[] {
    const wallets: Keypair[] = [];
    
    if (!fs.existsSync(this.distributedDir)) {
      return wallets;
    }

    const files = fs.readdirSync(this.distributedDir)
      .filter(file => file.endsWith('.json'))
      .sort((a, b) => {
        const aIndex = parseInt(a.match(/wallet-(\d+)\.json/)?.[1] || '0');
        const bIndex = parseInt(b.match(/wallet-(\d+)\.json/)?.[1] || '0');
        return aIndex - bIndex;
      });

    for (const file of files) {
      try {
        const walletPath = path.join(this.distributedDir, file);
        const keypair = this.loadWalletFromFile(walletPath);
        wallets.push(keypair);
      } catch (error) {
        Logger.warning(`Failed to load wallet ${file}: ${error}`);
      }
    }

    return wallets;
  }

  /**
   * Get count of distributed wallets
   */
  getDistributedWalletCount(): number {
    if (!fs.existsSync(this.distributedDir)) {
      return 0;
    }
    return fs.readdirSync(this.distributedDir)
      .filter(file => file.endsWith('.json')).length;
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
   * Create default wallet directory if it doesn't exist (legacy method)
   */
  ensureWalletDirectory(): string {
    return this.walletDir;
  }

  /**
   * Create and ensure wallet directories
   */
  private ensureWalletDirectories(): void {
    if (!fs.existsSync(this.walletDir)) {
      fs.mkdirSync(this.walletDir, { recursive: true });
    }
    if (!fs.existsSync(this.distributedDir)) {
      fs.mkdirSync(this.distributedDir, { recursive: true });
    }
  }

  /**
   * Get connection object
   */
  getConnection(): Connection {
    return this.connection;
  }
} 