import { Header } from "../components/organisms/Header";
import { Summary } from "../components/organisms/Summary";
import { Transactions } from "../components/organisms/Transactions";

export const Home = () => {
  return (
    <main className="bg-teqo-200 h-full flex flex-col justify-end gap-2">
      <Summary />
      <Transactions />
      <Header />
    </main>
  );
};
