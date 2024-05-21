import { Account, assertEquals, Clarinet, Chain } from "../../utils/deps.ts";

// =============================
// TEST PLAN
// =============================

// initialize-redemption() fails with ERR_UNAUTHORIZED when called directly
// initialize-redemption() fails with ERR_GETTING_TOTAL_SUPPLY if both supplies are 0
// initialize-redemption() fails with ERR_GETTING_REDEMPTION_BALANCE if the redemption balance is 0
// initialize-redemption() fails with ERR_ALREADY_ENABLED if called more than once
// initialize-redemption() succeeds and prints the redemption info

// redeem-nyc() fails with ERR_NOTHING_TO_REDEEM if the redemption amount is none
// redeem-nyc() fails with ERR_NOT_ENABLED if the redemption is not initialized
// redeem-nyc() fails with ERR_ALREADY_CLAIMED if the redemption is already claimed
// redeem-nyc() fails with ERR_BALANCE_NOT_FOUND if v1 or v2 tokens are not found
// redeem-nyc() fails with ERR_NOTHING_TO_REDEEM if the redemption amount is 0
// redeem-nyc() succeeds with just v1 tokens
// redeem-nyc() succeeds with just v2 tokens
// redeem-nyc() succeeds with both v1 and v2 tokens
