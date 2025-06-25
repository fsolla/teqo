import { Footer } from "@/components/sections/Footer";
import { Freedom } from "@/components/sections/Freedom";
import { Future } from "@/components/sections/Future";
import { Invite } from "@/components/sections/Invite";
import { Promise } from "@/components/sections/Promise";
import { Trust } from "@/components/sections/Trust";

export default function Home() {
  return (
    <main className="snap-y snap-proximity h-dvh w-dvw overflow-y-scroll scrollbar-hidden scroll-smooth">
      <Promise />
      <Trust />
      <Freedom />
      <Future />
      <Invite />
      <Footer />
    </main>
  );
}
