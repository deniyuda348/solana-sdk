import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction
} from '@solana/web3.js';
import { WalletManager } from '../utils/wallet';
import { TransferService } from './transfer';
import { config } from '../config';
import { Logger } from '../utils/logger';

export interface DistributionConfig {
  walletCount: number;
  amountPerWallet: number;
  memo?: string;
}

export interface CollectionConfig {
  keepAmount?: number; // Amount to keep in each wallet (default: 0)
  memo?: string;
}

export class DistributionService {
  private connection: Connection;
  private walletManager: WalletManager;

  constructor(rpcUrl?: string) {
    this.connection = new Connection(rpcUrl || config.rpcUrl, config.commitment);
    this.walletManager = new WalletManager(rpcUrl);
  }

  /**
   * Distribute SOL from main wallet to multiple sub-wallets
   */
  async distribute(distributionConfig: DistributionConfig): Promise<{
    success: boolean;
    signatures: string[];
    wallets: { publicKey: string; amount: number }[];
    errors: string[];
  }> {
    try {
      const { walletCount, amountPerWallet, memo } = distributionConfig;

      Logger.header('STARTING SOL DISTRIBUTION');
      Logger.info(`Distributing ${amountPerWallet} SOL to ${walletCount} wallets`);

      // Check if main wallet exists
      if (!this.walletManager.hasMainWallet()) {
        throw new Error('Main wallet not found. Please create a main wallet first.');
      }

      // Load main wallet
      const mainWallet = this.walletManager.loadMainWallet();
      Logger.info(`Main wallet: ${mainWallet.publicKey.toBase58()}`);

      // Check main wallet balance
      const balance = await this.walletManager.getSOLBalance(mainWallet.publicKey);
      const totalRequired = walletCount * amountPerWallet;
      const estimatedFees = walletCount * 0.000005; // Estimate ~5000 lamports per transaction

      Logger.info(`Current balance: ${balance} SOL`);
      Logger.info(`Total required: ${totalRequired} SOL`);
      Logger.info(`Estimated fees: ${estimatedFees} SOL`);

      if (balance < totalRequired + estimatedFees) {
        throw new Error(`Insufficient balance. Required: ${totalRequired + estimatedFees} SOL, Available: ${balance} SOL`);
      }

      // Create transfer service
      const transferService = new TransferService(this.connection, mainWallet);

      // Create or load distributed wallets
      const existingWalletCount = this.walletManager.getDistributedWalletCount();
      const walletsToCreate = Math.max(0, walletCount - existingWalletCount);

      Logger.info(`Existing wallets: ${existingWalletCount}`);
      Logger.info(`Creating ${walletsToCreate} new wallets...`);

      // Create additional wallets if needed
      for (let i = existingWalletCount; i < walletCount; i++) {
        this.walletManager.createDistributedWallet(i);
        Logger.success(`Created wallet ${i + 1}/${walletCount}`);
      }

      // Load all distributed wallets
      const distributedWallets = this.walletManager.loadDistributedWallets();
      const targetWallets = distributedWallets.slice(0, walletCount);

      Logger.info(`Loaded ${targetWallets.length} distributed wallets`);
      Logger.separator();

      // Distribute SOL to each wallet
      const signatures: string[] = [];
      const walletInfo: { publicKey: string; amount: number }[] = [];
      const errors: string[] = [];
      let successCount = 0;

      for (let i = 0; i < targetWallets.length; i++) {
        const wallet = targetWallets[i];
        try {
          Logger.info(`[${i + 1}/${targetWallets.length}] Transferring ${amountPerWallet} SOL to ${wallet.publicKey.toBase58()}`);
          
          const signature = await transferService.transferSOL({
            toAddress: wallet.publicKey.toBase58(),
            amount: amountPerWallet,
            memo: memo
          });

          signatures.push(signature);
          walletInfo.push({
            publicKey: wallet.publicKey.toBase58(),
            amount: amountPerWallet
          });
          successCount++;

          Logger.success(`✅ Transfer ${i + 1} completed: ${signature}`);
        } catch (error) {
          const errorMsg = `Failed to transfer to wallet ${i + 1}: ${error}`;
          Logger.error(`❌ ${errorMsg}`);
          errors.push(errorMsg);
          signatures.push('');
        }

        // Small delay to avoid rate limiting
        if (i < targetWallets.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      Logger.separator();
      Logger.header('DISTRIBUTION COMPLETED');
      Logger.success(`Successfully distributed to ${successCount}/${walletCount} wallets`);
      
      if (errors.length > 0) {
        Logger.warning(`${errors.length} transfers failed`);
        errors.forEach(error => Logger.error(error));
      }

      return {
        success: errors.length === 0,
        signatures,
        wallets: walletInfo,
        errors
      };

    } catch (error) {
      Logger.error(`Distribution failed: ${error}`);
      throw error;
    }
  }

  /**
   * Collect SOL from distributed wallets back to main wallet
   */
  async collect(collectionConfig: CollectionConfig = {}): Promise<{
    success: boolean;
    signatures: string[];
    totalCollected: number;
    errors: string[];
  }> {
    try {
      const { keepAmount = 0, memo } = collectionConfig;

      Logger.header('STARTING SOL COLLECTION');
      Logger.info(`Collecting SOL from distributed wallets (keeping ${keepAmount} SOL in each)`);

      // Check if main wallet exists
      if (!this.walletManager.hasMainWallet()) {
        throw new Error('Main wallet not found. Please create a main wallet first.');
      }

      const mainWallet = this.walletManager.loadMainWallet();
      Logger.info(`Main wallet: ${mainWallet.publicKey.toBase58()}`);

      // Load all distributed wallets
      const distributedWallets = this.walletManager.loadDistributedWallets();
      
      if (distributedWallets.length === 0) {
        Logger.warning('No distributed wallets found');
        return {
          success: true,
          signatures: [],
          totalCollected: 0,
          errors: []
        };
      }

      Logger.info(`Found ${distributedWallets.length} distributed wallets`);
      Logger.separator();

      const signatures: string[] = [];
      const errors: string[] = [];
      let totalCollected = 0;
      let successCount = 0;

      for (let i = 0; i < distributedWallets.length; i++) {
        const wallet = distributedWallets[i];
        try {
          // Check wallet balance
          const balance = await this.walletManager.getSOLBalance(wallet.publicKey);
          const transferAmount = balance - keepAmount - 0.000005; // Keep some for fees

          if (transferAmount <= 0) {
            Logger.info(`[${i + 1}/${distributedWallets.length}] Wallet ${wallet.publicKey.toBase58()} has insufficient balance to collect (${balance} SOL)`);
            continue;
          }

          Logger.info(`[${i + 1}/${distributedWallets.length}] Collecting ${transferAmount} SOL from ${wallet.publicKey.toBase58()}`);

          // Create transfer service for this wallet
          const transferService = new TransferService(this.connection, wallet);

          const signature = await transferService.transferSOL({
            toAddress: mainWallet.publicKey.toBase58(),
            amount: transferAmount,
            memo: memo
          });

          signatures.push(signature);
          totalCollected += transferAmount;
          successCount++;

          Logger.success(`✅ Collection ${i + 1} completed: ${signature} (${transferAmount} SOL)`);
        } catch (error) {
          const errorMsg = `Failed to collect from wallet ${i + 1}: ${error}`;
          Logger.error(`❌ ${errorMsg}`);
          errors.push(errorMsg);
          signatures.push('');
        }

        // Small delay to avoid rate limiting
        if (i < distributedWallets.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      Logger.separator();
      Logger.header('COLLECTION COMPLETED');
      Logger.success(`Successfully collected from ${successCount}/${distributedWallets.length} wallets`);
      Logger.success(`Total collected: ${totalCollected} SOL`);
      
      if (errors.length > 0) {
        Logger.warning(`${errors.length} collections failed`);
        errors.forEach(error => Logger.error(error));
      }

      return {
        success: errors.length === 0,
        signatures,
        totalCollected,
        errors
      };

    } catch (error) {
      Logger.error(`Collection failed: ${error}`);
      throw error;
    }
  }

  /**
   * Get status of all distributed wallets
   */
  async getDistributionStatus(): Promise<{
    mainWallet: { publicKey: string; balance: number } | null;
    distributedWallets: { publicKey: string; balance: number; index: number }[];
    totalDistributed: number;
  }> {
    try {
      let mainWallet = null;
      let totalDistributed = 0;

      // Get main wallet info
      if (this.walletManager.hasMainWallet()) {
        const mainKeypair = this.walletManager.loadMainWallet();
        const balance = await this.walletManager.getSOLBalance(mainKeypair.publicKey);
        mainWallet = {
          publicKey: mainKeypair.publicKey.toBase58(),
          balance
        };
      }

      // Get distributed wallets info
      const distributedWallets = this.walletManager.loadDistributedWallets();
      const distributedWalletInfo = [];

      for (let i = 0; i < distributedWallets.length; i++) {
        const wallet = distributedWallets[i];
        const balance = await this.walletManager.getSOLBalance(wallet.publicKey);
        distributedWalletInfo.push({
          publicKey: wallet.publicKey.toBase58(),
          balance,
          index: i
        });
        totalDistributed += balance;
      }

      return {
        mainWallet,
        distributedWallets: distributedWalletInfo,
        totalDistributed
      };
    } catch (error) {
      Logger.error(`Failed to get distribution status: ${error}`);
      throw error;
    }
  }
} 