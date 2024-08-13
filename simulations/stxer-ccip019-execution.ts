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

async function directExecute(address: string, nonce: number) {
  const [, addressHash] = c32addressDecode(address);
  const directExecuteTx = await makeUnsignedContractCall({
    contractAddress: "SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH",
    contractName: "ccd001-direct-execute",
    functionName: "direct-execute",
    functionArgs: [principalCV("SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccip019-pox-4-stacking")],
    nonce: nonce++,
    ...common_params,
  });
  directExecuteTx.auth.spendingCondition.signer = addressHash;
  return directExecuteTx;
}

async function main() {
  // set current block height and hash
  const block_height = 161649;
  const block_hash = "654a1b5a9f3a8345b62d8cf854e57a742c84c7330991b86f4585949ca6fa2033";

  // execute the proposal with 3rd tx
  const executeTx = await directExecute("SP7DGES13508FHRWS1FB0J3SZA326FP6QRMB6JDE", 122);

  // lock stx to the pool
  const address = "SPN4Y5QPGQA8882ZXW90ADC2DHYXMSTN8VAR8C3X";
  const [, addressHash] = c32addressDecode(address);
  const lockStxTx = await makeUnsignedContractCall({
    contractAddress: "SP21YTSM60CAY6D011EZVEVNKXVW8FVZE198XEFFP",
    contractName: "pox4-fast-pool-v3",
    functionName: "delegate-stack-stx-many",
    functionArgs: [listCV([principalCV("SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-mining-v3"), principalCV("SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd002-treasury-mia-rewards-v3")])],
    nonce: 816, // matches Hiro Explorer
    ...common_params,
  });
  lockStxTx.auth.spendingCondition.signer = addressHash;

  const req = tupleCV({
    block_height: uintCV(block_height),
    block_hash: bufferCV(Buffer.from(block_hash, "hex")),
    steps: listCV([executeTx, lockStxTx].map((t) => runTx(t))),
  });
  const body = serializeCV(req);
  const rs: any = await fetch(SIMULATION_API_ENDPOINT, {
    method: "POST",
    body,
  }).then((rs) => rs.json());
  console.log("Simulation will be available at: https://stxer.xyz/simulations/" + rs.id);
}

main().catch(console.error);
