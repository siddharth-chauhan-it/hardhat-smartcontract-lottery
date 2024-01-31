const { ethers, network } = require("hardhat");

async function mockKeepers() {
  // const deployer = (await getNamedAccounts()).deployer;

  const raffle = await ethers.getContract("Raffle");
  // const raffle = await ethers.getContractAt("Raffle", "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9");
  // console.log("raffle.target:");
  // console.log(raffle.target);
  // const checkData = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(""));
  const checkData = ethers.keccak256(ethers.toUtf8Bytes(""));
  // const { upkeepNeeded } = await raffle.callStatic.checkUpkeep(checkData);
  // const { upkeepNeeded } = await raffle.checkUpkeep.staticCall("0x");
  const { upkeepNeeded } = await raffle.checkUpkeep.staticCall(checkData);
  // const { upkeepNeeded } = await raffle.checkUpkeep.staticCall(checkData);
  // const { upkeepNeeded } = await raffle.checkUpkeep.staticCall(
  //   "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470",
  // );
  // const { upkeepNeeded } = await raffle.checkUpkeep.staticCall("0x");
  if (upkeepNeeded) {
    const tx = await raffle.performUpkeep(checkData);
    const txReceipt = await tx.wait(1);
    const requestId = txReceipt.logs[1].args.requestId;
    console.log(`Performed upkeep with RequestId: ${requestId}`);
    if (network.config.chainId == 31337) {
      await mockVrf(requestId, raffle);
    }
  } else {
    console.log("No upkeep needed!");
  }
}

async function mockVrf(requestId, raffle) {
  console.log("We on a local network? Ok let's pretend...");
  const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock");
  await vrfCoordinatorV2Mock.fulfillRandomWords(requestId, raffle.target);
  console.log("Responded!");
  const recentWinner = await raffle.getRecentWinner();
  console.log(`The winner is: ${recentWinner}`);
}

mockKeepers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
