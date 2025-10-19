// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TwoFactorAuthenticator
 * @dev A smart contract to store IPFS CIDs pointing to encrypted 2FA secrets
 * @notice This contract stores only IPFS CIDs. All encryption is done client-side before IPFS upload.
 * Sensitive data never touches the blockchain directly, only immutable content references.
 */
contract TwoFactorAuthenticator {
    struct Account {
        string accountName;
        string ipfsCID;        // IPFS Content Identifier pointing to encrypted data
        uint256 timestamp;
    }

    // Mapping from user address to their array of 2FA accounts
    mapping(address => Account[]) private userAccounts;

    // Events
    event SecretAdded(address indexed user, string accountName, string ipfsCID, uint256 timestamp);
    event SecretRemoved(address indexed user, uint256 index, uint256 timestamp);
    event SecretUpdated(address indexed user, uint256 index, string ipfsCID, uint256 timestamp);

    /**
     * @dev Add a new 2FA account with IPFS CID reference
     * @param _accountName The name of the account (e.g., "Google", "GitHub")
     * @param _ipfsCID The IPFS Content Identifier pointing to encrypted data
     */
    function addSecret(string memory _accountName, string memory _ipfsCID) public {
        require(bytes(_accountName).length > 0, "Account name cannot be empty");
        require(bytes(_ipfsCID).length > 0, "IPFS CID cannot be empty");
        require(bytes(_ipfsCID).length >= 46, "Invalid IPFS CID format"); // Basic CID length check

        userAccounts[msg.sender].push(Account({
            accountName: _accountName,
            ipfsCID: _ipfsCID,
            timestamp: block.timestamp
        }));

        emit SecretAdded(msg.sender, _accountName, _ipfsCID, block.timestamp);
    }

    /**
     * @dev Retrieve all encrypted secrets for the calling user
     * @return Array of Account structs containing all user's 2FA accounts
     */
    function getSecrets() public view returns (Account[] memory) {
        return userAccounts[msg.sender];
    }

    /**
     * @dev Get the count of 2FA accounts for the calling user
     * @return The number of accounts stored
     */
    function getSecretCount() public view returns (uint256) {
        return userAccounts[msg.sender].length;
    }

    /**
     * @dev Remove a 2FA account at a specific index
     * @param _index The index of the account to remove
     */
    function removeSecret(uint256 _index) public {
        require(_index < userAccounts[msg.sender].length, "Index out of bounds");

        // Move the last element to the deleted position and pop
        uint256 lastIndex = userAccounts[msg.sender].length - 1;
        if (_index != lastIndex) {
            userAccounts[msg.sender][_index] = userAccounts[msg.sender][lastIndex];
        }
        userAccounts[msg.sender].pop();

        emit SecretRemoved(msg.sender, _index, block.timestamp);
    }

    /**
     * @dev Update an existing 2FA account's IPFS CID
     * @param _index The index of the account to update
     * @param _accountName The new account name
     * @param _ipfsCID The new IPFS Content Identifier
     */
    function updateSecret(uint256 _index, string memory _accountName, string memory _ipfsCID) public {
        require(_index < userAccounts[msg.sender].length, "Index out of bounds");
        require(bytes(_accountName).length > 0, "Account name cannot be empty");
        require(bytes(_ipfsCID).length > 0, "IPFS CID cannot be empty");
        require(bytes(_ipfsCID).length >= 46, "Invalid IPFS CID format");

        userAccounts[msg.sender][_index] = Account({
            accountName: _accountName,
            ipfsCID: _ipfsCID,
            timestamp: block.timestamp
        });

        emit SecretUpdated(msg.sender, _index, _ipfsCID, block.timestamp);
    }
    
    /**
     * @dev Get a specific account's details by index
     * @param _index The index of the account to retrieve
     * @return Account struct containing account name, IPFS CID, and timestamp
     */
    function getAccount(uint256 _index) public view returns (Account memory) {
        require(_index < userAccounts[msg.sender].length, "Index out of bounds");
        return userAccounts[msg.sender][_index];
    }
    
    /**
     * @dev Get IPFS CID for a specific account
     * @param _index The index of the account
     * @return The IPFS CID string
     */
    function getIPFSCID(uint256 _index) public view returns (string memory) {
        require(_index < userAccounts[msg.sender].length, "Index out of bounds");
        return userAccounts[msg.sender][_index].ipfsCID;
    }
}

