import { StacksMainnet } from "@stacks/network";
import { AnchorMode, PostConditionMode, SignedTokenTransferOptions, StacksTransaction, boolCV, bufferCV, contractPrincipalCV, listCV, makeSTXTokenTransfer, makeUnsignedContractCall, makeUnsignedContractDeploy, makeUnsignedSTXTokenTransfer, principalCV, serializeCV, stringAsciiCV, tupleCV, uintCV } from "@stacks/transactions";
import { c32addressDecode } from "c32check";
import fs from "fs";

// current beta api endpoint
const SIMULATION_API_ENDPOINT = "https://api.stxer.xyz/simulations";

function runTx(tx: StacksTransaction) {
  // type 0: run transaction
  return tupleCV({ type: uintCV(0), data: bufferCV(tx.serialize()) });
}

const common_params = {
  network: new StacksMainnet(),
  publicKey: "",
  postConditionMode: PostConditionMode.Allow,
  anchorMode: AnchorMode.Any,
  fee: 100,
};

function runEval(address: string, contractName: string, code: string) {
  // type 1: eval arbitrary code inside a contract
  return tupleCV({
    type: uintCV(1),
    data: bufferCV(
      serializeCV(
        tupleCV({
          contract: contractPrincipalCV(address, contractName),
          code: stringAsciiCV(code),
        })
      )
    ),
  });
}

async function vote(address: string, nonce: number) {
  const [, addressHash] = c32addressDecode(address);
  const voteTx1 = await makeUnsignedContractCall({
    contractAddress: "SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH",
    contractName: "ccip019-pox-4-stacking",
    functionName: "vote-on-proposal",
    functionArgs: [boolCV(true)],
    nonce: nonce++,
    ...common_params,
  });
  voteTx1.auth.spendingCondition.signer = addressHash;
  return voteTx1;
}

async function directExecute(address: string, nonce: number) {
  const [, addressHash] = c32addressDecode(address);
  const directExecuteTx1 = await makeUnsignedContractCall({
    contractAddress: "SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH",
    contractName: "ccd001-direct-execute",
    functionName: "direct-execute",
    functionArgs: [principalCV("SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccip019-pox-4-stacking")],
    nonce: nonce++,
    ...common_params,
  });
  directExecuteTx1.auth.spendingCondition.signer = addressHash;
  return directExecuteTx1;
}

async function main() {
  const block_height = 161020;
  const block_hash = "cf26a611c560d1775fc9d1d01cc1b223175a3cd2efddd0d56fec44526fd48576";

  // DO NOT sign any transactions you're about to send, this is not required for simulation
  let address = "SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH";
  let nonce = 36;

  let [, addressHash] = c32addressDecode(address);

  const deployTx1 = await makeUnsignedContractDeploy({
    contractName: "ccd002-treasury-mia-mining-v3",
    codeBody: fs.readFileSync("contracts/extensions/ccd002-treasury-v3.clar").toString(),
    nonce: nonce++,
    ...common_params,
  });
  deployTx1.auth.spendingCondition.signer = addressHash;

  const deployTx2 = await makeUnsignedContractDeploy({
    contractName: "ccd002-treasury-mia-rewards-v3",
    codeBody: fs.readFileSync("contracts/extensions/ccd002-treasury-v3.clar").toString(),
    nonce: nonce++,
    ...common_params,
  });
  deployTx2.auth.spendingCondition.signer = addressHash;

  const deployTx3 = await makeUnsignedContractDeploy({
    contractName: "ccip019-pox-4-stacking",
    codeBody: fs.readFileSync("contracts/proposals/ccip019-pox-4-stacking.clar").toString(),
    nonce: nonce++,
    ...common_params,
  });
  deployTx3.auth.spendingCondition.signer = addressHash;

  const voteTxs: StacksTransaction[] = [];

  voteTxs.push(await vote("SP18Z92ZT0GAB2JHD21CZ3KS1WPGNDJCYZS7CV3MD", 529));
  voteTxs.push(await vote("SP34N5WWPHWTVJVYPE368HYDEXMZWKPVF639B3P5T", 982));
  voteTxs.push(await vote("SP1T91N2Y2TE5M937FE3R6DE0HGWD85SGCV50T95A", 249));

  const executeTxs: StacksTransaction[] = [];
  executeTxs.push(await directExecute("SP7DGES13508FHRWS1FB0J3SZA326FP6QRMB6JDE", 122));
  executeTxs.push(await directExecute("SP3YYGCGX1B62CYAH4QX7PQE63YXG7RDTXD8BQHJQ", 17));
  executeTxs.push(await directExecute("SPN4Y5QPGQA8882ZXW90ADC2DHYXMSTN8VAR8C3X", 813));

  /* commenting this out as it's a transfer from the pool operator to the treasury
  // this is not required for the simulation to work?
  address = "SPN4Y5QPGQA8882ZXW90ADC2DHYXMSTN8VAR8C3X";
  const transferStxTx = await makeUnsignedSTXTokenTransfer({
    amount: 10000000,
    recipient: "SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-rewards-v3",
    nonce: 814,
    ...common_params,
  });
  [, addressHash] = c32addressDecode(address);
  transferStxTx.auth.spendingCondition.signer = addressHash;
  */

  address = "SPN4Y5QPGQA8882ZXW90ADC2DHYXMSTN8VAR8C3X";
  const lockStxTx = await makeUnsignedContractCall({
    contractAddress: "SP21YTSM60CAY6D011EZVEVNKXVW8FVZE198XEFFP",
    contractName: "pox4-fast-pool-v3",
    functionName: "delegate-stack-stx-many",
    functionArgs: [listCV([principalCV("SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-mining-v3"), principalCV("SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-rewards-v3")])],
    nonce: 814,
    ...common_params,
  });
  [, addressHash] = c32addressDecode(address);
  lockStxTx.auth.spendingCondition.signer = addressHash;

  const req = tupleCV({
    block_height: uintCV(block_height),
    block_hash: bufferCV(Buffer.from(block_hash, "hex")),
    steps: listCV([deployTx1, deployTx2, deployTx3, ...voteTxs, ...executeTxs, /*transferStxTx,*/ lockStxTx].map((t) => runTx(t))),
  });
  const body = serializeCV(req);
  const rs: any = await fetch(SIMULATION_API_ENDPOINT, {
    method: "POST",
    body,
  }).then((rs) => rs.json());
  console.log("Simulation will be available at: https://stxer.xyz/simulations/" + rs.id);
}

main().catch(console.error);
