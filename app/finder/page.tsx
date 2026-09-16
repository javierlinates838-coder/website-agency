import { FinderApp } from "@/components/FinderApp";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";

export default function FinderPage() {
  return (
    <div>
      <SiteHeader dim />
      <FinderApp />
      <SiteFooter />
    </div>
  );
}
