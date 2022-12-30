import { Chain, Account, Tx, types, ReadOnlyFn } from "../../utils/deps.ts";

export enum ErrCode {
  ERR_UNAUTHORIZED = 9000,
}

export class CCD009AuthV2Adapter {
  name: string;
  static readonly ErrCode = ErrCode;
  chain: Chain;
  deployer: Account;

  constructor(chain: Chain, deployer: Account, name: string) {
    this.name = name;
    this.chain = chain;
    this.deployer = deployer;
  }

  // Authorization

  isDaoOrExtension(): ReadOnlyFn {
    return this.callReadOnlyFn("is-dao-or-extension");
  }

  // Internal DAO functions

  createJobMia(sender: Account, name: string, target: string) {
    return Tx.contractCall(this.name, "create-job-mia", [types.ascii(name), types.principal(target)], sender.address);
  }
  createJobNyc(sender: Account, name: string, target: string) {
    return Tx.contractCall(this.name, "create-job-nyc", [types.ascii(name), types.principal(target)], sender.address);
  }

  activateJobMia(sender: Account, jobId: number) {
    return Tx.contractCall(this.name, "activate-job-mia", [types.uint(jobId)], sender.address);
  }
  activateJobNyc(sender: Account, jobId: number) {
    return Tx.contractCall(this.name, "activate-job-nyc", [types.uint(jobId)], sender.address);
  }

  approveJobMia(sender: Account, jobId: number) {
    return Tx.contractCall(this.name, "approve-job-mia", [types.uint(jobId)], sender.address);
  }
  approveJobNyc(sender: Account, jobId: number) {
    return Tx.contractCall(this.name, "approve-job-nyc", [types.uint(jobId)], sender.address);
  }

  disapproveJobMia(sender: Account, jobId: number) {
    return Tx.contractCall(this.name, "disapprove-job-mia", [types.uint(jobId)], sender.address);
  }
  disapproveJobNyc(sender: Account, jobId: number) {
    return Tx.contractCall(this.name, "disapprove-job-nyc", [types.uint(jobId)], sender.address);
  }

  addUintArgumentMia(sender: Account, jobId: number, name: string, value: number) {
    return Tx.contractCall(this.name, "add-uint-argument-mia", [types.uint(jobId), types.ascii(name), types.uint(value)], sender.address);
  }
  addUintArgumentNyc(sender: Account, jobId: number, name: string, value: number) {
    return Tx.contractCall(this.name, "add-uint-argument-nyc", [types.uint(jobId), types.ascii(name), types.uint(value)], sender.address);
  }

  addPrincipalArgumentMia(sender: Account, jobId: number, name: string, value: string) {
    return Tx.contractCall(this.name, "add-principal-argument-mia", [types.uint(jobId), types.ascii(name), types.principal(value)], sender.address);
  }
  addPrincipalArgumentNyc(sender: Account, jobId: number, name: string, value: string) {
    return Tx.contractCall(this.name, "add-principal-argument-nyc", [types.uint(jobId), types.ascii(name), types.principal(value)], sender.address);
  }

  executeUpgradeCoreContractJobMia(sender: Account, jobId: number, oldContract: string, newContract: string) {
    return Tx.contractCall(this.name, "execute-upgrade-core-contract-job-mia", [types.uint(jobId), types.principal(oldContract), types.principal(newContract)], sender.address);
  }
  executeUpgradeCoreContractJobNyc(sender: Account, jobId: number, oldContract: string, newContract: string) {
    return Tx.contractCall(this.name, "execute-upgrade-core-contract-job-mia", [types.uint(jobId), types.principal(oldContract), types.principal(newContract)], sender.address);
  }

  executeUpdateCoinbaseThresholdsJobMia(sender: Account, jobId: number, targetCore: string, targetToken: string) {
    return Tx.contractCall(this.name, "execute-update-coinbase-thresholds-job-mia", [types.uint(jobId), types.principal(targetCore), types.principal(targetToken)], sender.address);
  }
  executeUpdateCoinbaseThresholdsJobNyc(sender: Account, jobId: number, targetCore: string, targetToken: string) {
    return Tx.contractCall(this.name, "execute-update-coinbase-thresholds-job-nyc", [types.uint(jobId), types.principal(targetCore), types.principal(targetToken)], sender.address);
  }

  executeUpdateCoinbaseAmountsJobMia(sender: Account, jobId: number, targetCore: string, targetToken: string) {
    return Tx.contractCall(this.name, "execute-update-coinbase-amounts-job-mia", [types.uint(jobId), types.principal(targetCore), types.principal(targetToken)], sender.address);
  }
  executeUpdateCoinbaseAmountsJobNyc(sender: Account, jobId: number, targetCore: string, targetToken: string) {
    return Tx.contractCall(this.name, "execute-update-coinbase-amounts-job-nyc", [types.uint(jobId), types.principal(targetCore), types.principal(targetToken)], sender.address);
  }

  executeReplaceApproverJobMia(sender: Account, jobId: number) {
    return Tx.contractCall(this.name, "execute-replace-approver-job-mia", [types.uint(jobId)], sender.address);
  }
  executeReplaceApproverJobNyc(sender: Account, jobId: number) {
    return Tx.contractCall(this.name, "execute-replace-approver-job-nyc", [types.uint(jobId)], sender.address);
  }

  // Extension callback

  callback(sender: Account, memo: string) {
    return Tx.contractCall(this.name, "callback", [types.principal(sender.address), types.buff(memo)], sender.address);
  }

  private callReadOnlyFn(method: string, args: Array<any> = [], sender: Account = this.deployer): ReadOnlyFn {
    const result = this.chain.callReadOnlyFn(this.name, method, args, sender?.address);
    return result;
  }
}
