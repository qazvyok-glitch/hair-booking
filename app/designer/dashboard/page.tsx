import { redirect } from "next/navigation";
import { appRoutes } from "../../../lib/appRoutes";

export default function DesignerDashboardRedirect() {
  redirect(appRoutes.designer.home);
}

