import { Chain, Account, ReadOnlyFn, Tx, types } from "../../utils/deps.ts";

export class TESTCCD011StackingPayouts001 {
  name: string;
  chain: Chain;
  deployer: Account;

  constructor(chain: Chain, deployer: Account, name: string) {
    this.name = name;
    this.chain = chain;
    this.deployer = deployer;
  }

  fund(sender: Account, amount: number) {
    return Tx.contractCall(this.name, "fund", [types.uint(amount)], sender.address);
  }

  getBalance(): ReadOnlyFn {
    return this.callReadOnlyFn("get-balance", []);
  }

  private callReadOnlyFn(method: string, args: Array<any> = [], sender: Account = this.deployer): ReadOnlyFn {
    const result = this.chain.callReadOnlyFn(this.name, method, args, sender?.address);
    return result;
  }
}
