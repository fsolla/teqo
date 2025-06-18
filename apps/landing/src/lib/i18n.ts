import { headers } from "next/headers";

export class i18n {
  static language: "en" | "pt" = "en";

  static async init() {
    this.language = await getPreferredLanguage();
  }

  static get(key: keyof typeof dict): string {
    return this.language === "pt" ? dict[key] : key;
  }
}

export const t = (key: keyof typeof dict): string => i18n.get(key);

export const T = ({ children }: { children: string }) => {
  return t(children as keyof typeof dict);
};

export const getPreferredLanguage = async (): Promise<"en" | "pt"> => {
  const headerList = await headers();
  console.log({
    header: headerList.get("accept-language"),
  });
  const acceptLanguage = headerList.get("accept-language") || "";
  return acceptLanguage.toLowerCase().startsWith("pt") ? "pt" : "en";
};

const dict = {
  ["Your digital world"]: "Seu mundo digital",
  ["Your rules"]: "Suas regras",
  ["Teqo is the digital wallet that makes Web3 "]:
    "Teqo é a carteira digital que torna Web3 ",
  ["simple, secure, and accessible"]: "simples, segura e acessível.",
  ['Teko is a Guarani word that means "way of being".\nThe way we live and relate to the world.']:
    'Teko é uma palavra Guarani que significa "modo de ser".\nA forma como vivemos e nos relacionamos com o mundo.',
  ["Web3 today"]: "Web3 hoje",
  ["Fear of losing everything"]: "Medo de perder tudo",
  ["Private keys, seed phrases, contracts. Total responsibility is in your hands, with no safety net."]:
    "Chaves privadas, seeds phrases, contratos. A responsabilidade toda está em suas mãos, sem rede de segurança.",
  ["Fragmented experience"]: "Experiência fragmentada",
  ["Transactions that cause anxiety, confusing interfaces, technical jargon that alienates normal people."]:
    "Transações que geram ansiedade, interfaces confusas, jargões técnicos que afastam pessoas normais.",
  ["Lack of clarity"]: "Falta de clareza",
  ["You never know exactly what is happening, how much it will cost, or if it worked."]:
    "Você nunca sabe exatamente o que está acontecendo, quanto vai custar, ou se deu certo.",
  ["Teqo is the solution"]: "Teqo é a solução",
  ["Assisted recovery"]: "Recuperação assistida",
  ["We protect your encrypted key in our vault. You will always have access to your account, now and always."]:
    "Protegemos sua chave cripiografada em nosso cofre. Você sempre terá acesso à sua conta, hoje e sempre.",
  ["Fluid experience"]: "Experiência fluida",
  ["Microinteractions designed to guide each transaction, easing your anxiety from start to finish."]:
    "Microinterações pensadas para acompanhar cada transação, controlando sua ansiedade do início ao fim.",
  ["Total transparency"]: "Transparência total",
  ["We always know what's happening, how much it costs, and we provide clear feedback for every action."]:
    "Sempre sabemos o que está acontecendo, quanto custa, e damos feedback claro sobre cada ação.",
  ["How Teqo works?"]: "Como Teqo funciona?",
  ["Create your account"]: "Crie sua conta",
  ["Your private key is automatically protected."]:
    "Sua chave privada é protegida automaticamente.",
  ["Manage with clarity"]: "Gerencie com clareza",
  ["Organize your digital assets in a simple way.\nTokens, NFTs, domains."]:
    "Organize seus ativos digitais de forma simples.\nTokens, NFTs, domínios.",
  ["Transact without fear"]: "Transacione sem medo",
  ["Each action is explained before it happens. Track progress in real time."]:
    "Cada ação é explicada antes de acontecer. Acompanhe o progresso em tempo real.",
  ["Assisted recovery by default"]: "Recuperação assistida por padrão",
  ["Unlike other wallets, you don’t need to worry about losing your keys. We protect everything securely so you always have access."]:
    "Diferente de outras carteiras, você não precisa se preocupar em perder suas chaves. Protegemos tudo de forma segura para que você sempre tenha acesso.",
  ["For advanced users: You can disable this protection and use it in fully self-custodial mode whenever you want."]:
    "Para usuários avançados: Você pode desativar essa proteção e usar de forma completamente auto-custodial quando quiser.",
  ["Get early access"]: "Garanta seu acesso antecipado",
  ["Your best email"]: "Seu melhor e-mail",
  ["Reserve"]: "Reservar",
  ["Welcome"]: "Bem-vindo(a)",
  ["You are now part of the group that will experience Teqo firsthand."]:
    "Você agora faz parte do grupo que vai experimentar o Teqo em primeira mão.",
  ["Teqo"]: "Teqo",
  ["Your digital wallet that makes Web3 simple, secure, and accessible.\nDigital ownership with clarity and intention."]:
    "Sua carteira digital que torna Web3 simples, segura e acessível.\nPropriedade digital com clareza e intenção.",
  ["© 2025 Teqo.\nAll rights reserved."]:
    "© 2025 Teqo.\nTodos os direitos reservados.",
  ["Built with intention."]: "Construído com intenção.",
} satisfies Record<string, string>;
