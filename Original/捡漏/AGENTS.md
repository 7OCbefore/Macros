# Original/捡漏/ – AGENTS

## OVERVIEW
Auction-house bargain hunting scripts driven by CSV price data.

## WHERE TO LOOK
- Entry script: `FindingBargain.js`
- Price data: `inventory_data.csv`
- Purchase log: `FindingBargain_Log.csv`
- Alternate script: `get新物品信息.js`

## CONVENTIONS
- CSV parsing uses `FS.open(...).readLines()`.
- Price CSV columns: Slot, Name, Count, Price, Seller, CareFinish.
- Successful purchases append to log via `FS.append(...)`.
- Log rows include timestamp, item, unit price, ref price, quantity, seller.
- Randomized wait intervals reduce predictable loops.
- Stop key uses `key.keyboard.x` with `JsMacros.on("Key")`.
- Price types split regular vs CareFinish items.

## ANTI-PATTERNS
- Hardcoded absolute paths for CSV/log files.
- Monolithic scripts mixing UI, pricing, and control flow.
- Long blocking loops without periodic waits.
- Global state variables instead of scoped state objects.
- Writing CSV without header checks or encoding consistency.
