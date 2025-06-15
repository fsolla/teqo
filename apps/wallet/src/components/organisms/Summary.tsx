import clsx from "clsx";
import type { IconName } from "lucide-react/dynamic";
import { Icon } from "../atoms/Icon";
import { Image } from "../atoms/Image";

export const Summary = () => (
  <section className="bg-teqo-50 rounded-2xl px-5 py-4 flex flex-col gap-1">
    <div className="bg-teqo-100 flex flex-col gap-0.25">
      <CoinBalance
        image={{ src: "/coins/ethereum.svg", alt: "Ethereum" }}
        title="Ethereum"
        subtitle="ETH"
        value="$18.58"
        undervalue="0.00701525"
      />
      <CoinBalance
        image={{ src: "/coins/bitcoin.svg", alt: "Bitcoin" }}
        title="Bitcoin"
        subtitle="BTC"
        value="$128.37"
        undervalue="0.00002575"
      />
      <CoinBalance
        image={{ src: "coins/solana.svg", alt: "Solana" }}
        title="Solana"
        subtitle="SOL"
        value="$285.43"
        undervalue="1.23456789"
      />
    </div>
    <nav className="flex gap-9 items-center">
      <button>
        <Icon name="sliders-horizontal" size="sm" />
      </button>
      <div className="flex-1" />
      <Tab icon="coins" label="Coins" active />
      <Tab icon="images" label="NFTs" />
      <Tab icon="chart-candlestick" label="DeFi" />
    </nav>
  </section>
);

const Tab = ({
  icon,
  label,
  active,
}: {
  icon: IconName;
  label: string;
  active?: true;
}) => (
  <button
    className={clsx("text-teqo-300", active && "text-teqo-900")}
    disabled={active}
  >
    <Icon name={icon} size="sm" />
    <h6>{label}</h6>
  </button>
);

const CoinBalance = ({
  image,
  title,
  subtitle,
  value,
  undervalue,
}: {
  image: { src: string; alt: string };
  title: string;
  subtitle: string;
  value: string;
  undervalue: string;
}) => (
  <article className="flex gap-2 w-full py-3 bg-teqo-50">
    <Image src={image.src} alt={image.alt} size="lg" />
    <header>
      <h4>{title}</h4>
      <h5 className="text-teqo-500">{subtitle}</h5>
    </header>
    <div className="text-right flex-1">
      <h4>{value}</h4>
      <h5 className="text-teqo-500">{undervalue}</h5>
    </div>
  </article>
);
