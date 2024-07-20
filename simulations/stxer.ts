import { StacksMainnet } from "@stacks/network";
import { AnchorMode, PostConditionMode, StacksTransaction, boolCV, bufferCV, contractPrincipalCV, listCV, makeUnsignedContractCall, makeUnsignedContractDeploy, principalCV, serializeCV, stringAsciiCV, tupleCV, uintCV } from "@stacks/transactions";
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

async function main() {
  const block_height = 156894;
  const block_hash = "390579d10ed73f98ef829e0068d014d32a6a128e3ba0b80c42321010c61fff1a";

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
    contractName: "ccd002-treasury-mia-stx-stacking-v3",
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

  voteTxs.push(await vote("SP3TF26QFS3YMYHC9N3ZZTZQKCM4AFYMVW1WMFRTT", 932));
  voteTxs.push(await vote("SP3W06MK1XP52KTHJB96D04JSBW2NQCA42FFMQZXZ", 565));
  voteTxs.push(await vote("SP2S7Y7BMX7Y73FHV3SV9W1EE63EQ98BE95PZ4C4E", 2486));
  voteTxs.push(await vote("SP1KVKBYWMCK7WSDYS0DDF8R3XT5RD5QKBPQK3SBB", 567));
  voteTxs.push(await vote("SP39XMB07QV4KN4PB6X3KHNQKWARB0F9AXY6K41E0", 626));
  voteTxs.push(await vote("SP1V4BWKPD559WP67GWCV8VR0VRKJ7ESS8WHKYEJP", 905));
  voteTxs.push(await vote("SP3W8BCK1KKJB8H34QA2RWV2Z35E7RNPKEXJSFAF0", 3872));
  voteTxs.push(await vote("SPM3GE47QTMMVBT6DH0XFBXYS1AJHSSAQMYSB4J8", 7706));
  voteTxs.push(await vote("SPN4Y5QPGQA8882ZXW90ADC2DHYXMSTN8VAR8C3X", 802));

  address = "SP7DGES13508FHRWS1FB0J3SZA326FP6QRMB6JDE";
  [, addressHash] = c32addressDecode(address);
  nonce = 120;
  const tx1 = await makeUnsignedContractCall({
    contractAddress: "SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH",
    contractName: "ccd001-direct-execute",
    functionName: "direct-execute",
    functionArgs: [principalCV("SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccip019-pox-4-stacking")],
    nonce: nonce++,
    ...common_params,
  });
  tx1.auth.spendingCondition.signer = addressHash;

  address = "SP3YYGCGX1B62CYAH4QX7PQE63YXG7RDTXD8BQHJQ";
  [, addressHash] = c32addressDecode(address);
  nonce = 17;
  const tx2 = await makeUnsignedContractCall({
    contractAddress: "SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH",
    contractName: "ccd001-direct-execute",
    functionName: "direct-execute",
    functionArgs: [principalCV("SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccip019-pox-4-stacking")],
    nonce: nonce++,
    ...common_params,
  });
  tx2.auth.spendingCondition.signer = addressHash;

  address = "SPN4Y5QPGQA8882ZXW90ADC2DHYXMSTN8VAR8C3X";
  [, addressHash] = c32addressDecode(address);
  nonce = 803;
  const tx3 = await makeUnsignedContractCall({
    contractAddress: "SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH",
    contractName: "ccd001-direct-execute",
    functionName: "direct-execute",
    functionArgs: [principalCV("SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccip019-pox-4-stacking")],
    nonce: nonce++,
    ...common_params,
  });
  tx3.auth.spendingCondition.signer = addressHash;

  const req = tupleCV({
    block_height: uintCV(block_height),
    block_hash: bufferCV(Buffer.from(block_hash, "hex")),
    steps: listCV([deployTx1, deployTx2, deployTx3, ...voteTxs, tx1, tx2, tx3].map((t) => runTx(t))),
  });
  const body = serializeCV(req);
  const rs: any = await fetch(SIMULATION_API_ENDPOINT, {
    method: "POST",
    body,
  }).then((rs) => rs.json());
  console.log("Simulation will be available at: https://stxer.xyz/simulations/" + rs.id);
}

main().catch(console.error);
