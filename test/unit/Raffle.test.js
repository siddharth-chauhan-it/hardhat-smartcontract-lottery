const { assert, expect } = require("chai");
const { describe, beforeEach } = require("mocha");
const { network, getNamedAccounts, deployments, ethers } = require("hardhat");
const { developmentChains, networkConfig } = require("../../helper-hardhat-config");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Raffle Unit Tests", function () {
      let raffle, vrfCoordinatorV2Mock, raffleEntranceFee, deployer, interval;
      const chainId = network.config.chainId;

      beforeEach(async function () {
        deployer = (await getNamedAccounts()).deployer;
        await deployments.fixture("all"); // Deploy contracts with tags "all"
        raffle = await ethers.getContract("Raffle", deployer);
        vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer);
        raffleEntranceFee = await raffle.getEntranceFee();
        interval = await raffle.getInterval();
      });

      describe("constructor", function () {
        it("Initializes the raffle correctly", async function () {
          const raffleState = await raffle.getRaffleState();
          assert.equal(raffleState.toString(), "0"); // Raffle State is OPEN => uint256 0 = OPEN
          assert.equal(interval.toString(), networkConfig[chainId]["interval"]);
        });
      });

      describe("enterRaffle", function () {
        it("Reverts when you don't pay enough", async function () {
          await expect(raffle.enterRaffle()).to.be.revertedWithCustomError(
            raffle,
            "Raffle__NotEnoughETHEntered",
          );
        });

        it("Records players when they enter", async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          const playerFromContract = await raffle.getPlayer(0);
          assert.equal(playerFromContract, deployer);
        });

        it("Emits event on enter", async function () {
          await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.emit(
            raffle,
            "RaffleEnter",
          );
        });

        it("Doesn't allow entrance when raffle is calculating", async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
          await network.provider.send("evm_mine", []);
          await raffle.performUpkeep("0x"); // We pretend to be a Chainlink Keeper and call 'performUpkeep' by ourselves.
          await expect(
            raffle.enterRaffle({ value: raffleEntranceFee }),
          ).to.be.revertedWithCustomError(raffle, "Raffle__NotOpen");
        });
      });

      describe("checkUpKeep", function () {
        it("Returns false if people haven't sent any ETH", async function () {
          await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
          await network.provider.send("evm_mine", []);
          const { upkeepNeeded } = await raffle.checkUpkeep.staticCall("0x");
          assert(!upkeepNeeded);
        });

        it("Returns false if Raffle isn't open", async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
          await network.provider.send("evm_mine", []);
          await raffle.performUpkeep("0x");
          const raffleState = await raffle.getRaffleState();
          const { upkeepNeeded } = await raffle.checkUpkeep.staticCall("0x");
          assert.equal(raffleState.toString(), "1"); // // Raffle State is CALCULATING => uint256 0 = CALCULATING
          assert.equal(upkeepNeeded, false);
        });

        it("Returns false if enough time hasn't passed", async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [Number(interval) - 5]);
          await network.provider.send("evm_mine", []);
          const { upkeepNeeded } = await raffle.checkUpkeep.staticCall("0x");
          assert(!upkeepNeeded);
        });

        it("Returns true if enough time has passed, has players, has eth, and is open", async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
          await network.provider.send("evm_mine", []);
          const { upkeepNeeded } = await raffle.checkUpkeep.staticCall("0x");
          assert(upkeepNeeded);
        });
      });

      describe("performUpkeep", function () {
        it("Can only run if checkUpkeep is true", async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
          await network.provider.send("evm_mine", []);
          const tx = await raffle.performUpkeep("0x");
          assert(tx);
        });

        it("Reverts when checkUpkeep is false", async function () {
          await expect(raffle.performUpkeep("0x")).to.be.revertedWithCustomError(
            raffle,
            "Raffle__UpkeepNotNeeded",
          );
        });

        it("Updates the raffle state, emits an event, and calls the vrfCoordinator", async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
          await network.provider.send("evm_mine", []);
          const txResponse = await raffle.performUpkeep("0x");
          const txReceipt = await txResponse.wait(1);
          const requestId = txReceipt.logs[1].args.requestId;
          const raffleState = await raffle.getRaffleState();
          assert(Number(requestId) > 0);
          assert(Number(raffleState) === 1);
        });

        describe("fulfillRandomWords", function () {
          beforeEach(async function () {
            await raffle.enterRaffle({ value: raffleEntranceFee });
            await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
            await network.provider.send("evm_mine", []);
          });

          it("Can only be called after performUpkeep", async function () {
            await expect(
              vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.target),
            ).to.be.revertedWith("nonexistent request");
            await expect(
              vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.target),
            ).to.be.revertedWith("nonexistent request");
          });

          // Big Test
          // This test simulates users entering the raffle and wraps the entire functionality of the
          // raffle inside a promise that will resolve if everything is successful.
          // An event listener for the `WinnerPicked` is set up
          // Mocks of chainlink keepers and vrf coordinator are used to kickoff this `WinnerPicked` event
          // All the assertions are done once the WinnerPicked event is fired
          it("Picks a winner, resets the lottery, and sends money", async function () {
            const accounts = await ethers.getSigners();
            let winnerStartingBalance, winnerEndingBalance;
            const additionalEntrants = 3;
            const startingAccountIndex = 1; // Deployer = 0
            for (let i = startingAccountIndex; i < startingAccountIndex + additionalEntrants; i++) {
              const accountConnectedRaffle = raffle.connect(accounts[i]);
              await accountConnectedRaffle.enterRaffle({ value: raffleEntranceFee });
            }
            const startingTimeStamp = await raffle.getLastTimeStamp(); // Initial TimeStamp for this test

            // performUpkeep (mock being Chainlink Keepers)
            // fulfillRandomWords (mock being Chainlink VRF)
            // We will have to wait for the fulfillRandomWords to be called
            await new Promise(async (resolve, reject) => {
              // 1. Setting up the listener.
              raffle.once("WinnerPicked", async () => {
                // console.log("WinnerPicked event fired!");
                try {
                  const recentWinner = await raffle.getRecentWinner();
                  // console.log(`Recent Winner: ${recentWinner}`);
                  // console.log(accounts[0].address);
                  // console.log(accounts[1].address);
                  // console.log(accounts[2].address);
                  // console.log(accounts[3].address);
                  const raffleState = await raffle.getRaffleState();
                  const endingTimeStamp = await raffle.getLastTimeStamp();
                  const numPlayers = await raffle.getNumberOfPlayers();
                  winnerEndingBalance = await ethers.provider.getBalance(accounts[1].address);

                  assert.equal(Number(numPlayers), 0); // Players array resets to 0
                  assert.equal(Number(raffleState), 0); // Raffle state resets to OPEN
                  assert(endingTimeStamp > startingTimeStamp);

                  assert.equal(
                    Number(winnerEndingBalance),
                    Number(
                      Number(winnerStartingBalance) +
                        Number(raffleEntranceFee) * additionalEntrants +
                        Number(raffleEntranceFee),
                    ),
                  );
                } catch (e) {
                  reject(e);
                }
                resolve();
              });
              // 2. Below, we will fire the event, and the above listener will pick it up and resolve.
              // Kicking off the event by mocking the chainlink keepers and vrf coordinator
              const tx = await raffle.performUpkeep("0x");
              const txReceipt = await tx.wait(1);
              const requestId = txReceipt.logs[1].args.requestId;
              winnerStartingBalance = await ethers.provider.getBalance(accounts[1].address);
              await vrfCoordinatorV2Mock.fulfillRandomWords(requestId, raffle.target);
            });
          });
        });
      });
    });
