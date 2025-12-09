import { useState } from "preact/hooks";
import type { CoinGroup, Network } from "../../hooks/useCoins";
import { formatCurrency } from "../../lib/formatCurrency";
import type { Currency } from "../../stores/useSettingsStore";

const NETWORK_ICONS: Record<Network, string> = {
  ethereum: "/coins/ethereum.svg",
  arbitrum: "/coins/arbitrum.svg",
  unichain: "/coins/unichain.svg",
  linea: "/coins/linea.svg",
  base: "/coins/base.svg",
  solana: "/coins/solana.svg",
  bitcoin: "/coins/bitcoin.svg",
};

interface CoinGroupRowProps {
  group: CoinGroup;
  convertCurrency: (usd: number) => number;
  currency: Currency;
}

export const CoinGroupRow = ({
  group,
  convertCurrency,
  currency,
}: CoinGroupRowProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasMultipleNetworks = group.entries.length > 1;

  const formattedTotalValue = formatCurrency(
    convertCurrency(group.totalUsd),
    currency
  );

  const formattedTotalBalance = group.totalBalance.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  });

  // Sort entries by balance (highest first)
  const sortedEntries = [...group.entries].sort(
    (a, b) => b.balance - a.balance
  );

  // Get networks sorted by balance (based on sorted entries)
  const sortedNetworks = sortedEntries
    .map((entry) => entry.network)
    .filter((network): network is Network => network !== null);

  const handleClick = () => {
    if (hasMultipleNetworks) {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <div>
      {/* Main row */}
      <article
        className={`flex items-center gap-3 py-3 ${hasMultipleNetworks ? "cursor-pointer" : ""}`}
        onClick={handleClick}
      >
        {/* Coin icon with stacked network badges */}
        <div className="relative">
          {group.icon ? (
            <img
              src={group.icon}
              alt={group.name}
              className="w-12 h-12 rounded-full"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-teqo-100 flex-center text-lg font-bold text-teqo-600">
              {group.symbol.slice(0, 2)}
            </div>
          )}

          {/* Stacked network icons - max 70% of coin icon width (48px * 0.7 ≈ 33px) */}
          {sortedNetworks.length > 0 && (
            <NetworkIconsStack networks={sortedNetworks} />
          )}
        </div>

        {/* Name and symbol */}
        <div className="flex-1">
          <h4>{group.name}</h4>
          <p className="text-sm text-teqo-400">{group.symbol}</p>
        </div>

        {/* Balance and fiat value */}
        <div className="text-right">
          <h4>{formattedTotalValue}</h4>
          <p className="text-sm text-teqo-400">{formattedTotalBalance}</p>
        </div>
      </article>

      {/* Expanded entries */}
      {isExpanded && hasMultipleNetworks && (
        <div className="ml-6 border-l-2 border-teqo-100 pl-4">
          {sortedEntries.map((coin) => (
            <NetworkEntry
              key={coin.id}
              coin={coin}
              convertCurrency={convertCurrency}
              currency={currency}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const MAX_CONTAINER_WIDTH = 33; // 70% of 48px coin icon
const ICON_SIZE = 16; // w-4 = 16px
const MIN_OVERLAP = 6; // Minimum overlap between icons

interface NetworkIconsStackProps {
  networks: Network[];
}

const NetworkIconsStack = ({ networks }: NetworkIconsStackProps) => {
  const count = networks.length;

  // Calculate natural width with minimum overlap
  // Natural width = iconSize + (count - 1) * (iconSize - minOverlap)
  const naturalWidth =
    count === 1
      ? ICON_SIZE
      : ICON_SIZE + (count - 1) * (ICON_SIZE - MIN_OVERLAP);

  // Use natural width if it fits, otherwise constrain to max width
  const needsMoreOverlap = naturalWidth > MAX_CONTAINER_WIDTH;

  // Calculate margin for each icon
  const getMarginLeft = (index: number): number => {
    if (index === 0 || count === 1) return 0;

    if (needsMoreOverlap) {
      // Calculate overlap needed to fit within max width
      const availableSpace = MAX_CONTAINER_WIDTH - ICON_SIZE;
      const spacingPerIcon = availableSpace / (count - 1);
      return spacingPerIcon - ICON_SIZE;
    } else {
      // Use minimum overlap
      return -MIN_OVERLAP;
    }
  };

  // Actual width used
  const actualWidth = needsMoreOverlap ? MAX_CONTAINER_WIDTH : naturalWidth;

  return (
    <div
      className="absolute -bottom-0.5 right-0 flex justify-end"
      style={{ width: `${actualWidth}px` }}
    >
      {networks.map((network, index) => (
        <img
          key={network}
          src={NETWORK_ICONS[network]}
          alt={network}
          className="w-4 h-4 rounded-full border border-white bg-white flex-shrink-0"
          style={{
            marginLeft: index > 0 ? `${getMarginLeft(index)}px` : "0",
            zIndex: count - index,
          }}
        />
      ))}
    </div>
  );
};

interface NetworkEntryProps {
  coin: CoinGroup["entries"][number];
  convertCurrency: (usd: number) => number;
  currency: Currency;
}

const NetworkEntry = ({
  coin,
  convertCurrency,
  currency,
}: NetworkEntryProps) => {
  const formattedValue = formatCurrency(convertCurrency(coin.usd), currency);

  const formattedBalance = coin.balance.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  });

  // Use "Ethereum" for mainnet ETH (network: null), otherwise capitalize network name
  const networkName = coin.network
    ? coin.network.charAt(0).toUpperCase() + coin.network.slice(1)
    : "Ethereum";

  // Use ethereum icon for mainnet ETH
  const networkIcon = coin.network ?? "ethereum";

  return (
    <article className="flex items-center gap-3 py-2">
      {/* Network icon */}
      <div className="w-8 h-8 flex-center">
        <img
          src={NETWORK_ICONS[networkIcon]}
          alt={networkName}
          className="w-6 h-6 rounded-full"
        />
      </div>

      {/* Network name */}
      <div className="flex-1">
        <p className="text-sm text-teqo-600">{networkName}</p>
      </div>

      {/* Balance and fiat value */}
      <div className="text-right">
        <p className="text-sm">{formattedValue}</p>
        <p className="text-xs text-teqo-400">{formattedBalance}</p>
      </div>
    </article>
  );
};
