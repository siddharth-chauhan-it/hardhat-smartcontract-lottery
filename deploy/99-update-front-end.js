const fs = require("fs");
const { ethers, network } = require("hardhat");
const { FRONT_END_ABI_FILE, FRONT_END_ADDRESSES_FILE } = require("../helper-hardhat-config");

module.exports = async function () {
  if (process.env.UPDATE_FRONT_END) {
    console.log("---------------Updating Front End Variables!---------------");
    updateContractAddresses();
    updateAbi();
  }
};

async function updateContractAddresses() {
  const raffle = await ethers.getContract("Raffle");
  const raffleAddress = raffle.target;
  const chainId = network.config.chainId.toString();
  const contractAddresses = JSON.parse(fs.readFileSync(FRONT_END_ADDRESSES_FILE, "utf8"));

  if (chainId in contractAddresses) {
    if (!contractAddresses[chainId].includes(raffleAddress)) {
      contractAddresses[chainId] = raffleAddress;
    }
  } else {
    contractAddresses[chainId] = [raffleAddress];
  }

  fs.writeFileSync(FRONT_END_ADDRESSES_FILE, JSON.stringify(contractAddresses));
}

async function updateAbi() {
  const raffle = await ethers.getContract("Raffle");
  fs.writeFileSync(FRONT_END_ABI_FILE, raffle.interface.formatJson());
}
