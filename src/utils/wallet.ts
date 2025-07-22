import { 
  Connection, 
  Keypair, 
  PublicKey, 
  LAMPORTS_PER_SOL,
  clusterApiUrl
} from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
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
   * Encode private key for secure storage
   */
  private encodePrivateKey(secretKey: Uint8Array): string {
    const key = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(JSON.stringify(Array.from(secretKey)), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${key.toString('hex')}:${iv.toString('hex')}:${encrypted}`;
  }

  /**
   * Decode private key from storage
   */
  private decodePrivateKey(encodedKey: string): Uint8Array {
    try {
      const [keyHex, ivHex, encrypted] = encodedKey.split(':');
      const key = Buffer.from(keyHex, 'hex');
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      const secretKeyArray = JSON.parse(decrypted);
      return new Uint8Array(secretKeyArray);
    } catch (error) {
      // Fallback for plain text stored keys (backward compatibility)
      try {
        const secretKeyArray = JSON.parse(encodedKey);
        return new Uint8Array(secretKeyArray);
      } catch {
        throw new Error('Invalid encoded private key format');
      }
    }
  }

  /**
   * Load wallet from private key array or base58 string
   */
  loadWallet(privateKey: number[] | string): Keypair {
    try {
      if (typeof privateKey === 'string') {
        // If it's a string, try to decode it first
        const secretKey = this.decodePrivateKey(privateKey);
        return Keypair.fromSecretKey(secretKey);
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

      const walletData = fs.readFileSync(filePath, 'utf8');
      return this.loadWallet(walletData);
    } catch (error) {
      Logger.error(`Failed to load wallet from file: ${error}`);
      throw error;
    }
  }

  /**
   * Save wallet to JSON file with encoded private key
   */
  saveWalletToFile(keypair: Keypair, filePath: string): void {
    try {
      const encodedPrivateKey = this.encodePrivateKey(keypair.secretKey);
      fs.writeFileSync(filePath, encodedPrivateKey, 'utf8');
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