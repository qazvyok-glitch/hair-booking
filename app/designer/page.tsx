import { redirect } from "next/navigation";
import { appRoutes } from "../../lib/appRoutes";

export default function DesignerEntryPage() {
  redirect(appRoutes.designer.home);
}
