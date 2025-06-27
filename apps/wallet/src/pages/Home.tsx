import { Header } from "../components/organisms/Header";
import { Summary } from "../components/organisms/Summary";
import { Transactions } from "../components/organisms/Transactions";
import { Page } from "../components/templates/Page";

export const Home = () => {
  return (
    <Page>
      <Summary />
      <Transactions />
      <Header />
    </Page>
  );
};
