require('dotenv').config();
const express = require('express');
const { ethers } = require('ethers');
const { EVM_PRESALE_ADDRESS, PRESALE_SEED } = require('./constants');
const cors = require('cors');

// 2025/03/20 Perseus patch_001
const anchor = require('@project-serum/anchor');
const { Connection, Keypair, PublicKey, SystemProgram } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, getAccount } = require('@solana/spl-token');
const fs = require('fs');
const { endianness } = require('os');
const PresaleAbi = require('./idl/BSC_ABI.json');
// patch_001 end

const OPERATOR = process.env.OPERATOR_KEY;
const app = express();
app.use(express.json());

const corsOpts = {
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
};

app.use(cors(corsOpts));

///////////////////////////////////// Ethereum Setup /////////////////////////////////////////////////
// Load environment variables
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || 'https://1rpc.io/sepolia';
const BSC_RPC_URL = process.env.BSC_RPC_URL || "wss://bsc-testnet-rpc.publicnode.com";
const ETH_CONTRACT_ADDRESS = process.env.ETH_CONTRACT_ADDRESS;
const BSC_CONTRACT_ADDRESS = process.env.BSC_CONTRACT_ADDRESS;
// Setup ethers.js provider & wallet
const bsc_provider = new ethers.JsonRpcProvider(BSC_RPC_URL);
const bsc_wallet = new ethers.Wallet(OPERATOR, bsc_provider);
const bsc_contract = new ethers.Contract(BSC_CONTRACT_ADDRESS, PresaleAbi, bsc_wallet);

const eth_provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
const eth_wallet = new ethers.Wallet(OPERATOR, eth_provider);
const eth_contract = new ethers.Contract(ETH_CONTRACT_ADDRESS, PresaleAbi, eth_wallet);

// Function to read `getClaimable()` from Ethereum contract
async function getClaimableAmount(evm_address) {
    try {

        console.log('Fetching claimable amounts for address:', evm_address);
        console.log('Contract Address:', ETH_CONTRACT_ADDRESS, BSC_CONTRACT_ADDRESS);

        // Execute both contract calls in parallel
        const [bscClaimable, ethClaimable] = await Promise.all([
            bsc_contract.getClaimableAmount(evm_address),
            eth_contract.getClaimableAmount(evm_address)
        ]);

        console.log('BSC Claimable Amount:', bscClaimable.toString());
        console.log('ETH Claimable Amount:', ethClaimable.toString());

        // Return both amounts in an object
        return {
            bsc: bscClaimable,
            eth: ethClaimable
        };
    } catch (error) {
        console.error('Error in getClaimableAmount:', {
            error: error.message,
            stack: error.stack,
            address: evm_address,
            timestamp: new Date().toISOString()
        });
        
        // Rethrow with more context
        throw new Error(`Failed to fetch claimable amounts: ${error.message}`);
    }
}

// Function to call claimSucceed
async function claimSucceed(userAddress, claimableAmounts) {
    try {
        // Check if there are no claimable tokens
        if (claimableAmounts.every(amount => amount === 0n)) {
            console.log('No claimable tokens for the given address.');
            return;
        }
        // Convert claimableAmounts to a mutable array
        const mutableClaimableAmounts = claimableAmounts.map(amount => amount);

        // Call the claimSucceed function
        const [bscResultClaim, ethResultClaim] = await Promise.all ([
            bsc_contract.claimSucceed(userAddress, mutableClaimableAmounts),
            eth_contract.claimSucceed(userAddress, mutableClaimableAmounts)
        ]);
        return {
            bsc: bscResultClaim,
            eth: ethResultClaim
        };
    } catch (error) {
        console.error(
            'Error in claimSucceed:',
            {
                error: error.message,
                stack: error.stack,
                userAddress: userAddress,
                timestamp: new Date().toISOString()
            }
        )
        throw new Error(`Failed to claim tokens: ${error.message}`);
    }
}


async function addStage(pricePerToken, nextPricePerToken, startTime, endTime) {
    try {
        console.log('add stage 1::', ETH_CONTRACT_ADDRESS, BSC_CONTRACT_ADDRESS)
        const [ethAddStage, bscAddStage] = await Promise.all([
            eth_contract.addStage(pricePerToken, nextPricePerToken, startTime, endTime),
            bsc_contract.addStage(pricePerToken, nextPricePerToken, startTime, endTime)
        ]);
        console.log('add stage 2::', ethAddStage);
        console.log('add stage 3::', bscAddStage);

        return {
            eth: ethAddStage,
            bsc: bscAddStage
        };
    } catch (error) {
        console.error('Error writing addStage:',
            {
                error: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString()
            }
        );
        throw error;
    }
}
async function pauseStage(stageId, isPaused) {
    try {
        const [ethPauseStage, bscPauseStage] = await Promise.all([
            eth_contract.pauseStage(stageId, isPaused),
            bsc_contract.pauseStage(stageId, isPaused)
        ]);
        console.log('claim st1::', tx.hash);
        return {
            eth: ethPauseStage,
            bsc: bscPauseStage
        };
    } catch (error) {
        console.error('Error writing pauseStage:',
            {
                error: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString()
            }
        );
        throw error;
    }
}

async function startClaim(time) {
    try {        
        const [ethStartClaim, bscStartClaim] = await Promise.all([
            eth_contract.startClaim(time),
            bsc_contract.startClaim(time)
        ])
        return {
            eth: ethStartClaim,
            bsc: bscStartClaim
        };
        } catch (error) {
        console.error('Error reading startClaim:', 
            {
                error: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString()
            }
        );
        throw error;
    }
}
///////////////////////////////////// Solana Setup /////////////////////////////////////////////////
// Load environment variables for Solana
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
//const SOLANA_PRIVATE_KEY = process.env.SOLANA_PRIVATE_KEY; // Your Solana wallet's private key
const SOLANA_PROGRAM_ID = new PublicKey(process.env.SOLANA_PROGRAM_ID); // Replace with your Solana program ID
const MINT_ACCOUNT = new PublicKey(process.env.MINT_ACCOUNT);
const PRESALET_PRESALE_TOKEN_ASSOCIATED_TOKEN_ACCOUNT = new PublicKey(process.env.PRESALET_PRESALE_TOKEN_ASSOCIATED_TOKEN_ACCOUNT);
const PRESALE_AUTHORITY = new PublicKey(process.env.PRESALE_AUTHORITY);
const RELAYER_KEY = process.env.RELAYER_KEY;
const PRESALE_INFO = process.env.PRESALE_INFO;

// Initialize Solana connection
const solanaConnection = new Connection(SOLANA_RPC_URL, 'confirmed');
const idl = require('./idl/monky_sale.json');
const bs58 = require('bs58');
const { start } = require('repl');
const { findProgramAddressSync } = require('@project-serum/anchor/dist/cjs/utils/pubkey');
const { all } = require('express/lib/application');
const { promises } = require('dns');
const relayerWallet = Keypair.fromSecretKey(bs58.decode(RELAYER_KEY));

// Load the IDL (replace with the path to your Solana program IDL)
// const idl = JSON.parse(fs.readFileSync('./idl/monky_sale.json', 'utf8'));

// Initialize the Anchor program
const solanaProvider = new anchor.AnchorProvider(solanaConnection, new anchor.Wallet(relayerWallet), {});
anchor.setProvider(solanaProvider);
const solanaProgram = new anchor.Program(idl, SOLANA_PROGRAM_ID, solanaProvider);

async function relayerTransferTokens(recipientAddress, quantity) {
    try {
        const RECIPIENT_PUBKEY = new PublicKey(recipientAddress);
    // Get the toAssociatedTokenAccount
        const adminBaseAta = getAssociatedTokenAddressSync(MINT_ACCOUNT, RECIPIENT_PUBKEY);
    // Get the presale Info
        const [presaleInfo] = await anchor.web3.PublicKey.findProgramAddressSync(
            [Buffer.from(PRESALE_SEED), PRESALE_AUTHORITY.toBuffer()],
            solanaProgram.programId
          );
          console.log('relayerTransferTokens presaleInfo::', presaleInfo.toBase58(), MINT_ACCOUNT, new PublicKey("DecGTmHCn7v7KVSJLe1XYFFxJLX4DQ5xYwtJkDKnEtc5"));
    // Get the presalePresaleTokenAssociatedTokenAccount
        const presalePresaleTokenAssociatedTokenAccount = getAssociatedTokenAddressSync(MINT_ACCOUNT, presaleInfo, true);
        console.log('relayerTransferTokens presalePresaleTokenAssociatedTokenAccount::', presalePresaleTokenAssociatedTokenAccount);
    // Check source token balance
        const sourceAccount = await getAccount(
            solanaConnection,
            presalePresaleTokenAssociatedTokenAccount
        );
        if (sourceAccount.amount < quantity) {
            throw new Error(`Insufficient funds. Required: ${quantity}, Available: ${sourceAccount.amount}`);
        }

        console.log('relayerTransferTokens presaleInfo::', presaleInfo);
        const accounts = {
            mintAccount: MINT_ACCOUNT,
            presalePresaleTokenAssociatedTokenAccount: presalePresaleTokenAssociatedTokenAccount,
            presaleInfo: presaleInfo,
            toAssociatedTokenAccount: adminBaseAta,
            recipient: RECIPIENT_PUBKEY,
            presaleAuthority: PRESALE_AUTHORITY,
            relayer: relayerWallet.publicKey,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            systemProgram: anchor.web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        };

        const tx = await solanaProgram.methods
            .relayerTransferTokens(new anchor.BN(quantity.toString()))
            .accounts(accounts)
            .signers([relayerWallet])
            .rpc();

        console.log('Transaction signature:', tx);
        return tx;
    } catch (error) {
        console.error('Error in relayerTransferTokens:', error.logs || error.message);
        throw error;
    }
}
///////////////////////////////////// API Endpoint /////////////////////////////////////////////////

// Create an Express Router for "/api/"
const apiRouter = express.Router();

// 📌 Write function (requires gas fee)

function isValidEthereumAddress(address) {
    return ethers.isAddress(address);
}

function isValidSolanaAddress(address) {
    try {
        new PublicKey(address);
        return true;
    } catch {
        return false;
    }
}

apiRouter.get('/', (req, res) => {
    res.send('Hello, World!');
  });

apiRouter.post('/claim', async (req, res) => {
    try {
        const { user_evm_address, user_sol_address } = req.body;

        if (!isValidEthereumAddress(user_evm_address)) {
            return res.status(400).json({ success: false, error: 'Invalid evm_address provided.' });
        } else if (!isValidSolanaAddress(user_sol_address)){
            return res.status(400).json({ success: false, error: 'Invalid sol_address provided.' });
        }

        console.log('post_claim user_evm_address::', user_evm_address);
        console.log('post_claim user_sol_address::', user_sol_address);


        // Step 1: Read `getClaimable()` from Ethereum contract
        const claimableAmounts = await getClaimableAmount(user_evm_address);

        console.log('post_claim claimableAmounts::', claimableAmounts);

        if (!Array.isArray(claimableAmounts)) {
            res.status(400).json({ success: false, error: 'Invalid data returned from the contract.' });
            return;
        }

        const totalClaimableAmount = claimableAmounts.reduce((acc, amount) => acc + BigInt(amount), 0n); 
        console.log('post_claim totalClaimableAmount::', totalClaimableAmount);

        // Step 2: Call `transfer_token()` in Solana program with the claimable amount
        const solanaTx = await relayerTransferTokens(user_sol_address, totalClaimableAmount * 1000000n);
        console.log('post_claim solanaTx_relayerTranferTokens', solanaTx);
    
        // Step 3: set User Claim Info on EVM contract
        if(solanaTx){

            const successTx = await claimSucceed(user_evm_address, claimableAmounts);
            await successTx.wait();
            // Return success reponse
            res.json({
                success: true,
                claimableAmounts: claimableAmounts.toString(),
                solanaTransactionHash: solanaTx,
                evmTransationHash: successTx,
            });
        } else {
            console.error('Error in claimSucceed:', error);
            res.status(500).json({ success: false, error: 'Solana transaction failed' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

apiRouter.post('/presale', async (req, res) => {
    try{
        const {stageNumber, pricePerToken, nextPricePerToken, startTime, endTime} = req.body;
        console.log('Received Presale info:', {
            stageId: stageNumber,
            current: pricePerToken,
            next: nextPricePerToken,
            start: startTime,
            end: endTime
          });
        
          const setPresaleSuccess = await addStage(pricePerToken, nextPricePerToken, startTime, endTime);
          await setPresaleSuccess.wait();

          if (stageNumber == 7) {
            const setStartClaim = await startClaim(endTime);
            await setStartClaim.wait();
          } else console.log('Set start claim time is failed.');
          // Process the data as needed (save to DB, etc.)
          
          res.json({ 
            success: true,
            evmTransationHash: setPresaleSuccess,
          });
    } catch (error){
        res.status(500).json({success: false, error:error.message});
    }
});

apiRouter.post('/pause', async (req, res) => {
    try{
        const {stageId, isPaused} = req.body;
        console.log('Received Presale info:', {
            stageId:stageId,
            isPaused: isPaused
          });
          const setPresalePause = await pauseStage(stageId, isPaused);
          // Process the data as needed (save to DB, etc.)
          res.json({ 
            success: true,
            evmTransationHash: setPresalePause,
          });
    } catch (error){
        res.status(500).json({success: false, error:error.message});
    }
});
// Use "/api/" as the base route
app.use('/api', apiRouter);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 API running at http://localhost:${PORT}/api`));
