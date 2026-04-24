export const factoryAbi =
[
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "vault",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "asset",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "initialOwner",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "name",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "symbol",
        "type": "string"
      }
    ],
    "name": "ConfidentialERC7540Created",
    "type": "event"
  },
  {
    "inputs": [
      {
        "internalType": "contract IERC7984",
        "name": "asset",
        "type": "address"
      },
      {
        "internalType": "string",
        "name": "name",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "symbol",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "contractURI",
        "type": "string"
      },
      {
        "internalType": "address",
        "name": "initialOwner",
        "type": "address"
      },
      {
        "internalType": "bytes32",
        "name": "salt",
        "type": "bytes32"
      }
    ],
    "name": "createVault",
    "outputs": [
      {
        "internalType": "address",
        "name": "vault",
        "type": "address"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "contract IERC7984",
        "name": "asset",
        "type": "address"
      },
      {
        "internalType": "string",
        "name": "name",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "symbol",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "contractURI",
        "type": "string"
      },
      {
        "internalType": "address",
        "name": "initialOwner",
        "type": "address"
      },
      {
        "internalType": "bytes32",
        "name": "salt",
        "type": "bytes32"
      }
    ],
    "name": "predictVaultAddress",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;
