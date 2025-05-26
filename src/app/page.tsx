'use client'

import { useState, useEffect } from 'react';
import { SigningClient } from "@interchainjs/cosmos/signing-client";
import { AminoGenericOfflineSigner, OfflineAminoSigner, OfflineDirectSigner, DirectGenericOfflineSigner } from "@interchainjs/cosmos/types/wallet";
import { MsgSend } from 'interchainjs/cosmos/bank/v1beta1/tx'
import { send } from "interchainjs/cosmos/bank/v1beta1/tx.rpc.func"

// Keplr wallet interface
interface KeplrWallet {
  enable(chainId: string): Promise<void>;
  getOfflineSignerOnlyAmino(chainId: string): OfflineAminoSigner;
  getOfflineSigner(chainId: string): OfflineDirectSigner;
}

// Balance response interface
interface BalanceResponse {
  balances?: Array<{
    denom: string;
    amount: string;
  }>;
}

// Extend Window interface to include keplr
declare global {
  interface Window {
    keplr?: KeplrWallet;
  }
}

interface TransferForm {
  toAddress: string;
  amount: string;
  memo: string;
}

export default function Home() {
  const [isKeplrConnected, setIsKeplrConnected] = useState(false);
  const [userAddress, setUserAddress] = useState<string>('');
  const [balance, setBalance] = useState<string>('0');
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState<string>('');
  const [error, setError] = useState<string>('');
  
  const [form, setForm] = useState<TransferForm>({
    toAddress: '',
    amount: '',
    memo: ''
  });

  const chainId = "cosmoshub-4";
  const rpcEndpoint = "https://cosmos-rpc.polkachu.com";

  // Check if Keplr is installed
  useEffect(() => {
    const checkKeplr = async () => {
      if (window.keplr) {
        try {
          await window.keplr.enable(chainId);
          const offlineSigner = window.keplr.getOfflineSignerOnlyAmino(chainId);
          const accounts = await offlineSigner.getAccounts();
          if (accounts.length > 0) {
            setUserAddress(accounts[0].address);
            setIsKeplrConnected(true);
            await fetchBalance(accounts[0].address);
          }
        } catch (error) {
          console.error('Failed to connect to Keplr:', error);
        }
      }
    };

    // Delay check to ensure page is loaded
    setTimeout(checkKeplr, 1000);
  }, []);

  // Connect Keplr wallet
  const connectKeplr = async () => {
    if (!window.keplr) {
      alert('Please install the Keplr wallet extension first!');
      return;
    }

    try {
      setIsLoading(true);
      await window.keplr.enable(chainId);
      
      const offlineSigner = window.keplr.getOfflineSignerOnlyAmino(chainId);
      const accounts = await offlineSigner.getAccounts();
      
      if (accounts.length > 0) {
        setUserAddress(accounts[0].address);
        setIsKeplrConnected(true);
        await fetchBalance(accounts[0].address);
        setError('');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(`Connection failed: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch balance
  const fetchBalance = async (address: string) => {
    try {
      const response = await fetch(`https://cosmos-rest.publicnode.com/cosmos/bank/v1beta1/balances/${address}`);
      const data: BalanceResponse = await response.json();
      
      const atomBalance = data.balances?.find((coin) => coin.denom === 'uatom');
      if (atomBalance) {
        const atomAmount = (parseInt(atomBalance.amount) / 1000000).toFixed(6);
        setBalance(atomAmount);
      } else {
        setBalance('0');
      }
    } catch (error) {
      console.error('Failed to fetch balance:', error);
      setBalance('0');
    }
  };

  // Transfer ATOM
  const transferATOM = async () => {
    if (!window.keplr || !isKeplrConnected) {
      setError('Please connect Keplr wallet first');
      return;
    }

    if (!form.toAddress || !form.amount) {
      setError('Please enter recipient address and amount');
      return;
    }

    if (parseFloat(form.amount) <= 0) {
      setError('Amount must be greater than 0');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      setTxHash('');

      // Get Keplr offline signer
      // const keplrOfflineSigner = window.keplr.getOfflineSignerOnlyAmino(chainId);
      // const offlineSigner = new AminoGenericOfflineSigner(keplrOfflineSigner);
      const keplrOfflineSigner = window.keplr.getOfflineSigner(chainId);
      const offlineSigner = new DirectGenericOfflineSigner(keplrOfflineSigner);

      // Create signing client
      const signingClient = await SigningClient.connectWithSigner(
        rpcEndpoint,
        offlineSigner,
        {
          broadcast: {
            checkTx: true,
            deliverTx: true
          }
        }
      );
      signingClient.addEncoders([MsgSend])
      signingClient.addConverters([MsgSend])

      // Get account info
      const accounts = await offlineSigner.getAccounts();
      const senderAddress = accounts[0].address;

      // Build transfer message
      const amount = [{
        denom: "uatom",
        amount: (parseFloat(form.amount) * 1000000).toString() // Convert to uatom
      }]
      const transferMsg = {
        typeUrl: "/cosmos.bank.v1beta1.MsgSend",
        value: {
          fromAddress: senderAddress,
          toAddress: form.toAddress,
          amount
        }
      };

      // Set fee
      const fee = {
        amount: [{
          denom: "uatom",
          amount: "5000" // 0.005 ATOM fee
        }],
        gas: "200000"
      };

      // Sign and broadcast transaction
      const result = await signingClient.signAndBroadcast(
        senderAddress,
        [transferMsg],
        fee,
        form.memo || "Transfer ATOM via InterchainJS"
      );

      // or use the send function
      // const result = await send(
      //   signingClient,
      //   senderAddress,
      //   { fromAddress: senderAddress, toAddress: form.toAddress, amount },
      //   fee,
      //   form.memo || "Transfer ATOM via InterchainJS"
      // );

      setTxHash(result.transactionHash);
      
      // Refresh balance
      await fetchBalance(senderAddress);
      
      // Clear form
      setForm({ toAddress: '', amount: '', memo: '' });
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Transfer failed:', error);
      setError(`Transfer failed: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '600px',
        margin: '0 auto',
        backgroundColor: 'white',
        borderRadius: '20px',
        padding: '40px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{
          textAlign: 'center',
          color: '#333',
          marginBottom: '30px',
          fontSize: '2.5rem',
          fontWeight: 'bold'
        }}>
          🚀 ATOM Transfer Tool
        </h1>

        {!isKeplrConnected ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ marginBottom: '20px', color: '#666', fontSize: '1.1rem' }}>
              Transfer ATOM tokens using Keplr wallet
            </p>
            <button
              onClick={connectKeplr}
              disabled={isLoading}
              style={{
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                padding: '15px 30px',
                fontSize: '1.1rem',
                borderRadius: '10px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.7 : 1,
                transition: 'all 0.3s ease'
              }}
            >
              {isLoading ? 'Connecting...' : 'Connect Keplr Wallet'}
            </button>
          </div>
        ) : (
          <div>
            {/* Account Info */}
            <div style={{
              backgroundColor: '#f8f9fa',
              padding: '20px',
              borderRadius: '10px',
              marginBottom: '30px'
            }}>
              <h3 style={{ color: '#333', marginBottom: '10px' }}>Account Info</h3>
              <p style={{ color: '#666', wordBreak: 'break-all', marginBottom: '10px' }}>
                <strong>Address:</strong> {userAddress}
              </p>
              <p style={{ color: '#666', fontSize: '1.2rem' }}>
                <strong>Balance:</strong> {balance} ATOM
              </p>
            </div>

            {/* Transfer Form */}
            <div style={{ marginBottom: '30px' }}>
              <h3 style={{ color: '#333', marginBottom: '20px' }}>Transfer Info</h3>
              
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#333', fontWeight: 'bold' }}>
                  Recipient Address:
                </label>
                <input
                  type="text"
                  value={form.toAddress}
                  onChange={(e) => setForm({ ...form, toAddress: e.target.value })}
                  placeholder="cosmos1..."
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #ddd',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    boxSizing: 'border-box',
                    color: 'rgb(30, 32, 34)'
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#333', fontWeight: 'bold' }}>
                  Amount (ATOM):
                </label>
                <input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0.000000"
                  step="0.000001"
                  min="0"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #ddd',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    boxSizing: 'border-box',
                    color: 'rgb(30, 32, 34)'
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#333', fontWeight: 'bold' }}>
                  Memo (optional):
                </label>
                <input
                  type="text"
                  value={form.memo}
                  onChange={(e) => setForm({ ...form, memo: e.target.value })}
                  placeholder="Memo for transfer..."
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #ddd',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    boxSizing: 'border-box',
                    color: 'rgb(30, 32, 34)'
                  }}
                />
              </div>

              <button
                onClick={transferATOM}
                disabled={isLoading}
                style={{
                  width: '100%',
                  backgroundColor: '#2196F3',
                  color: 'white',
                  border: 'none',
                  padding: '15px',
                  fontSize: '1.1rem',
                  borderRadius: '10px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  opacity: isLoading ? 0.7 : 1,
                  transition: 'all 0.3s ease'
                }}
              >
                {isLoading ? 'Transferring...' : 'Send ATOM'}
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div style={{
                backgroundColor: '#ffebee',
                color: '#c62828',
                padding: '15px',
                borderRadius: '8px',
                marginBottom: '20px',
                border: '1px solid #ffcdd2'
              }}>
                {error}
              </div>
            )}

            {/* Success Message */}
            {txHash && (
              <div style={{
                backgroundColor: '#e8f5e8',
                color: '#2e7d32',
                padding: '15px',
                borderRadius: '8px',
                marginBottom: '20px',
                border: '1px solid #c8e6c9'
              }}>
                <p style={{ marginBottom: '10px' }}>✅ Transfer successful!</p>
                <p style={{ wordBreak: 'break-all' }}>
                  <strong>Transaction Hash:</strong> {txHash}
                </p>
                <p style={{ marginTop: '10px' }}>
                  <a 
                    href={`https://www.mintscan.io/cosmos/txs/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#1976d2', textDecoration: 'underline' }}
                  >
                    View on block explorer
                  </a>
                </p>
              </div>
            )}

            {/* Refresh Balance Button */}
            <button
              onClick={() => fetchBalance(userAddress)}
              style={{
                backgroundColor: '#9C27B0',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                fontSize: '0.9rem',
                borderRadius: '8px',
                cursor: 'pointer',
                marginTop: '10px'
              }}
            >
              🔄 Refresh Balance
            </button>
          </div>
        )}

        {/* Footer Info */}
        <div style={{
          marginTop: '40px',
          textAlign: 'center',
          color: '#999',
          fontSize: '0.9rem'
        }}>
          <p>Built with InterchainJS</p>
          <p>Please make sure Keplr wallet extension is installed</p>
        </div>
      </div>
    </div>
  );
}