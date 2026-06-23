// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "forge-std/Script.sol";
import "../src/Election3.sol";

contract DeployElection3 is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        // Initial Merkle Root (can be updated later by admin)
        bytes32 initialRoot = bytes32(0);

        vm.startBroadcast(deployerPrivateKey);

        Election3 election = new Election3(initialRoot);

        vm.stopBroadcast();

        console2.log("Election3 (Gas Optimized) deployed at:", address(election));
    }
}
