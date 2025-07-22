import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction
} from '@solana/web3.js';
import {
  createSyncNativeInstruction,
  createCloseAccountInstruction,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import { WrapParams } from '../types';
import { config } from '../config';
import { Logger } from '../utils/logger';

export class WrappingService {
  constructor(
    private connection: Connection,
    private keypair: Keypair
  ) {}

  /**
   * Wrap SOL to WSOL
   */
  async wrapSOL(amount: number): Promise<string> {
    try {
      Logger.info(`Wrapping ${amount} SOL to WSOL`);

      // Check balance
      const balance = await this.connection.getBalance(this.keypair.publicKey);
      const balanceSOL = balance / LAMPORTS_PER_SOL;
      
      if (balanceSOL < amount) {
        throw new Error(`Insufficient balance. Available: ${balanceSOL} SOL, Required: ${amount} SOL`);
      }

      // Get associated token account for WSOL
      const associatedTokenAccount = await getAssociatedTokenAddress(
        NATIVE_MINT,
        this.keypair.publicKey
      );

      const transaction = new Transaction();

      // Check if associated token account exists
      const accountInfo = await this.connection.getAccountInfo(associatedTokenAccount);
      
      if (!accountInfo) {
        // Create associated token account
        transaction.add(
          createAssociatedTokenAccountInstruction(
            this.keypair.publicKey,
            associatedTokenAccount,
            this.keypair.publicKey,
            NATIVE_MINT
          )
        );
        Logger.info('Creating WSOL token account...');
      }

      // Transfer SOL to the associated token account
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: this.keypair.publicKey,
          toPubkey: associatedTokenAccount,
          lamports: amount * LAMPORTS_PER_SOL
        })
      );

      // Sync native (this converts the SOL to WSOL)
      transaction.add(
        createSyncNativeInstruction(associatedTokenAccount)
      );

      // Get recent blockhash and send transaction
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = this.keypair.publicKey;

      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.keypair],
        { commitment: config.commitment }
      );

      Logger.success(`Successfully wrapped ${amount} SOL to WSOL`);
      Logger.transaction(signature);
      Logger.info(`WSOL Account: ${associatedTokenAccount.toBase58()}`);

      return signature;
    } catch (error) {
      Logger.error(`SOL wrapping failed: ${error}`);
      throw error;
    }
  }

  /**
   * Unwrap WSOL to SOL
   */
  async unwrapSOL(amount?: number): Promise<string> {
    try {
      Logger.info(amount ? `Unwrapping ${amount} WSOL to SOL` : 'Unwrapping all WSOL to SOL');

      // Get associated token account for WSOL
      const associatedTokenAccount = await getAssociatedTokenAddress(
        NATIVE_MINT,
        this.keypair.publicKey
      );

      // Check if account exists and has balance
      const accountInfo = await this.connection.getAccountInfo(associatedTokenAccount);
      if (!accountInfo) {
        throw new Error('No WSOL account found');
      }

      // Get token balance
      const tokenBalance = await this.connection.getTokenAccountBalance(associatedTokenAccount);
      const wsolBalance = parseFloat(tokenBalance.value.amount) / LAMPORTS_PER_SOL;

      if (wsolBalance === 0) {
        throw new Error('No WSOL balance to unwrap');
      }

      if (amount && amount > wsolBalance) {
        throw new Error(`Insufficient WSOL balance. Available: ${wsolBalance} WSOL, Required: ${amount} WSOL`);
      }

      const transaction = new Transaction();

      if (amount && amount < wsolBalance) {
        // Partial unwrap: create a new temporary account and transfer the remaining WSOL
        Logger.warning('Partial unwrap not fully implemented. Unwrapping all WSOL instead.');
      }

      // Close the account (unwraps all WSOL to SOL)
      transaction.add(
        createCloseAccountInstruction(
          associatedTokenAccount,
          this.keypair.publicKey,
          this.keypair.publicKey
        )
      );

      // Get recent blockhash and send transaction
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = this.keypair.publicKey;

      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.keypair],
        { commitment: config.commitment }
      );

      Logger.success(`Successfully unwrapped ${wsolBalance} WSOL to SOL`);
      Logger.transaction(signature);

      return signature;
    } catch (error) {
      Logger.error(`WSOL unwrapping failed: ${error}`);
      throw error;
    }
  }

  /**
   * Get WSOL balance
   */
  async getWSOLBalance(): Promise<number> {
    try {
      const associatedTokenAccount = await getAssociatedTokenAddress(
        NATIVE_MINT,
        this.keypair.publicKey
      );

      const accountInfo = await this.connection.getAccountInfo(associatedTokenAccount);
      if (!accountInfo) {
        return 0;
      }

      const tokenBalance = await this.connection.getTokenAccountBalance(associatedTokenAccount);
      return parseFloat(tokenBalance.value.amount) / LAMPORTS_PER_SOL;
    } catch (error) {
      Logger.warning(`Could not get WSOL balance: ${error}`);
      return 0;
    }
  }

  /**
   * Get WSOL token account address
   */
  async getWSOLTokenAccount(): Promise<PublicKey> {
    return await getAssociatedTokenAddress(
      NATIVE_MINT,
      this.keypair.publicKey
    );
  }

  /**
   * Check if WSOL account exists
   */
  async hasWSOLAccount(): Promise<boolean> {
    try {
      const associatedTokenAccount = await getAssociatedTokenAddress(
        NATIVE_MINT,
        this.keypair.publicKey
      );

      const accountInfo = await this.connection.getAccountInfo(associatedTokenAccount);
      return accountInfo !== null;
    } catch {
      return false;
    }
  }

  /**
   * Wrap or unwrap based on params
   */
  async processWrap(params: WrapParams): Promise<string> {
    const { amount, unwrap = false } = params;

    if (unwrap) {
      return await this.unwrapSOL(amount);
    } else {
      return await this.wrapSOL(amount);
    }
  }
} 