const { assert, expect } = require("chai");
const { describe, beforeEach } = require("mocha");
const { network, getNamedAccounts, ethers } = require("hardhat");
const { developmentChains } = require("../../helper-hardhat-config");

developmentChains.includes(network.name)
  ? describe.skip
  : describe("Raffle Staging Tests", function () {
      let raffle, raffleEntranceFee, deployer;

      beforeEach(async function () {
        deployer = (await getNamedAccounts()).deployer;
        raffle = await ethers.getContract("Raffle", deployer);
        raffleEntranceFee = await raffle.getEntranceFee();
      });

      describe("fulfillRandomWords", function () {
        it("Works with live Chainlink Keepers and Chainlink VRF, we get a random winner", async function () {
          console.log("Setting up test...");
          // Get timestamp before entering the raffle.
          const startingTimeStamp = await raffle.getLastTimeStamp();
          const accounts = await ethers.getSigners();

          console.log("Setting up listener...");
          await new Promise(async (resolve, reject) => {
            // Setup the listener before entering the raffle.
            raffle.once("WinnerPicked", async () => {
              console.log("WinnerPicked event fired!");
              try {
                // Add our asserts here
                const recentWinner = await raffle.getRecentWinner();
                console.log(`recentWinner: ${recentWinner}`);
                const raffleState = await raffle.getRaffleState();
                console.log(`raffleState: ${raffleState}`);
                const winnerEndingBalance = await ethers.provider.getBalance(accounts[0].address);
                console.log(`winnerEndingBalance: ${winnerEndingBalance}`);
                const endingTimeStamp = await raffle.getLastTimeStamp();
                console.log(`endingTimeStamp: ${endingTimeStamp}`);
                const numPlayers = await raffle.getNumberOfPlayers();
                console.log(`numPlayers: ${numPlayers}`);

                await expect(raffle.getPlayer(0)).to.be.reverted; // No address should exist at zeroth index
                console.log("Assertion 1 done");
                assert.equal(recentWinner.toString(), accounts[0].address); // Winner should be deployer => accounts[0]
                console.log("Assertion 2 done");
                assert.equal(raffleState, 0); // Raffle state resets to OPEN
                console.log("Assertion 3 done");
                assert.equal(winnerEndingBalance, winnerStartingBalance + raffleEntranceFee); // Only 1 player entered
                console.log("Assertion 4 done");
                assert(endingTimeStamp > startingTimeStamp);
                console.log("Assertion 5 done");

                console.log("All Assertion done!");

                // Resolve after assertion
                resolve();
              } catch (error) {
                console.log(error);
                reject(error);
              }
              resolve();
            });
            console.log("Entering Raffle...");
            // Enter the raffle
            const tx = await raffle.enterRaffle({ value: raffleEntranceFee });
            await tx.wait(1); // Wait for 1 block confirmation before getting starting balance
            console.log("Ok, time to wait...");
            const winnerStartingBalance = await ethers.provider.getBalance(accounts[0].address);

            // And this code WON'T complete until our listener has finished listening!!!
          });
        });
      });
    });
