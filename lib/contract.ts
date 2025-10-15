// Contract ABI for TwoFactorAuthenticator
export const AUTHENTICATOR_ABI = [
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "accountName",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "timestamp",
        "type": "uint256"
      }
    ],
    "name": "SecretAdded",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "index",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "timestamp",
        "type": "uint256"
      }
    ],
    "name": "SecretRemoved",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "index",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "timestamp",
        "type": "uint256"
      }
    ],
    "name": "SecretUpdated",
    "type": "event"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "_accountName",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "_encryptedSecret",
        "type": "string"
      }
    ],
    "name": "addSecret",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getSecretCount",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getSecrets",
    "outputs": [
      {
        "components": [
          {
            "internalType": "string",
            "name": "accountName",
            "type": "string"
          },
          {
            "internalType": "string",
            "name": "encryptedSecret",
            "type": "string"
          },
          {
            "internalType": "uint256",
            "name": "timestamp",
            "type": "uint256"
          }
        ],
        "internalType": "struct TwoFactorAuthenticator.Account[]",
        "name": "",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_index",
        "type": "uint256"
      }
    ],
    "name": "removeSecret",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_index",
        "type": "uint256"
      },
      {
        "internalType": "string",
        "name": "_accountName",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "_encryptedSecret",
        "type": "string"
      }
    ],
    "name": "updateSecret",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;


export const AUTHENTICATOR_CONTRACT_ADDRESS = 
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0xA5D0BB0D13D23c09b1aB7075708296C3FA290e08";

export interface Account {
  accountName: string;
  encryptedSecret: string;
  timestamp: bigint;
}

