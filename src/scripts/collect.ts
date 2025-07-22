#!/usr/bin/env node

import { Command } from 'commander';
import inquirer from 'inquirer';
import { DistributionService } from '../services/distribution';
import { WalletManager } from '../utils/wallet';
import { Logger } from '../utils/logger';
import { config } from '../config';

class CollectCLI {
  private distributionService: DistributionService;
  private walletManager: WalletManager;

  constructor() {
    this.distributionService = new DistributionService(config.rpcUrl);
    this.walletManager = new WalletManager(config.rpcUrl);
  }

  async run() {
    try {
      Logger.header('SOL COLLECTION TOOL');
      Logger.info('This tool collects SOL from distributed wallets back to your main wallet');
      Logger.separator();

      // Check if main wallet exists
      if (!this.walletManager.hasMainWallet()) {
        Logger.error('Main wallet not found!');
        Logger.info('Please create a main wallet first by running the main application.');
        process.exit(1);
      }

      // Check current status
      const status = await this.distributionService.getDistributionStatus();
      
      if (status.distributedWallets.length === 0) {
        Logger.warning('No distributed wallets found.');
        Logger.info('Please run distribution first.');
        process.exit(0);
      }

      Logger.info(`Found ${status.distributedWallets.length} distributed wallets`);
      Logger.balance('Total SOL in distributed wallets', status.totalDistributed, 'SOL');

      if (status.totalDistributed === 0) {
        Logger.warning('No SOL found in distributed wallets.');
        process.exit(0);
      }

      Logger.separator();

      // Show wallet details
      Logger.header('DISTRIBUTED WALLET BALANCES');
      status.distributedWallets.forEach(wallet => {
        if (wallet.balance > 0) {
          Logger.info(`Wallet ${wallet.index + 1}: ${wallet.balance} SOL`);
        }
      });

      Logger.separator();

      // Get collection parameters
      const answers = await inquirer.prompt([
        {
          type: 'number',
          name: 'keepAmount',
          message: 'Amount of SOL to keep in each wallet (for future use):',
          default: 0,
          validate: (input: number) => input >= 0 ? true : 'Must be 0 or greater'
        },
        {
          type: 'input',
          name: 'memo',
          message: 'Memo for transactions (optional):',
          default: 'SOL Collection'
        },
        {
          type: 'confirm',
          name: 'confirm',
          message: (answers: any) => {
            const totalToCollect = status.totalDistributed - (answers.keepAmount * status.distributedWallets.length);
            return `Confirm collection of approximately ${totalToCollect.toFixed(6)} SOL back to main wallet?`;
          },
          default: false
        }
      ]);

      if (!answers.confirm) {
        Logger.info('Collection cancelled.');
        process.exit(0);
      }

      // Execute collection
      const result = await this.distributionService.collect({
        keepAmount: answers.keepAmount,
        memo: answers.memo || undefined
      });

      // Display results
      Logger.separator();
      if (result.success) {
        Logger.success('🎉 Collection completed successfully!');
      } else {
        Logger.warning('⚠️  Collection completed with some errors');
      }

      Logger.success(`Total collected: ${result.totalCollected} SOL`);
      Logger.info(`Successful collections: ${result.signatures.filter(s => s !== '').length}`);
      Logger.info(`Failed collections: ${result.errors.length}`);

      if (result.errors.length > 0) {
        Logger.separator();
        Logger.header('ERRORS');
        result.errors.forEach(error => Logger.error(error));
      }

      if (result.signatures.length > 0) {
        Logger.separator();
        Logger.header('TRANSACTION SIGNATURES');
        result.signatures.forEach((signature, index) => {
          if (signature) {
            Logger.success(`Collection ${index + 1}: ${signature}`);
          }
        });
      }

    } catch (error) {
      Logger.error(`Collection failed: ${error}`);
      process.exit(1);
    }
  }

  async showStatus() {
    try {
      Logger.header('COLLECTION STATUS');
      
      const status = await this.distributionService.getDistributionStatus();

      if (status.mainWallet) {
        Logger.info(`Main Wallet: ${status.mainWallet.publicKey}`);
        Logger.balance('Main Balance', status.mainWallet.balance, 'SOL');
      } else {
        Logger.warning('Main wallet not found');
      }

      Logger.separator();
      Logger.info(`Distributed Wallets: ${status.distributedWallets.length}`);
      Logger.balance('Total in Distributed Wallets', status.totalDistributed, 'SOL');

      if (status.distributedWallets.length > 0) {
        Logger.separator();
        Logger.header('DISTRIBUTED WALLET DETAILS');
        status.distributedWallets.forEach(wallet => {
          Logger.info(`Wallet ${wallet.index + 1}: ${wallet.publicKey} - ${wallet.balance} SOL`);
        });

        const collectableAmount = status.distributedWallets.reduce((sum, wallet) => {
          return sum + Math.max(0, wallet.balance - 0.000005); // Minus fee estimation
        }, 0);

        Logger.separator();
        Logger.balance('Estimated Collectable Amount', collectableAmount, 'SOL');
      }

    } catch (error) {
      Logger.error(`Failed to get status: ${error}`);
      process.exit(1);
    }
  }
}

// CLI Setup
const program = new Command();

program
  .name('collect')
  .description('Collect SOL from distributed wallets back to main wallet')
  .version('1.0.0');

program
  .command('run')
  .description('Start interactive collection process')
  .action(async () => {
    const cli = new CollectCLI();
    await cli.run();
  });

program
  .command('status')
  .description('Show current collection status')
  .action(async () => {
    const cli = new CollectCLI();
    await cli.showStatus();
  });

// Default to run command
if (process.argv.length === 2) {
  process.argv.push('run');
}

program.parse(); 