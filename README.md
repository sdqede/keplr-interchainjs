## Getting Started

First, run the development server:

```bash
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Using InterchanJS in the Frontend
```sh
npm install interchainjs @interchainjs/cosmos @interchainjs/math @chain-registry/v2
```
```ts
import { SigningClient } from "@interchainjs/cosmos/signing-client";
import { AminoGenericOfflineSigner, OfflineAminoSigner, OfflineDirectSigner, DirectGenericOfflineSigner } from "@interchainjs/cosmos/types/wallet";
import { MsgSend } from 'interchainjs/cosmos/bank/v1beta1/tx'
import { send } from "interchainjs/cosmos/bank/v1beta1/tx.rpc.func";

// Get Keplr offline signer
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

console.log(result.transactionHash);
```
Refer to [src/app/page.tsx](src/app/page.tsx) for an example