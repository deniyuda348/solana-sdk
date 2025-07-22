# Solana Wallet Manager

A comprehensive command-line interface (CLI) tool for managing Solana wallet operations including transfers, token swaps, SOL wrapping, and portfolio tracking.

## Features

🔐 **Wallet Management**
- Generate new wallets
- Import existing wallets from private key or file
- Secure wallet storage and loading

💸 **SOL Transfers**
- Send SOL to other wallets
- Add memos to transfers
- Batch transfers to multiple recipients
- Fee estimation

🔄 **SOL Wrapping/Unwrapping**
- Wrap SOL to WSOL (Wrapped SOL)
- Unwrap WSOL back to SOL
- Automatic token account creation

🔁 **Token Swaps via Jupiter**
- Swap between any supported SPL tokens
- Integration with Jupiter aggregator for best prices
- Support for slippage configuration
- Real-time price data

📊 **Portfolio Management**
- View complete portfolio overview
- Check individual token balances
- Real-time portfolio valuation
- Track largest holdings

## Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd solana-sdk
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the project:**
   ```bash
   npm run build
   ```

4. **Configure environment (optional):**
   ```bash
   cp .env.example .env
   # Edit .env with your preferred settings
   ```

## Usage

### Interactive Mode (Recommended)

Start the interactive CLI:
```bash
npm run dev
# or
npm start
```

### Command Line Mode

You can also use specific commands directly:
```bash
npm run dev start
```

## Configuration

The tool uses the following default configuration:

- **Network**: Mainnet-beta
- **RPC URL**: `https://api.mainnet-beta.solana.com`
- **Slippage**: 3% (300 basis points)
- **Priority Fee**: 1000 lamports

To customize these settings, copy `.env.example` to `.env` and modify the values.

## Features Overview

### 1. Wallet Setup
- **Generate New Wallet**: Create a fresh Solana keypair
- **Load from Private Key**: Import wallet using private key array
- **Load from File**: Import wallet from saved JSON file

### 2. Portfolio Management
View comprehensive portfolio information including:
- SOL balance
- All SPL token balances
- Real-time USD values
- Total portfolio value

### 3. SOL Transfers
Send SOL to other addresses with features:
- Address validation
- Balance checking
- Optional memo support
- Transaction confirmation

### 4. SOL Wrapping
Convert between SOL and WSOL:
- **Wrap**: Convert SOL to WSOL for DeFi use
- **Unwrap**: Convert WSOL back to SOL
- Automatic associated token account management

### 5. Token Swaps
Swap between tokens using Jupiter:
- Support for major SPL tokens (USDC, USDT, RAY, SRM, etc.)
- Best price routing through Jupiter aggregator
- Configurable slippage protection
- Real-time price information

## Supported Tokens

The tool includes built-in support for major Solana tokens:
- **SOL/WSOL**: Native Solana token
- **USDC**: USD Coin
- **USDT**: Tether USD
- **RAY**: Raydium token
- **SRM**: Serum token

Additional tokens can be used by providing their mint address.

## Security Considerations

⚠️ **Important Security Notes:**

1. **Private Keys**: Never share your private keys or wallet files
2. **Mainnet vs Devnet**: Be aware of which network you're using
3. **Transaction Fees**: All transactions require SOL for gas fees
4. **Slippage**: High slippage can result in unfavorable trades
5. **Wallet Storage**: Store wallet files securely and make backups

## Development

### Project Structure

```
src/
├── config/           # Configuration settings
├── services/         # Core business logic
│   ├── jupiter.ts    # Jupiter swap integration
│   ├── portfolio.ts  # Portfolio management
│   ├── transfer.ts   # SOL transfers
│   └── wrapping.ts   # SOL wrapping/unwrapping
├── types/           # TypeScript type definitions
├── utils/           # Utility functions
│   ├── logger.ts    # Colored console logging
│   └── wallet.ts    # Wallet management utilities
└── index.ts         # Main CLI interface
```

### Available Scripts

- `npm run build`: Compile TypeScript to JavaScript
- `npm run dev`: Run in development mode with ts-node
- `npm start`: Run compiled JavaScript
- `npm run type-check`: Check TypeScript types without compilation

### Adding New Features

1. **Services**: Add new functionality in the `services/` directory
2. **Types**: Define interfaces in `types/index.ts`
3. **CLI**: Extend the main menu in `src/index.ts`
4. **Configuration**: Add settings to `src/config/index.ts`

## Troubleshooting

### Common Issues

1. **RPC Connection Errors**
   - Check your internet connection
   - Verify the RPC URL in configuration
   - Try switching to a different RPC endpoint

2. **Insufficient Balance**
   - Ensure you have enough SOL for transaction fees
   - Check token balances before swapping

3. **Transaction Failures**
   - Network congestion can cause timeouts
   - Increase priority fee for faster confirmation
   - Retry failed transactions

4. **Token Not Found**
   - Verify token symbol or mint address
   - Some tokens may not be available on Jupiter

### Getting Help

If you encounter issues:
1. Check the console output for detailed error messages
2. Verify your wallet has sufficient balance
3. Ensure you're connected to the correct network
4. Check Solana network status for any ongoing issues

## Disclaimer

This tool is for educational and development purposes. Always verify transactions on a testnet before using on mainnet. The developers are not responsible for any financial losses incurred through the use of this software.

## License

MIT License - see LICENSE file for details. 