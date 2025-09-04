import { hexToBytes } from "@stacks/common";
import { AnchorMode, PostConditionMode, StacksTransactionWire, boolCV, bufferCV, listCV, makeUnsignedContractCall, principalCV, serializeCV, serializeTransaction, tupleCV, uintCV } from "@stacks/transactions";
import { SimulationBuilder } from "stxer";
import fs from "fs";

const contract_name = "ccip016-missed-payouts-v3";
const deployer = "SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9";
const contract_id = `${deployer}.${contract_name}`;
const common_params = {
  publicKey: "",
  postConditionMode: PostConditionMode.Allow,
  anchorMode: AnchorMode.Any,
  fee: 100,
};

function vote(sender: string, nonce: number) {
  return {
    contract_id,
    function_name: "vote-on-proposal",
    function_args: [boolCV(true)],
    nonce: nonce++,
    sender,
    ...common_params,
  };
}

function directExecute(sender: string, nonce: number) {
  return {
    contract_id: "SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd001-direct-execute",
    function_name: "direct-execute",
    function_args: [principalCV(contract_id)],
    nonce: nonce++,
    sender,
    ...common_params,
  };
}

function main() {
  const block_height = 1457519;

  return (
    SimulationBuilder.new()
      .useBlockHeight(block_height)
      // .addContractDeploy({
      //   contract_name,
      //   source_code: fs.readFileSync("./contracts/proposals/ccip016-missed-payouts-v2.clar", "utf8"),
      //   deployer: "SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9",
      // })
      .addContractCall(vote("SP39EH784WK8VYG0SXEVA0M81DGECRE25JYSZ5XSA", 74))
      .addContractCall(vote("SP18Z92ZT0GAB2JHD21CZ3KS1WPGNDJCYZS7CV3MD", 529))
      .addContractCall(vote("SP34N5WWPHWTVJVYPE368HYDEXMZWKPVF639B3P5T", 984))
      .addContractCall(vote("SP1T91N2Y2TE5M937FE3R6DE0HGWD85SGCV50T95A", 249))
      //
      .addContractCall(directExecute("SP7DGES13508FHRWS1FB0J3SZA326FP6QRMB6JDE", 124))
      .addContractCall(directExecute("SP3YYGCGX1B62CYAH4QX7PQE63YXG7RDTXD8BQHJQ", 19))
      .addContractCall(directExecute("SPN4Y5QPGQA8882ZXW90ADC2DHYXMSTN8VAR8C3X", 851))

      .run()
      .catch(console.error)
  );
}

main().catch(console.error);

function checkStacking() {
  SimulationBuilder.new()
    .useBlockHeight(145643)
    .withSender("")
    .addContractCall({
      contract_id: "SP8A9HZ3PKST0S42VM9523Z9NV42SZ026V4K39WH.ccd007-citycoin-stacking",
      function_name: "get-stacker",
      function_args: [uintCV(1), uintCV(82), uintCV(187)],
      sender: "SP39EH784WK8VYG0SXEVA0M81DGECRE25JYSZ5XSA",
    })
    .run()
    .catch(console.error);
}

//checkStacking();
