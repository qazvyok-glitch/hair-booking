import { redirect } from "next/navigation";
import { appRoutes } from "../../lib/appRoutes";

export default function AdminEntryPage() {
  redirect(appRoutes.admin.home);
}
