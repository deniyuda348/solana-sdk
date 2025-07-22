#!/usr/bin/env node

import { Command } from 'commander';
import inquirer from 'inquirer';
import { DistributionService } from '../services/distribution';
import { WalletManager } from '../utils/wallet';
import { Logger } from '../utils/logger';
import { config } from '../config';

class DistributeCLI {
  private distributionService: DistributionService;
  private walletManager: WalletManager;

  constructor() {
    this.distributionService = new DistributionService(config.rpcUrl);
    this.walletManager = new WalletManager(config.rpcUrl);
  }

  async run() {
    try {
      Logger.header('SOL DISTRIBUTION TOOL');
      Logger.info('This tool distributes SOL from your main wallet to multiple sub-wallets');
      Logger.separator();

      // Check if main wallet exists
      if (!this.walletManager.hasMainWallet()) {
        Logger.error('Main wallet not found!');
        Logger.info('Please create a main wallet first by running the main application.');
        process.exit(1);
      }

      // Get distribution parameters
      const answers = await inquirer.prompt([
        {
          type: 'number',
          name: 'walletCount',
          message: 'How many wallets to distribute to?',
          default: 5,
          validate: (input: number) => input > 0 ? true : 'Must be greater than 0'
        },
        {
          type: 'number',
          name: 'amountPerWallet',
          message: 'Amount of SOL to send to each wallet:',
          default: 0.01,
          validate: (input: number) => input > 0 ? true : 'Must be greater than 0'
        },
        {
          type: 'input',
          name: 'memo',
          message: 'Memo for transactions (optional):',
          default: 'SOL Distribution'
        },
        {
          type: 'confirm',
          name: 'confirm',
          message: (answers: any) => 
            `Confirm distribution of ${answers.amountPerWallet} SOL to ${answers.walletCount} wallets?`,
          default: false
        }
      ]);

      if (!answers.confirm) {
        Logger.info('Distribution cancelled.');
        process.exit(0);
      }

      // Execute distribution
      const result = await this.distributionService.distribute({
        walletCount: answers.walletCount,
        amountPerWallet: answers.amountPerWallet,
        memo: answers.memo || undefined
      });

      // Display results
      Logger.separator();
      if (result.success) {
        Logger.success('🎉 Distribution completed successfully!');
      } else {
        Logger.warning('⚠️  Distribution completed with some errors');
      }

      Logger.info(`Total wallets: ${result.wallets.length}`);
      Logger.info(`Successful transfers: ${result.signatures.filter(s => s !== '').length}`);
      Logger.info(`Failed transfers: ${result.errors.length}`);

      if (result.errors.length > 0) {
        Logger.separator();
        Logger.header('ERRORS');
        result.errors.forEach(error => Logger.error(error));
      }

      Logger.separator();
      Logger.header('WALLET DETAILS');
      result.wallets.forEach((wallet, index) => {
        const signature = result.signatures[index];
        if (signature) {
          Logger.success(`Wallet ${index + 1}: ${wallet.publicKey} - ${wallet.amount} SOL - ${signature}`);
        } else {
          Logger.error(`Wallet ${index + 1}: ${wallet.publicKey} - FAILED`);
        }
      });

    } catch (error) {
      Logger.error(`Distribution failed: ${error}`);
      process.exit(1);
    }
  }

  async showStatus() {
    try {
      Logger.header('DISTRIBUTION STATUS');
      
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
  .name('distribute')
  .description('Distribute SOL from main wallet to sub-wallets')
  .version('1.0.0');

program
  .command('run')
  .description('Start interactive distribution process')
  .action(async () => {
    const cli = new DistributeCLI();
    await cli.run();
  });

program
  .command('status')
  .description('Show current distribution status')
  .action(async () => {
    const cli = new DistributeCLI();
    await cli.showStatus();
  });

// Default to run command
if (process.argv.length === 2) {
  process.argv.push('run');
}

program.parse(); 