import { Link } from "react-router-dom";
import { Construction } from "lucide-react";
import AppHeader from "@/components/layout/AppHeader";

interface FeaturePlaceholderPageProps {
  title: string;
  description: string;
}

function FeaturePlaceholderPage({
  title,
  description,
}: FeaturePlaceholderPageProps) {
  return (
    <div className="min-h-screen bg-[#07111e]">
      <AppHeader title={title} description={description} />

      <main className="flex min-h-[65vh] flex-col items-center justify-center px-6 text-center">
        <div className="mb-5 rounded-2xl bg-blue-500/10 p-5">
          <Construction className="size-9 text-blue-400" />
        </div>

        <h2 className="text-2xl font-semibold text-white">Under Development</h2>

        <p className="mt-3 max-w-md text-sm leading-6 text-slate-400">
          This feature is planned for the next release. For now, explore the
          interactive mission dashboard.
        </p>

        <Link
          to="/"
          className="mt-6 rounded-lg bg-blue-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-400"
        >
          Back to Dashboard
        </Link>
      </main>
    </div>
  );
}

export default FeaturePlaceholderPage;
