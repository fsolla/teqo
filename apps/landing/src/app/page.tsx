import { EarlyAccess } from "@/components/sections/EarlyAccess";
import { Footer } from "@/components/sections/Footer";
import { Hero } from "@/components/sections/Hero";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { ProblemAndSolution } from "@/components/sections/ProblemAndSolution";
import { TekoMeaning } from "@/components/sections/TekoMeaning";

export default function Home() {
  return (
    <main className="flex flex-col gap-30 items-center">
      <Hero />
      <div className="flex flex-col gap-30 lg:max-w-245.75 max-w-210">
        <TekoMeaning />
        <ProblemAndSolution />
        <HowItWorks />
        <EarlyAccess />
      </div>
      <Footer />
    </main>
  );
}
