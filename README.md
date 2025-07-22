# Solana Wallet Manager

A comprehensive Solana wallet management tool for transfers, swaps, portfolio tracking, and **SOL distribution/collection**.

## Features

- 🔐 **Secure Wallet Management** - Wallets stored with encoded private keys
- 💰 **Portfolio Tracking** - View token balances and portfolio value
- 🔄 **Token Swapping** - Integrated Jupiter DEX for token swaps
- 📤 **SOL Transfers** - Send SOL with memo support
- 🌊 **Wrap/Unwrap SOL** - Convert between SOL and WSOL
- 📊 **Distribution System** - Distribute SOL to multiple wallets
- 🔄 **Collection System** - Collect SOL back from distributed wallets
- 🎯 **Interactive CLI** - User-friendly command-line interface

## Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

## Wallet Structure

The application now uses a structured wallet system in the `./wallet` folder:

```
wallet/
├── main.json              # Main wallet (encoded private key)
└── distributed/           # Sub-wallets for distribution
    ├── wallet-0.json      # First distributed wallet
    ├── wallet-1.json      # Second distributed wallet
    └── ...                # More wallets as needed
```

All wallet files contain **encoded private keys** for security, not plain JSON arrays.

## Quick Start

### 1. Interactive Mode
```bash
npm run dev
# or
npm start
```

### 2. Create a Wallet
```bash
npm run dev create-wallet
```

### 3. Distribution & Collection

#### Distribute SOL to Multiple Wallets
```bash
npm run distribute
```
This command will:
- Check your main wallet balance
- Create sub-wallets if needed
- Distribute specified SOL amount to each wallet
- Show detailed transaction results

#### Collect SOL Back to Main Wallet
```bash
npm run collect
```
This command will:
- Check all distributed wallet balances
- Collect SOL back to main wallet
- Allow you to keep a specified amount in each wallet
- Show total collected amount

### 4. Check Distribution Status
```bash
npm run distribute status
npm run collect status
```

## Environment Configuration

Create a `.env` file for custom configuration:

```env
# Solana Network
RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_NETWORK=mainnet-beta

# Auto-load wallet (optional)
PRIVATE_KEY=your_encoded_private_key

# Transaction Settings
SLIPPAGE_BPS=300
PRIORITY_FEE=1000
```

## Usage Examples

### Distribution Workflow

1. **Setup Main Wallet:**
   ```bash
   npm run dev
   # Choose "Generate new wallet" → "Save as main wallet (recommended)"
   ```

2. **Fund Main Wallet:**
   - Send SOL to your main wallet address
   - Verify balance in the application

3. **Distribute SOL:**
   ```bash
   npm run distribute
   # Follow prompts to distribute 0.01 SOL to 5 wallets
   ```

4. **Check Status:**
   ```bash
   npm run distribute status
   ```

5. **Collect SOL Back:**
   ```bash
   npm run collect
   # Collect SOL from all distributed wallets back to main
   ```

### Advanced Features

#### Batch Operations
- The distribution service automatically creates wallets as needed
- Rate limiting prevents network issues during batch operations
- Detailed error reporting for failed transactions

#### Security Features
- Private keys are encoded using AES-256-CBC encryption
- Backward compatibility with plain JSON wallet files
- Automatic wallet directory creation and management

#### Error Handling
- Insufficient balance detection
- Failed transaction recovery
- Detailed error reporting and logging

## CLI Commands

| Command | Description |
|---------|-------------|
| `npm start` | Run the built application |
| `npm run dev` | Run in development mode |
| `npm run build` | Build TypeScript to JavaScript |
| `npm run distribute` | Interactive SOL distribution |
| `npm run collect` | Interactive SOL collection |
| `npm test` | Run test suite |

## API Reference

### DistributionService

```typescript
import { DistributionService } from './src/services/distribution';

const service = new DistributionService(rpcUrl);

// Distribute SOL
await service.distribute({
  walletCount: 5,
  amountPerWallet: 0.01,
  memo: 'Distribution'
});

// Collect SOL
await service.collect({
  keepAmount: 0.001,
  memo: 'Collection'
});

// Get status
const status = await service.getDistributionStatus();
```

### WalletManager

```typescript
import { WalletManager } from './src/utils/wallet';

const manager = new WalletManager(rpcUrl);

// Save main wallet
manager.saveMainWallet(keypair);

// Load main wallet
const mainWallet = manager.loadMainWallet();

// Create distributed wallet
const wallet = manager.createDistributedWallet(index);

// Load all distributed wallets
const wallets = manager.loadDistributedWallets();
```

## Security Notes

- **Private Key Encoding**: All wallet files use AES-256-CBC encryption
- **Local Storage**: Wallets are stored locally in the `./wallet` folder
- **Network Security**: Use HTTPS RPC endpoints in production
- **Backup**: Always backup your `./wallet` folder

## Troubleshooting

### Common Issues

1. **"Main wallet not found"**
   - Run the main application and create a main wallet first
   - Ensure `./wallet/main.json` exists

2. **"Insufficient balance"**
   - Check main wallet balance before distribution
   - Account for transaction fees (≈5000 lamports per transaction)

3. **"No distributed wallets found"**
   - Run distribution first to create sub-wallets
   - Check `./wallet/distributed/` folder

### Error Recovery

- Failed transactions will be reported with specific error messages
- Partially completed distributions can be resumed
- Use status commands to check current wallet states

## Development

```bash
# Install dependencies
npm install

# Run in development
npm run dev

# Build project
npm run build

# Type checking
npm run type-check
```

## License

MIT License - see LICENSE file for details. 