const { ethers } = require("hardhat");

const networkConfig = {
  11155111: {
    name: "sepolia",
    vrfCoordinatorV2: "0x8103B0A8A00be2DDC778e6e7eaa21791Cd364625",
    entranceFee: ethers.parseEther("0.01"),
    gasLane: "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c",
    subscriptionId: "8880", // ChainLink VRF subscription ID
    callbackGasLimit: "500000", // 500,000 Gwei || Max is 2,500,000 Gwei for Sepolia
    interval: "30", // 30 seconds
  },
  31337: {
    name: "hardhat",
    entranceFee: ethers.parseEther("0.01"),
    gasLane: "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c",
    callbackGasLimit: "500000", // 500,000
    interval: "30", // 30 seconds
  },
};

const developmentChains = ["hardhat", "localhost"];

const FRONT_END_ADDRESSES_FILE =
  "../nextjs-smartcontract-lottery/src/constants/contractAddresses.json";
const FRONT_END_ABI_FILE = "../nextjs-smartcontract-lottery/src/constants/abi.json";

module.exports = {
  networkConfig,
  developmentChains,
  FRONT_END_ADDRESSES_FILE,
  FRONT_END_ABI_FILE,
};
