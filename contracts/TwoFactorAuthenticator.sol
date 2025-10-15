// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TwoFactorAuthenticator
 * @dev A smart contract to store encrypted 2FA secrets on-chain
 * @notice This contract stores encrypted secrets. Encryption must be done client-side before storing.
 */
contract TwoFactorAuthenticator {
    struct Account {
        string accountName;
        string encryptedSecret;
        uint256 timestamp;
    }

    // Mapping from user address to their array of 2FA accounts
    mapping(address => Account[]) private userAccounts;

    // Events
    event SecretAdded(address indexed user, string accountName, uint256 timestamp);
    event SecretRemoved(address indexed user, uint256 index, uint256 timestamp);
    event SecretUpdated(address indexed user, uint256 index, uint256 timestamp);

    /**
     * @dev Add a new encrypted 2FA secret for the calling user
     * @param _accountName The name of the account (e.g., "Google", "GitHub")
     * @param _encryptedSecret The encrypted secret key
     */
    function addSecret(string memory _accountName, string memory _encryptedSecret) public {
        require(bytes(_accountName).length > 0, "Account name cannot be empty");
        require(bytes(_encryptedSecret).length > 0, "Encrypted secret cannot be empty");

        userAccounts[msg.sender].push(Account({
            accountName: _accountName,
            encryptedSecret: _encryptedSecret,
            timestamp: block.timestamp
        }));

        emit SecretAdded(msg.sender, _accountName, block.timestamp);
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
     * @dev Update an existing 2FA account's encrypted secret
     * @param _index The index of the account to update
     * @param _accountName The new account name
     * @param _encryptedSecret The new encrypted secret
     */
    function updateSecret(uint256 _index, string memory _accountName, string memory _encryptedSecret) public {
        require(_index < userAccounts[msg.sender].length, "Index out of bounds");
        require(bytes(_accountName).length > 0, "Account name cannot be empty");
        require(bytes(_encryptedSecret).length > 0, "Encrypted secret cannot be empty");

        userAccounts[msg.sender][_index] = Account({
            accountName: _accountName,
            encryptedSecret: _encryptedSecret,
            timestamp: block.timestamp
        });

        emit SecretUpdated(msg.sender, _index, block.timestamp);
    }
}

