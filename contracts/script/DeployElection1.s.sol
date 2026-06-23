// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "forge-std/Script.sol";
import "../src/Election1.sol";

contract DeployElection1 is Script {

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        Election1 election = new Election1();

        vm.stopBroadcast();

        console2.log("Election1 deployed at:", address(election));
    }
}
