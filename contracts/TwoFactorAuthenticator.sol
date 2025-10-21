// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TwoFactorAuthenticator
 * @dev Stores IPFS CIDs for encrypted 2FA bundles. All encryption is client-side.
 */
contract TwoFactorAuthenticator {
    struct UserData {
        string ipfsCID;        // IPFS Content Identifier pointing to encrypted bundle
        uint256 timestamp;     // Last update timestamp
        bool exists;           // Track if user has data
    }

    // Mapping from user address to their IPFS bundle CID
    mapping(address => UserData) private userData;

    // Events
    event UserDataUpdated(address indexed user, string ipfsCID, uint256 timestamp);
    event UserDataRemoved(address indexed user, uint256 timestamp);

    /**
     * @dev Set or update user's IPFS bundle CID
     */
    function setUserData(string memory _ipfsCID) public {
        require(bytes(_ipfsCID).length > 0, "IPFS CID cannot be empty");
        require(bytes(_ipfsCID).length >= 46, "Invalid IPFS CID format"); // Basic CID length check

        userData[msg.sender] = UserData({
            ipfsCID: _ipfsCID,
            timestamp: block.timestamp,
            exists: true
        });

        emit UserDataUpdated(msg.sender, _ipfsCID, block.timestamp);
    }

    /**
     * @dev Get user's IPFS bundle CID
     */
    function getUserCID() public view returns (string memory) {
        require(userData[msg.sender].exists, "No data found for user");
        return userData[msg.sender].ipfsCID;
    }

    /**
     * @dev Get user's data including timestamp
     */
    function getUserData() public view returns (UserData memory) {
        return userData[msg.sender];
    }

    /**
     * @dev Check if user has data stored
     */
    function hasData() public view returns (bool) {
        return userData[msg.sender].exists;
    }

    /**
     * @dev Get timestamp of last update
     */
    function getLastUpdated() public view returns (uint256) {
        require(userData[msg.sender].exists, "No data found for user");
        return userData[msg.sender].timestamp;
    }

    /**
     * @dev Remove user's data (marks as removed)
     */
    function removeUserData() public {
        require(userData[msg.sender].exists, "No data found for user");
        
        userData[msg.sender].exists = false;
        
        emit UserDataRemoved(msg.sender, block.timestamp);
    }

    /**
     * @dev Get user data for specific address (admin/debugging)
     */
    function getUserDataByAddress(address _user) public view returns (UserData memory) {
        return userData[_user];
    }
}

