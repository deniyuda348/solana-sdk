import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  TransactionInstruction
} from '@solana/web3.js';
import { TransferParams } from '../types';
import { config } from '../config';
import { Logger } from '../utils/logger';

export class TransferService {
  constructor(
    private connection: Connection,
    private keypair: Keypair
  ) {}

  /**
   * Transfer SOL to another address
   */
  async transferSOL(params: TransferParams): Promise<string> {
    try {
      const { toAddress, amount, memo } = params;

      Logger.info(`Transferring ${amount} SOL to ${toAddress}`);

      // Validate recipient address
      let recipientPubkey: PublicKey;
      try {
        recipientPubkey = new PublicKey(toAddress);
      } catch (error) {
        throw new Error(`Invalid recipient address: ${toAddress}`);
      }

      // Check sender balance
      const balance = await this.connection.getBalance(this.keypair.publicKey);
      const balanceSOL = balance / LAMPORTS_PER_SOL;
      
      if (balanceSOL < amount) {
        throw new Error(`Insufficient balance. Available: ${balanceSOL} SOL, Required: ${amount} SOL`);
      }

      // Create transaction
      const transaction = new Transaction();

      // Add transfer instruction
      const transferInstruction = SystemProgram.transfer({
        fromPubkey: this.keypair.publicKey,
        toPubkey: recipientPubkey,
        lamports: amount * LAMPORTS_PER_SOL
      });

      transaction.add(transferInstruction);

      // Add memo instruction if provided
      if (memo) {
        const memoInstruction = new TransactionInstruction({
          keys: [
            {
              pubkey: this.keypair.publicKey,
              isSigner: true,
              isWritable: false
            }
          ],
          data: Buffer.from(memo, 'utf8'),
          programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr')
        });
        transaction.add(memoInstruction);
      }

      // Get recent blockhash
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = this.keypair.publicKey;

      // Sign and send transaction
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.keypair],
        { commitment: config.commitment }
      );

      Logger.success(`Transfer completed successfully!`);
      Logger.transaction(signature);
      Logger.info(`Transferred: ${amount} SOL`);
      Logger.info(`To: ${toAddress}`);
      if (memo) {
        Logger.info(`Memo: ${memo}`);
      }

      return signature;
    } catch (error) {
      Logger.error(`Transfer failed: ${error}`);
      throw error;
    }
  }

  /**
   * Get estimated transaction fee for SOL transfer
   */
  async estimateTransferFee(memo?: string): Promise<number> {
    try {
      // Create a sample transaction to estimate fee
      const dummyRecipient = Keypair.generate().publicKey;
      const transaction = new Transaction();

      transaction.add(
        SystemProgram.transfer({
          fromPubkey: this.keypair.publicKey,
          toPubkey: dummyRecipient,
          lamports: LAMPORTS_PER_SOL // 1 SOL for estimation
        })
      );

      if (memo) {
        const memoInstruction = new TransactionInstruction({
          keys: [
            {
              pubkey: this.keypair.publicKey,
              isSigner: true,
              isWritable: false
            }
          ],
          data: Buffer.from(memo, 'utf8'),
          programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr')
        });
        transaction.add(memoInstruction);
      }

      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = this.keypair.publicKey;

      // Get fee for this transaction
      const fee = await this.connection.getFeeForMessage(
        transaction.compileMessage(),
        config.commitment
      );

      return (fee.value || 5000) / LAMPORTS_PER_SOL; // Default to 5000 lamports if can't get fee
    } catch (error) {
      Logger.warning(`Could not estimate fee: ${error}`);
      return 0.000005; // Default fee estimate
    }
  }

  /**
   * Batch transfer SOL to multiple addresses
   */
  async batchTransfer(transfers: TransferParams[]): Promise<string[]> {
    try {
      Logger.info(`Executing batch transfer to ${transfers.length} recipients`);

      const signatures: string[] = [];
      let successCount = 0;
      let errorCount = 0;

      for (const transfer of transfers) {
        try {
          const signature = await this.transferSOL(transfer);
          signatures.push(signature);
          successCount++;
          Logger.success(`✅ Transfer ${successCount}/${transfers.length} completed`);
        } catch (error) {
          errorCount++;
          Logger.error(`❌ Transfer to ${transfer.toAddress} failed: ${error}`);
          signatures.push(''); // Empty string for failed transfers
        }
      }

      Logger.separator();
      Logger.info(`Batch transfer completed: ${successCount} successful, ${errorCount} failed`);

      return signatures;
    } catch (error) {
      Logger.error(`Batch transfer failed: ${error}`);
      throw error;
    }
  }

  /**
   * Check if recipient address exists (has been activated)
   */
  async checkRecipientExists(address: string): Promise<boolean> {
    try {
      const pubkey = new PublicKey(address);
      const accountInfo = await this.connection.getAccountInfo(pubkey);
      return accountInfo !== null;
    } catch {
      return false;
    }
  }
} 