const { ethers, network } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");

const BASE_FEE = ethers.parseEther("0.25"); // 0.25 is the flat fee. It cost 0.25 LINK.
const GAS_PRICE_LINK = 1e9; // 1 * 10 ** 9 = 1000000000 // LINK per gas. Calculated value based on the gas price of that blockchain.

module.exports = async function ({ getNamedAccounts, deployments }) {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  const args = [BASE_FEE, GAS_PRICE_LINK];

  if (developmentChains.includes(network.name)) {
    log("-----------------------Local network detected!-----------------------");
    log("--------------------------Deploying Mocks!--------------------------");
    await deploy("VRFCoordinatorV2Mock", {
      from: deployer,
      log: true,
      args: args,
    });
    log("--------------------------Mocks Deployed!--------------------------");
  }
};

module.exports.tags = ["all", "mocks"];
